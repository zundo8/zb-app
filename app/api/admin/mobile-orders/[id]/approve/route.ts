import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { syncOrderToShopify } from '@/lib/services/shopifyOrderSyncService';

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

    // Shopify sync is downstream + retryable via the single choke point
    let shopify: { success: boolean; shopifyOrderId?: string; error?: string } | null = null;
    try {
      if (mobileOrder.shopifyOrderId && /^\d+$/.test(String(mobileOrder.shopifyOrderId))) {
        shopify = { success: true, shopifyOrderId: String(mobileOrder.shopifyOrderId) };
      } else {
        // Ensure corresponding standard local Order exists
        let localOrder = await prisma.order.findFirst({
          where: {
            OR: [
              { internalOrderNumber: mobileOrder.orderNumber },
              ...(mobileOrder.shopifyOrderId ? [{ shopifyOrderId: mobileOrder.shopifyOrderId }] : []),
            ],
          },
        });

        if (!localOrder) {
          const orderLineItems = mobileOrder.items.map((item: any, index: number) => ({
            shopifyLineItemId: `synced_${mobileOrder.id}_${index}_${Date.now()}`,
            title: item.title,
            quantity: item.quantity,
            price: item.price,
            sku: item.sku,
            productId: item.productId,
          }));

          localOrder = await prisma.order.create({
            data: {
              shopId: mobileOrder.customer.shopId,
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
              tags: `AppOrder, MobileApp, zb-order-${mobileOrder.orderNumber}`,
              internalOrderNumber: mobileOrder.orderNumber,
              orderType: 'APP',
              shopifySyncStatus: 'pending',
              items: {
                create: orderLineItems,
              },
            },
          });
        }

        const syncRes = await syncOrderToShopify(localOrder.id, { preserveAppTags: true });
        if (syncRes.success && syncRes.shopifyOrderId) {
          await prisma.mobileOrder.update({
            where: { id: mobileOrder.id },
            data: {
              shopifyOrderId: syncRes.shopifyOrderId,
              status: 'synced',
              syncedAt: new Date(),
              tags: `${mobileOrder.tags || ''}, synced`.replace(/\s+/g, ' ').trim(),
            },
          });
          shopify = { success: true, shopifyOrderId: syncRes.shopifyOrderId };
        } else {
          shopify = { success: false, error: syncRes.error || 'Sync failed' };
        }
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

