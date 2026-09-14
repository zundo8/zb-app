import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { createOrder } from '@/lib/shopify-admin';

export const dynamic = 'force-dynamic';

/**
 * Cron worker: /api/cron/sync-failed-shopify-orders
 * Retries syncing orders that failed to sync to Shopify.
 * Runs in batches of 10, ordered by createdAt ASC to prevent starvation.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const secret = searchParams.get('secret');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.error('[Sync Failed Orders Cron] CRON_SECRET is not configured in environment.');
    return NextResponse.json({ error: 'Unauthorized (Config missing)' }, { status: 401 });
  }

  const authHeader = req.headers.get('Authorization');
  if (secret !== cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const failedOrders = await prisma.order.findMany({
      where: {
        shopifySyncStatus: 'failed',
        shopifyOrderId: null,
      },
      include: {
        customer: true,
        items: true,
      },
      orderBy: { createdAt: 'asc' },
      take: 10,
    });

    if (failedOrders.length === 0) {
      return NextResponse.json({ success: true, processed: 0, message: 'No failed orders to sync' });
    }

    const results: Array<{ id: string; success: boolean; shopifyOrderId?: string; error?: string }> = [];

    for (const order of failedOrders) {
      try {
        let shippingAddr: any = null;
        if (order.shippingAddress) {
          try {
            shippingAddr = typeof order.shippingAddress === 'string'
              ? JSON.parse(order.shippingAddress)
              : order.shippingAddress;
          } catch (_) {
            shippingAddr = null;
          }
        }

        const lineItems = (order.items || []).map((item: any) => {
          let variantIdNum: number | undefined;
          if (item.variantId) {
            const match = String(item.variantId).match(/(\d+)$/);
            if (match) variantIdNum = parseInt(match[1], 10);
          }
          return {
            title: item.title,
            quantity: item.quantity || 1,
            price: String(item.price),
            variant_id: variantIdNum || undefined,
            sku: item.sku || undefined,
          };
        });

        const isCod = (order.paymentMethod || '').toLowerCase() === 'cod' || (order.paymentMethod || '').toUpperCase() === 'CASH ON DELIVERY';
        const isPaid = (order.paymentStatus || '').toLowerCase() === 'paid';

        const shopifyOrderPayload: any = {
          line_items: lineItems,
          financial_status: isPaid ? 'paid' : (isCod ? 'pending' : 'pending'),
          email: order.customer?.email || undefined,
          phone: order.customer?.phone || shippingAddr?.phone || undefined,
          note: order.note || `Recovered sync from order ${order.id} (${order.internalOrderNumber || ''})`,
          tags: `recovered_sync, ${order.tags || ''}`.trim(),
        };

        if (shippingAddr) {
          const nameParts = String(shippingAddr.name || order.customer?.name || '').trim().split(/\s+/);
          const addressObj = {
            first_name: nameParts[0] || 'Customer',
            last_name: nameParts.slice(1).join(' ') || '',
            address1: shippingAddr.address1 || shippingAddr.line1 || '',
            address2: shippingAddr.address2 || shippingAddr.line2 || '',
            city: shippingAddr.city || '',
            province: shippingAddr.province || shippingAddr.state || '',
            zip: shippingAddr.zip || shippingAddr.pincode || '',
            country: shippingAddr.country || 'India',
            phone: shippingAddr.phone || order.customer?.phone || '',
          };
          shopifyOrderPayload.shipping_address = addressObj;
          shopifyOrderPayload.billing_address = addressObj;
        }

        if (isPaid && !isCod) {
          shopifyOrderPayload.transactions = [{
            kind: 'sale',
            status: 'success',
            amount: parseFloat(String(order.totalPrice || 0)).toFixed(2),
            currency: order.currency || 'INR',
            gateway: 'razorpay',
            authorization: order.razorpayPaymentId || order.razorpayOrderId || null,
          }];
        }

        const createdShopifyOrder = await createOrder(shopifyOrderPayload);
        const shopifyOrderId = String(createdShopifyOrder.id);

        await prisma.order.update({
          where: { id: order.id },
          data: {
            shopifyOrderId,
            shopifyOrderName: createdShopifyOrder.name,
            shopifySyncStatus: 'synced',
            shopifySyncError: null,
          },
        });

        results.push({ id: order.id, success: true, shopifyOrderId });
      } catch (orderErr: any) {
        console.error(`[Sync Failed Orders Cron] Failed to sync order ${order.id}:`, orderErr.message);
        await prisma.order.update({
          where: { id: order.id },
          data: {
            shopifySyncError: orderErr.message?.slice(0, 500),
          },
        }).catch(() => {});
        results.push({ id: order.id, success: false, error: orderErr.message });
      }
    }

    return NextResponse.json({
      success: true,
      processed: failedOrders.length,
      results,
    });
  } catch (err: any) {
    console.error('[Sync Failed Orders Cron] Top-level error:', err);
    return NextResponse.json({ error: 'Internal Server Error', message: err.message }, { status: 500 });
  }
}
