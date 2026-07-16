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
          tags: `mobile-app, zb-order-${mobileOrder.orderNumber}, ${String(mobileOrder.paymentMethod || '').toUpperCase() === 'COD' ? 'COD' : 'Prepaid, Razorpay'}, ${mobileOrder.paymentMethod || ''}, SyncedFromAdminDetail`.replace(/\s+/g, ' ').trim(),
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

        // Add transactions for prepaid orders so Shopify records the correct gateway
        if (String(mobileOrder.paymentStatus || '').toLowerCase() === 'paid' && String(mobileOrder.paymentMethod || '').toUpperCase() !== 'COD') {
          shopifyOrderPayload.transactions = [{
            kind: "sale",
            status: "success",
            amount: parseFloat(String(mobileOrder.totalAmount || 0)).toFixed(2),
            currency: mobileOrder.currency || "INR",
            gateway: "razorpay",
            authorization: mobileOrder.paymentId || null
          }];
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

    // If already synced to Shopify, pull updates from Shopify to refresh the local record
    if (order.shopifyOrderId && !order.shopifyOrderId.startsWith('local_') && !order.shopifyOrderId.startsWith('app_') && !order.shopifyOrderId.startsWith('app_pending_')) {
      try {
        const { fetchOrder } = await import('@/lib/shopify-admin');
        const o = await fetchOrder(order.shopifyOrderId);
        if (!o) {
          return NextResponse.json({ success: false, error: 'Shopify order not found for pulling updates' }, { status: 404 });
        }

        // Determine delivery status
        let deliveryStatus = 'pending';
        const lowerTags = (o.tags || '').toLowerCase();
        
        if (o.fulfillment_status === 'fulfilled') {
          deliveryStatus = 'shipped';
        }

        if (lowerTags.includes('delivered') || lowerTags.includes('shipped_successfully')) {
          deliveryStatus = 'delivered';
        }
        
        if (o.fulfillments && Array.isArray(o.fulfillments)) {
          for (const f of o.fulfillments) {
            const fStatus = (f.shipment_status || '').toLowerCase();
            if (fStatus === 'delivered' || fStatus === 'shipped' || fStatus === 'success') {
              deliveryStatus = 'delivered';
              break;
            } else if (fStatus === 'out_for_delivery') {
              deliveryStatus = 'out_for_delivery';
              break;
            }
          }
        }

        const isMobileAppOrder = lowerTags.includes('apporder') || lowerTags.includes('mobileapp') || order.orderType === 'MOBILE_APP';
        let finalStatus = isMobileAppOrder ? 'approved' : 'active';
        
        if (o.cancelled_at) {
          finalStatus = 'cancelled';
          deliveryStatus = 'cancelled';
          o.fulfillment_status = 'cancelled';
        }

        // Resolve WebStoreOrder if any
        const tagsArray = (o.tags || '').split(',').map((t: string) => t.trim());
        const orderNumberTag = tagsArray.find((t: string) => t.startsWith('zb-order-'));
        const universalOrderNumber = orderNumberTag ? orderNumberTag.replace('zb-order-', '') : null;

        let webStoreOrder = null;
        if (universalOrderNumber) {
          webStoreOrder = await prisma.webStoreOrder.findUnique({
            where: { orderNumber: universalOrderNumber }
          });
        }
        if (!webStoreOrder) {
          webStoreOrder = await prisma.webStoreOrder.findFirst({
            where: {
              OR: [
                { razorpayOrderId: String(o.id) },
                { notes: { contains: `Shopify: ${o.id}` } }
              ]
            }
          });
        }

        // Resolve canonical payment method and status
        let derivedPaymentMethod = 'razorpay';
        let derivedPaymentStatus = o.financial_status || 'pending';

        if (webStoreOrder) {
          derivedPaymentMethod = webStoreOrder.paymentMethod;
          derivedPaymentStatus = webStoreOrder.paymentStatus;
        } else {
          const gatewayNames = (o.payment_gateway_names || []).map((g: any) => String(g).toLowerCase());
          const rawGateway = String(o.gateway || '').toLowerCase();
          const hasCodGateway = gatewayNames.includes('manual') || 
            gatewayNames.includes('cod') || 
            gatewayNames.includes('cash on delivery (cod)') || 
            rawGateway === 'manual' || 
            rawGateway === 'cod' || 
            rawGateway.includes('cash on delivery');

          const isCodOrder = hasCodGateway || 
            lowerTags.includes('cod') || 
            (o.note || '').toLowerCase().includes('cod');

          derivedPaymentMethod = isCodOrder ? 'COD' : 'razorpay';
          derivedPaymentStatus = isCodOrder ? 'pending' : (o.financial_status || 'pending');
        }

        const finalPaymentMethod = order.paymentMethod && 
          (order.paymentMethod === 'COD' || order.paymentMethod === 'razorpay')
          ? order.paymentMethod
          : derivedPaymentMethod;

        const finalPaymentStatus = webStoreOrder?.paymentMethod === 'razorpay' ? 'paid' : derivedPaymentStatus;

        // Update local Order record
        const updatedOrder = await prisma.order.update({
          where: { id: order.id },
          data: {
            status: finalStatus,
            totalPrice: parseFloat(o.total_price || '0'),
            subtotalPrice: o.subtotal_price ? parseFloat(o.subtotal_price) : null,
            totalTax: o.total_tax ? parseFloat(o.total_tax) : null,
            currency: o.currency || 'INR',
            paymentStatus: finalPaymentStatus,
            paymentMethod: finalPaymentMethod,
            fulfillmentStatus: o.fulfillment_status || 'unfulfilled',
            deliveryStatus: deliveryStatus,
            shippingAddress: o.shipping_address ? JSON.stringify(o.shipping_address) : null,
            billingAddress: o.billing_address ? JSON.stringify(o.billing_address) : null,
            note: o.note || null,
            tags: o.tags || null,
            razorpayOrderId: webStoreOrder?.razorpayOrderId || order.razorpayOrderId || null,
            razorpayPaymentId: webStoreOrder?.razorpayPaymentId || order.razorpayPaymentId || null,
            internalOrderNumber: webStoreOrder?.orderNumber || order.internalOrderNumber || universalOrderNumber || null,
          }
        });

        // Trigger refund logic if status became cancelled
        if (finalStatus === 'cancelled' && order.status !== 'cancelled') {
          try {
            const { processOrderRefund } = await import('@/lib/services/refundService');
            await processOrderRefund(order.id);
          } catch (refundErr) {
            console.error(`[Sync Detail POST] Refund failed:`, refundErr);
          }
        }

        // Delete old line items and upsert current ones
        const shopifyItemIds = o.line_items.map((item: any) => String(item.id));
        await prisma.orderItem.deleteMany({
          where: {
            orderId: order.id,
            shopifyLineItemId: { notIn: shopifyItemIds }
          }
        });

        // Cache products mapping for images
        const { fetchAllProducts } = await import('@/lib/shopify-admin');
        const productsRaw = await fetchAllProducts(50); // limit to 50 for quick single order sync
        const productImageMap = new Map<string, string>();
        productsRaw.forEach(p => {
          const img = p.image?.src || p.images?.[0]?.src;
          if (img) productImageMap.set(String(p.id), img);
        });

        await Promise.all(o.line_items.map(async (item: any) => {
          const shopifyProductId = item.product_id ? String(item.product_id) : null;
          let dbProductId = null;
          if (shopifyProductId) {
            const prod = await prisma.product.findUnique({ where: { shopifyProductId } });
            dbProductId = prod?.id || null;
          }
          const itemImage = shopifyProductId ? productImageMap.get(shopifyProductId) : null;

          await prisma.orderItem.upsert({
            where: { shopifyLineItemId: String(item.id) },
            create: {
              orderId: order.id,
              shopifyLineItemId: String(item.id),
              productId: dbProductId,
              title: item.title,
              quantity: item.quantity,
              price: parseFloat(item.price || '0'),
              sku: item.sku || null,
              image: itemImage || null,
            },
            update: {
              quantity: item.quantity,
              price: parseFloat(item.price || '0'),
              sku: item.sku || null,
              image: itemImage || null,
            }
          });
        }));

        return NextResponse.json({
          success: true,
          shopifyOrderId: order.shopifyOrderId,
          message: 'Local order successfully updated from Shopify',
          order: updatedOrder
        });

      } catch (err: any) {
        console.error('[Sync Detail POST] Error pulling updates from Shopify:', err);
        return NextResponse.json({ success: false, error: `Pull sync failed: ${err.message}` }, { status: 500 });
      }
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

        // Webstore checkout stores numeric variant ID or gid (e.g. gid://shopify/ProductVariant/123456)
        const rawId = sku.split('/').pop() || '';
        if (/^\d+$/.test(rawId)) {
          return {
            variant_id: parseInt(rawId, 10),
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
      send_receipt: false,
      send_fulfillment_receipt: false,
      financial_status: order.paymentMethod === 'COD' ? 'pending' : (order.paymentStatus === 'paid' ? 'paid' : 'pending'),
      note: order.paymentMethod === 'COD'
        ? `COD Order Synced from Admin Dashboard | Upfront Fee paid via Razorpay (Payment ID: ${order.razorpayPaymentId || 'N/A'})`
        : `Synced from Admin Dashboard | Payment: ${order.paymentMethod || 'Unknown'} | Razorpay Payment ID: ${order.razorpayPaymentId || 'N/A'} | InternalOrderId: ${order.id}`,
      tags: `WebStoreOrder, WebStore, ${order.paymentMethod === 'COD' ? 'COD' : 'Prepaid, Razorpay'}, SyncedFromAdmin, zb-order-${order.internalOrderNumber}, ${order.tags || ''}`.replace(/\s+/g, ' ').trim(),
      note_attributes: [
        { name: 'internal_order_number', value: order.internalOrderNumber || '' },
        { name: 'payment_method', value: order.paymentMethod === 'COD' ? 'COD' : 'PREPAID' },
        { name: 'razorpay_payment_id', value: order.razorpayPaymentId || '' }
      ],
      total_tax: 0,
      currency: order.currency || 'INR',
    };

    // Add transactions so Shopify records the actual paid amount
    if (order.paymentMethod !== 'COD' && order.paymentStatus === 'paid') {
      shopifyOrderPayload.transactions = [{
        kind: "sale",
        status: "success",
        amount: order.totalPrice.toFixed(2),
        currency: order.currency || "INR",
        gateway: "razorpay",
        authorization: order.razorpayPaymentId || null
      }];
    }

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
