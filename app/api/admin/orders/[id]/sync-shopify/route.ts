import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { createOrder, createCustomer } from '@/lib/shopify-admin';

/**
 * POST /api/admin/orders/[id]/sync-shopify
 * Syncs a local mobile order to Shopify by creating a new Shopify order.
 */
export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const orderId = params.id;

    // Fetch the local order with full details
    let order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: true,
        customer: true,
      },
    });

    if (!order) {
      // Check if it's a mobile order
      const mobileOrder = await prisma.mobileOrder.findUnique({
        where: { id: orderId },
        include: {
          customer: true,
          items: true,
        }
      });

      if (mobileOrder) {
        // If already synced (numeric Shopify order id), skip.
        if (mobileOrder.shopifyOrderId && /^\d+$/.test(String(mobileOrder.shopifyOrderId))) {
          return NextResponse.json({
            success: true,
            shopifyOrderId: mobileOrder.shopifyOrderId,
            message: 'Order already synced to Shopify'
          });
        }

        // Update DB authority first to approved
        await prisma.mobileOrder.update({
          where: { id: mobileOrder.id },
          data: { status: 'approved' },
        });

        // Parse shipping address
        let shippingAddress: any = {};
        try {
          shippingAddress = mobileOrder.shippingAddress ? JSON.parse(mobileOrder.shippingAddress) : {};
        } catch {
          shippingAddress = {};
        }

        // Resolve Shopify customer (best-effort)
        let shopifyCustomerId = mobileOrder.customer?.shopifyId;
        if (!shopifyCustomerId || shopifyCustomerId.startsWith('temp_') || shopifyCustomerId.startsWith('google_') || shopifyCustomerId.startsWith('mobile_') || shopifyCustomerId.startsWith('otp_') || shopifyCustomerId.startsWith('csv_')) {
          try {
            const customerName = mobileOrder.customer?.name || shippingAddress?.name || 'App User';
            const nameParts = String(customerName).split(' ');
            const createdCustomer = await createCustomer({
              first_name: nameParts[0] || 'App',
              last_name: nameParts.slice(1).join(' ') || 'User',
              email: mobileOrder.customer?.email || shippingAddress?.email || '',
              phone: mobileOrder.customer?.phone || shippingAddress?.phone || '',
              verified_email: true,
              addresses: (shippingAddress?.address1 || shippingAddress?.line1)
                ? [
                    {
                      address1: shippingAddress.address1 || shippingAddress.line1 || '',
                      address2: shippingAddress.address2 || shippingAddress.line2 || '',
                      city: shippingAddress.city || '',
                      province: shippingAddress.province || shippingAddress.state || '',
                      zip: shippingAddress.zip || shippingAddress.pincode || '',
                      country: shippingAddress.country || 'India',
                      default: true,
                    },
                  ]
                : [],
            });
            shopifyCustomerId = String(createdCustomer.id);
            if (mobileOrder.customer?.id) {
              await prisma.customer.update({ where: { id: mobileOrder.customer.id }, data: { shopifyId: shopifyCustomerId } });
            }
          } catch (e) {
            console.error('[Admin Detail Sync] Customer sync failed:', e);
          }
        }

        // Build Shopify order payload
        const shopifyOrderPayload: any = {
          line_items: mobileOrder.items.map((item: any) => {
            if (item.variantId && /^\d+$/.test(String(item.variantId))) {
              return { variant_id: parseInt(String(item.variantId), 10), quantity: item.quantity };
            }
            const sku = item.sku || '';
            const m = sku.match(/variant:(\d+)/i);
            if (m?.[1]) return { variant_id: parseInt(m[1], 10), quantity: item.quantity };
            return { title: item.title, quantity: item.quantity, price: item.price.toFixed(2), requires_shipping: true };
          }),
          email: mobileOrder.customer?.email || '',
          financial_status: String(mobileOrder.paymentStatus || '').toLowerCase() === 'paid' ? 'paid' : 'pending',
          tags: `mobile-app, zb-order-${mobileOrder.orderNumber}, ${mobileOrder.paymentMethod || ''}, SyncedFromAdminDetail`.replace(/\s+/g, ' ').trim(),
          note: `mobile-app | InternalOrderId: ${mobileOrder.id} | Payment: ${mobileOrder.paymentMethod || 'Unknown'}`,
          currency: mobileOrder.currency || 'INR',
        };

        if (shopifyCustomerId && /^\d+$/.test(String(shopifyCustomerId))) {
          shopifyOrderPayload.customer = { id: parseInt(String(shopifyCustomerId), 10) };
        }

        if (shippingAddress?.name || shippingAddress?.address1 || shippingAddress?.line1) {
          const nameParts = String(shippingAddress.name || mobileOrder.customer?.name || '').split(' ');
          shopifyOrderPayload.shipping_address = {
            first_name: nameParts[0] || 'App',
            last_name: nameParts.slice(1).join(' ') || 'User',
            address1: shippingAddress.address1 || shippingAddress.line1 || '',
            address2: shippingAddress.address2 || shippingAddress.line2 || '',
            city: shippingAddress.city || '',
            province: shippingAddress.province || shippingAddress.state || '',
            zip: shippingAddress.zip || shippingAddress.pincode || '',
            country: shippingAddress.country || 'India',
            phone: shippingAddress.phone || mobileOrder.customer?.phone || '',
          };
          shopifyOrderPayload.billing_address = shopifyOrderPayload.shipping_address;
        }

        const createdOrder = await createOrder(shopifyOrderPayload);
        const shopifyOrderId = String(createdOrder.id);

        // Update mobile order
        await prisma.mobileOrder.update({
          where: { id: mobileOrder.id },
          data: {
            shopifyOrderId,
            status: 'synced',
            syncedAt: new Date(),
            tags: `${mobileOrder.tags || ''}, synced`.replace(/\s+/g, ' ').trim(),
          },
        });

        // Create local standard Order
        const existingOrder = await prisma.order.findUnique({
          where: { shopifyOrderId }
        });

        if (!existingOrder) {
          const orderLineItems = mobileOrder.items.map((item: any, index: number) => ({
            shopifyLineItemId: `synced_${createdOrder.id}_${index}_${Date.now()}`,
            title: item.title,
            quantity: item.quantity,
            price: item.price,
            sku: item.sku,
            productId: item.productId
          }));

          await prisma.order.create({
            data: {
              shopId: mobileOrder.customer.shopId,
              shopifyOrderId,
              customerId: mobileOrder.customerId,
              status: 'approved',
              totalPrice: mobileOrder.totalPrice,
              subtotalPrice: mobileOrder.subtotalPrice || mobileOrder.totalPrice,
              totalTax: mobileOrder.totalTax || 0,
              currency: mobileOrder.currency || 'INR',
              paymentStatus: mobileOrder.paymentStatus || 'pending',
              fulfillmentStatus: mobileOrder.fulfillmentStatus || 'unfulfilled',
              deliveryStatus: mobileOrder.deliveryStatus || 'pending',
              shippingAddress: mobileOrder.shippingAddress,
              billingAddress: mobileOrder.billingAddress,
              note: mobileOrder.note || null,
              tags: `mobile-app, zb-order-${mobileOrder.orderNumber}, synced`,
              createdAt: new Date(),
              items: {
                create: orderLineItems
              }
            }
          });
        }

        // Push notification
        try {
          const orderNumber = mobileOrder.orderNumber || 'your order';
          const { NotificationService } = await import('@/lib/services/notification.service');
          await NotificationService.sendToUser(
            mobileOrder.customerId,
            'Zica Bella Order Update',
            `Your order ${orderNumber} has been approved and synced!`,
            { orderId: mobileOrder.id, status: 'approved' }
          );
        } catch (pushErr) {
          console.error('[Admin Detail Sync] approve push failed:', pushErr);
        }

        return NextResponse.json({
          success: true,
          shopifyOrderId,
          shopifyOrderName: createdOrder.name,
        });
      }
    }

    if (!order) {
      return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 });
    }

    // If already synced to Shopify, return the existing ID
    if (order.shopifyOrderId && !order.shopifyOrderId.startsWith('local_') && !order.shopifyOrderId.startsWith('app_')) {
      return NextResponse.json({ 
        success: true, 
        shopifyOrderId: order.shopifyOrderId,
        message: 'Order already synced to Shopify' 
      });
    }

    // Parse shipping address
    let shippingAddress: any = {};
    try {
      shippingAddress = order.shippingAddress ? JSON.parse(order.shippingAddress) : {};
    } catch {
      shippingAddress = {};
    }

    // Resolve Shopify customer
    let shopifyCustomerId = order.customer?.shopifyId;

    if (!shopifyCustomerId || shopifyCustomerId.startsWith('temp_') || shopifyCustomerId.startsWith('google_')) {
      // Create a new Shopify customer
      try {
        const customerName = order.customer?.name || 'App User';
        const nameParts = customerName.split(' ');
        const shopifyCustomer = await createCustomer({
          first_name: nameParts[0] || 'App',
          last_name: nameParts.slice(1).join(' ') || 'User',
          email: order.customer?.email || '',
          phone: order.customer?.phone || '',
          verified_email: true,
          addresses: shippingAddress.street ? [{
            address1: shippingAddress.street || shippingAddress.address1 || '',
            city: shippingAddress.city || '',
            province: shippingAddress.state || shippingAddress.province || '',
            zip: shippingAddress.zip || '',
            country: shippingAddress.country || 'India',
            default: true,
          }] : [],
        });

        shopifyCustomerId = shopifyCustomer.id.toString();
        
        // Update local customer record
        if (order.customer) {
          await prisma.customer.update({
            where: { id: order.customer.id },
            data: { shopifyId: shopifyCustomerId },
          });
        }
      } catch (e) {
        console.error('[Sync] Shopify customer creation failed:', e);
        // Continue without customer — Shopify will create one
      }
    }

    // Build Shopify order payload
    const shopifyOrderPayload: any = {
      line_items: order.items.map((item: any) => {
        // Mobile app stores Shopify variant id as `sku: variant:<id>` for later sync.
        const sku = item.sku || '';
        const m = sku.match(/variant:(\d+)/i);
        if (m?.[1]) {
          return {
            variant_id: parseInt(m[1], 10),
            quantity: item.quantity,
          };
        }
        // Fallback: create custom item (not ideal, but keeps admin unblocked).
        return {
          title: item.title,
          quantity: item.quantity,
          price: item.price.toFixed(2),
          requires_shipping: true,
        };
      }),
      email: order.customer?.email || '',
      financial_status: order.paymentStatus === 'paid' ? 'paid' : 'pending',
      note: `Synced from Admin Dashboard | Payment: ${order.paymentMethod || 'Unknown'} | InternalOrderId: ${order.id}`,
      tags: `mobile-app, SyncedFromAdmin, zb-order-${order.internalOrderNumber}, ${order.tags || ''}`.replace(/\s+/g, ' ').trim(),
      note_attributes: [
        { name: 'internal_order_number', value: order.internalOrderNumber || '' }
      ],
      total_tax: 0,
      currency: order.currency || 'INR',
    };

    // Add customer
    if (shopifyCustomerId && !shopifyCustomerId.startsWith('temp_') && !shopifyCustomerId.startsWith('google_')) {
      shopifyOrderPayload.customer = { id: parseInt(shopifyCustomerId) };
    }

    // Add shipping address
    if (shippingAddress.name || shippingAddress.street || shippingAddress.address1) {
      const nameParts = (shippingAddress.name || order.customer?.name || '').split(' ');
      shopifyOrderPayload.shipping_address = {
        first_name: nameParts[0] || 'App',
        last_name: nameParts.slice(1).join(' ') || 'User',
        address1: shippingAddress.street || shippingAddress.address1 || '',
        city: shippingAddress.city || '',
        province: shippingAddress.state || shippingAddress.province || '',
        zip: shippingAddress.zip || '',
        country: shippingAddress.country || 'India',
      };
      shopifyOrderPayload.billing_address = shopifyOrderPayload.shipping_address;
    }

    // Create order in Shopify
    const shopifyOrder = await createOrder(shopifyOrderPayload);

    // Update local order with Shopify ID, sync status, and approve it
    await prisma.order.update({
      where: { id: orderId },
      data: { 
        shopifyOrderId: shopifyOrder.id.toString(),
        shopifyOrderName: shopifyOrder.name,
        shopifySyncStatus: 'synced',
        shopifySyncError: null,
        status: order.status === 'payment_pending' ? 'approved' : order.status,
        tags: `AppOrder, MobileApp, Synced, ${order.paymentMethod || 'Razorpay'}`
      },
    });

    return NextResponse.json({ 
      success: true, 
      shopifyOrderId: shopifyOrder.id.toString(),
      shopifyOrderName: shopifyOrder.name,
    });

  } catch (error: any) {
    console.error('[Sync] Shopify sync error:', error);
    
    // Save error in DB
    try {
      await prisma.order.update({
        where: { id: params.id },
        data: {
          shopifySyncStatus: 'failed',
          shopifySyncError: error.message || 'Unknown sync error'
        }
      });
    } catch (dbErr) {
      console.error('[Sync] Failed to update sync error in DB:', dbErr);
    }

    return NextResponse.json(
      { success: false, error: error.message || 'Sync failed' },
      { status: 500 }
    );
  }
}
