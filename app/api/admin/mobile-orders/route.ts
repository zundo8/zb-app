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

    const where: any = {};

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

    const [orders, total] = await Promise.all([
      prisma.mobileOrder.findMany({
        where,
        include: {
          items: {
            include: {
              product: { select: { featuredImage: true, title: true, handle: true } }
            }
          },
          customer: { select: { id: true, name: true, email: true, phone: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.mobileOrder.count({ where })
    ]);

    return NextResponse.json({
      success: true,
      total,
      hasMore: total > offset + limit,
      orders: orders.map((o: any) => {
        let shippingAddress: any = null;
        try {
          shippingAddress = o.shippingAddress ? JSON.parse(o.shippingAddress) : null;
        } catch {
          shippingAddress = null;
        }

        const paymentMethod = String(o.paymentMethod || '').toUpperCase().includes('COD') ? 'COD' : 'PREPAID';

        return {
          id: o.id,
          orderNumber: o.orderNumber,
          createdAt: o.createdAt,
          status: o.status,
          paymentMethod,
          paymentStatus: o.paymentStatus,
          fulfillmentStatus: o.fulfillmentStatus,
          deliveryStatus: o.deliveryStatus,
          totalPrice: o.totalPrice,
          currency: o.currency,
          shopifyOrderId: o.shopifyOrderId,
          shippingAddress,
          customer: o.customer,
          items: o.items.map((item: any) => ({
            ...item,
            image: item.image || item.product?.featuredImage || null,
            title: item.title || item.product?.title || 'Unknown Product',
            handle: item.product?.handle || null,
          })),
          tracking: null,
        };
      }),
    });
  } catch (e: any) {
    console.error('[Admin] mobile-orders error:', e);
    return NextResponse.json({ error: e?.message || 'Internal server error', orders: [] }, { status: 500 });
  }
}

