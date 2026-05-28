import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { createCustomer, createOrder } from '@/lib/shopify-admin';

export const dynamic = 'force-dynamic';

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  try {
    const mobileOrder = await prisma.mobileOrder.findUnique({
      where: { id: params.id },
      include: { customer: true, items: true },
    });
    if (!mobileOrder) return NextResponse.json({ error: 'Mobile order not found' }, { status: 404 });

    // Update DB authority first
    const updated = await prisma.mobileOrder.update({
      where: { id: mobileOrder.id },
      data: { status: 'approved' },
      select: { id: true, status: true, tags: true },
    });

    // Shopify sync is downstream + retryable. We attempt now but never block approval.
    let shopify: { success: boolean; shopifyOrderId?: string; error?: string } | null = null;
    try {
      // If already synced (numeric Shopify order id), skip.
      if (mobileOrder.shopifyOrderId && /^\d+$/.test(String(mobileOrder.shopifyOrderId))) {
        shopify = { success: true, shopifyOrderId: String(mobileOrder.shopifyOrderId) };
      } else {
        // Parse shipping address saved by mobile create route
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
            console.error('[Admin] approve: customer sync failed:', e);
          }
        }

        const shopifyOrderPayload: any = {
          line_items: mobileOrder.items.map((item) => {
            const sku = item.sku || '';
            const m = sku.match(/variant:(\d+)/i);
            if (m?.[1]) return { variant_id: parseInt(m[1], 10), quantity: item.quantity };
            return { title: item.title, quantity: item.quantity, price: item.price.toFixed(2), requires_shipping: true };
          }),
          financial_status: String(mobileOrder.paymentStatus || '').toLowerCase() === 'paid' ? 'paid' : 'pending',
          tags: `mobile-app, zb-order-${mobileOrder.orderNumber}, ${mobileOrder.paymentMethod || ''}`.replace(/\s+/g, ' ').trim(),
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

        // Update mobile order status to synced
        await prisma.mobileOrder.update({
          where: { id: mobileOrder.id },
          data: {
            shopifyOrderId: String(createdOrder.id),
            status: 'synced',
            syncedAt: new Date(),
            tags: `${mobileOrder.tags || ''}, synced`.replace(/\s+/g, ' ').trim(),
          },
        });

        // ─── CREATE CORRESPONDING Shopify Order IN database "Order" TABLE ───
        const shopifyOrderId = String(createdOrder.id);
        const existingOrder = await prisma.order.findUnique({
          where: { shopifyOrderId }
        });

        if (!existingOrder) {
          const orderLineItems = mobileOrder.items.map((item, index) => ({
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
              status: String(mobileOrder.paymentStatus || '').toLowerCase() === 'paid' ? 'PAID' : 'PENDING',
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

        shopify = { success: true, shopifyOrderId: String(createdOrder.id) };
      }
    } catch (e: any) {
      shopify = { success: false, error: e?.message || 'Sync failed' };
    }

    // Push notification (non-blocking)
    try {
      const orderNumber = mobileOrder.orderNumber || 'your order';
      const { NotificationService } = await import('@/lib/services/notification.service');
      await NotificationService.sendToUser(
        mobileOrder.customerId,
        'Zica Bella Order Update',
        `Your order ${orderNumber} has been approved!`,
        { orderId: mobileOrder.id, status: 'approved' }
      );
    } catch (e) {
      console.error('[Admin] approve push failed:', e);
    }

    return NextResponse.json({ success: true, order: updated, shopify });
  } catch (e: any) {
    console.error('[Admin] mobile-orders approve error:', e);
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500 });
  }
}

