import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { createCustomer, createOrder } from '@/lib/shopify-admin';

export const dynamic = 'force-dynamic';

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  try {
    const order = await prisma.order.findUnique({
      where: { id: params.id },
      include: { customer: true, items: true },
    });
    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

    // Update DB authority first
    const updated = await prisma.order.update({
      where: { id: order.id },
      data: { status: 'approved' },
      select: { id: true, status: true, tags: true },
    });

    // Shopify sync is downstream + retryable. We attempt now but never block approval.
    let shopify: { success: boolean; shopifyOrderId?: string; error?: string } | null = null;
    try {
      // If already synced (numeric Shopify order id), skip.
      if (order.shopifyOrderId && /^\d+$/.test(String(order.shopifyOrderId))) {
        shopify = { success: true, shopifyOrderId: String(order.shopifyOrderId) };
      } else {
        // Parse shipping address saved by mobile create route
        let shippingAddress: any = {};
        try {
          shippingAddress = order.shippingAddress ? JSON.parse(order.shippingAddress) : {};
        } catch {
          shippingAddress = {};
        }

        // Resolve Shopify customer (best-effort)
        let shopifyCustomerId = order.customer?.shopifyId;
        if (!shopifyCustomerId || shopifyCustomerId.startsWith('temp_') || shopifyCustomerId.startsWith('google_') || shopifyCustomerId.startsWith('mobile_') || shopifyCustomerId.startsWith('otp_')) {
          try {
            const customerName = order.customer?.name || shippingAddress?.name || 'App User';
            const nameParts = String(customerName).split(' ');
            const createdCustomer = await createCustomer({
              first_name: nameParts[0] || 'App',
              last_name: nameParts.slice(1).join(' ') || 'User',
              email: order.customer?.email || shippingAddress?.email || '',
              phone: order.customer?.phone || shippingAddress?.phone || '',
              verified_email: true,
              addresses: shippingAddress?.line1
                ? [
                    {
                      address1: shippingAddress.line1 || '',
                      address2: shippingAddress.line2 || '',
                      city: shippingAddress.city || '',
                      province: shippingAddress.state || '',
                      zip: shippingAddress.pincode || '',
                      country: shippingAddress.country || 'India',
                      default: true,
                    },
                  ]
                : [],
            });
            shopifyCustomerId = String(createdCustomer.id);
            if (order.customer?.id) {
              await prisma.customer.update({ where: { id: order.customer.id }, data: { shopifyId: shopifyCustomerId } });
            }
          } catch (e) {
            console.error('[Admin] approve: customer sync failed:', e);
          }
        }

        const orderNumber =
          String(order.tags || '').match(/zb-order-(ZB-\d+)/i)?.[1]?.toUpperCase() ||
          String(order.shopifyOrderId || '').replace(/^#/, '') ||
          order.id;

        const shopifyOrderPayload: any = {
          line_items: order.items.map((item) => {
            const sku = item.sku || '';
            const m = sku.match(/variant:(\d+)/i);
            if (m?.[1]) return { variant_id: parseInt(m[1], 10), quantity: item.quantity };
            return { title: item.title, quantity: item.quantity, price: item.price.toFixed(2), requires_shipping: true };
          }),
          financial_status: String(order.paymentStatus || '').toLowerCase() === 'paid' ? 'paid' : 'pending',
          tags: `mobile-app, zb-order-${orderNumber}, ${order.paymentMethod || ''}`.replace(/\s+/g, ' ').trim(),
          note: `mobile-app | InternalOrderId: ${order.id} | Payment: ${order.paymentMethod || 'Unknown'}`,
          currency: order.currency || 'INR',
        };

        if (shopifyCustomerId && /^\d+$/.test(String(shopifyCustomerId))) {
          shopifyOrderPayload.customer = { id: parseInt(String(shopifyCustomerId), 10) };
        }

        if (shippingAddress?.name || shippingAddress?.line1) {
          const nameParts = String(shippingAddress.name || order.customer?.name || '').split(' ');
          shopifyOrderPayload.shipping_address = {
            first_name: nameParts[0] || 'App',
            last_name: nameParts.slice(1).join(' ') || 'User',
            address1: shippingAddress.line1 || '',
            address2: shippingAddress.line2 || '',
            city: shippingAddress.city || '',
            province: shippingAddress.state || '',
            zip: shippingAddress.pincode || '',
            country: shippingAddress.country || 'India',
            phone: shippingAddress.phone || order.customer?.phone || '',
          };
          shopifyOrderPayload.billing_address = shopifyOrderPayload.shipping_address;
        }

        const createdOrder = await createOrder(shopifyOrderPayload);

        await prisma.order.update({
          where: { id: order.id },
          data: {
            shopifyOrderId: String(createdOrder.id),
            tags: `${order.tags || ''}, synced`.replace(/\s+/g, ' ').trim(),
          },
        });

        shopify = { success: true, shopifyOrderId: String(createdOrder.id) };
      }
    } catch (e: any) {
      shopify = { success: false, error: e?.message || 'Sync failed' };
    }

    // Push notification (non-blocking)
    try {
      const orderNumber = String(order.tags || '').match(/zb-order-(ZB-\d+)/i)?.[1]?.toUpperCase() || 'your order';
      const { NotificationService } = await import('@/lib/services/notification.service');
      await NotificationService.sendToUser(
        order.customerId,
        'Zica Bella Order Update',
        `Your order ${orderNumber} has been approved!`,
        { orderId: order.id, status: 'approved' }
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

