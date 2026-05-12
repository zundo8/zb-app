import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const limitRaw = url.searchParams.get('limit');
    const limit = limitRaw ? Math.max(1, Math.min(100, parseInt(limitRaw, 10) || 50)) : 50;

    const abandoned = url.searchParams.get('abandoned') === 'true';
    console.log('[Admin] Fetching mobile orders, abandoned:', abandoned);

    const where: any = {
      OR: [
        { tags: { contains: 'mobile-app', mode: 'insensitive' } },
        { tags: { contains: 'AppOrder', mode: 'insensitive' } },
        { tags: { contains: 'App', mode: 'insensitive' } },
        { note: { contains: 'Mobile app order', mode: 'insensitive' } },
        { note: { contains: 'App order', mode: 'insensitive' } },
        { shopifyOrderId: { contains: 'ZB71', mode: 'insensitive' } },
        { orderType: 'MOBILE_APP' },
      ],
    };

    if (abandoned) {
      where.paymentStatus = { notIn: ['paid', 'authorized'] };
      where.paymentMethod = { not: 'COD' };
    } else {
      where.AND = [
        { OR: [{ paymentMethod: 'COD' }, { paymentStatus: { in: ['paid', 'authorized'] } }] }
      ];
    }

    console.log('[Admin] Mobile orders query:', JSON.stringify(where, null, 2));

    const orders = await prisma.order.findMany({
      where,
      include: {
        items: {
          include: {
            product: { select: { featuredImage: true, title: true } }
          }
        },
        customer: { select: { id: true, name: true, email: true, phone: true } },
        shipments: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return NextResponse.json({
      orders: orders.map((o: any) => {
        const latestShipment = o.shipments?.[0];
        const orderNumber =
          String(o.tags || '').match(/zb-order-(ZB[71\d-]+)/i)?.[1]?.toUpperCase() ||
          String(o.shopifyOrderId || '').replace(/^#/, '') ||
          o.id;

        let shippingAddress: any = null;
        try {
          shippingAddress = o.shippingAddress ? JSON.parse(o.shippingAddress) : null;
        } catch {
          shippingAddress = null;
        }

        const paymentMethod = String(o.paymentMethod || '').toUpperCase().includes('COD') ? 'COD' : 'PREPAID';

        return {
          id: o.id,
          orderNumber,
          createdAt: o.createdAt,
          status: o.status,
          paymentMethod,
          paymentStatus: o.paymentStatus,
          fulfillmentStatus: o.fulfillmentStatus,
          deliveryStatus: o.deliveryStatus,
          totalPrice: o.totalPrice,
          currency: o.currency,
          shopifyOrderId: o.shopifyOrderId && /^\d+$/.test(String(o.shopifyOrderId)) ? o.shopifyOrderId : null,
          shippingAddress,
          customer: o.customer,
          items: o.items.map((item: any) => ({
            ...item,
            image: item.image || item.product?.featuredImage || null,
            title: item.title || item.product?.title || 'Unknown Product',
          })),
          tracking: latestShipment
            ? {
                awb: latestShipment.awb || latestShipment.trackingNumber || null,
                carrier: latestShipment.courier || null,
              }
            : null,
        };
      }),
    });
  } catch (e: any) {
    console.error('[Admin] mobile-orders error:', e);
    return NextResponse.json({ error: e?.message || 'Internal server error', orders: [] }, { status: 500 });
  }
}

