import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const offset = parseInt(url.searchParams.get('offset') || '0');

    const active = url.searchParams.get('active') === 'true';
    const abandoned = url.searchParams.get('abandoned') === 'true';

    // Base filters for all mobile orders
    const mobileIdentityFilters = [
      { tags: { contains: 'mobile-app', mode: 'insensitive' } },
      { tags: { contains: 'AppOrder', mode: 'insensitive' } },
      { tags: { contains: 'App', mode: 'insensitive' } },
      { note: { contains: 'Mobile app order', mode: 'insensitive' } },
      { note: { contains: 'App order', mode: 'insensitive' } },
      { orderType: 'MOBILE_APP' },
    ];

    const where: any = {
      OR: mobileIdentityFilters,
    };

    if (abandoned) {
      // Abandoned = NOT paid AND NOT COD AND NOT approved
      where.AND = [
        { status: { not: 'approved' } },
        { paymentStatus: { notIn: ['paid', 'authorized', 'success', 'PAID', 'SUCCESS'] } },
        { paymentMethod: { notIn: ['COD', 'cod'] } }
      ];
    } else if (active) {
      // Active = (Paid OR COD) AND NOT approved
      where.AND = [
        { status: { not: 'approved' } },
        {
          OR: [
            { paymentStatus: { in: ['paid', 'authorized', 'success', 'PAID', 'SUCCESS'] } },
            { paymentMethod: { in: ['COD', 'cod'] } }
          ]
        }
      ];
    }
    // If neither active nor abandoned is specified, it returns ALL mobile orders

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          items: {
            include: {
              product: { select: { featuredImage: true, title: true, handle: true } }
            }
          },
          customer: { select: { id: true, name: true, email: true, phone: true } },
          shipments: { orderBy: { createdAt: 'desc' }, take: 1 },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.order.count({ where })
    ]);

    return NextResponse.json({
      success: true,
      total,
      hasMore: total > offset + limit,
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
            handle: item.product?.handle || null,
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

