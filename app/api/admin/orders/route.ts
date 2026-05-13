import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const status = searchParams.get('status');
    const paymentStatus = searchParams.get('paymentStatus');
    const fulfillmentStatus = searchParams.get('fulfillmentStatus');
    const platform = searchParams.get('platform');
    const search = searchParams.get('search');

    const conditions: any[] = [];
    
    if (status && status !== 'any') {
      conditions.push({ status });
    }

    if (paymentStatus && paymentStatus !== 'any') {
      if (paymentStatus === 'failed') {
        conditions.push({ 
          OR: [
            { paymentStatus: 'failed' },
            { paymentStatus: 'voided' },
            { status: 'payment_failed' }
          ]
        });
      } else {
        conditions.push({ paymentStatus });
      }
    }

    if (fulfillmentStatus && fulfillmentStatus !== 'any') {
      conditions.push({ fulfillmentStatus });
    }

    if (platform === 'mobile') {
      conditions.push({
        OR: [
          { tags: { contains: 'mobile-app', mode: 'insensitive' } },
          { orderType: 'MOBILE_APP' }
        ]
      });
    } else if (platform === 'web') {
      conditions.push({
        AND: [
          { NOT: { tags: { contains: 'mobile-app', mode: 'insensitive' } } },
          { NOT: { orderType: 'MOBILE_APP' } }
        ]
      });
    }

    if (search) {
      conditions.push({
        OR: [
          { shopifyOrderId: { contains: search, mode: 'insensitive' } },
          { note: { contains: search, mode: 'insensitive' } },
          { customer: { name: { contains: search, mode: 'insensitive' } } },
          { customer: { email: { contains: search, mode: 'insensitive' } } },
          { customer: { phone: { contains: search, mode: 'insensitive' } } },
        ]
      });
    }

    const where = conditions.length > 0 ? { AND: conditions } : {};

    const orders = await prisma.order.findMany({
      where,
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          }
        },
        items: true,
        shipments: {
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });

    const total = await prisma.order.count({ where });

    return NextResponse.json({
      success: true,
      orders,
      total,
      hasMore: total > offset + limit
    });
  } catch (error: any) {
    console.error('[Admin Orders API] Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
