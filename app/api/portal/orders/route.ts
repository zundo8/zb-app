import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const email = url.searchParams.get('email');
    const phone = url.searchParams.get('phone');
    const shopDomain = url.searchParams.get('shopDomain');

    if ((!email && !phone) || !shopDomain) {
      return NextResponse.json({ error: 'Missing email/phone or shopDomain' }, { status: 400 });
    }

    const shop = await prisma.shop.findUnique({ where: { domain: shopDomain } });
    if (!shop) {
      return NextResponse.json({ error: 'Shop not found' }, { status: 404 });
    }

    const orders = await prisma.order.findMany({
      where: { 
        shopId: shop.id,
        customer: {
          OR: [
            email ? { email: email } : undefined,
            phone ? { phone: phone } : undefined
          ].filter((v): v is { email: string } | { phone: string } => !!v)
        },
        NOT: [
          { paymentStatus: { in: ['failed', 'cancelled', 'voided'] } },
          { status: { in: ['FAILED', 'CANCELLED', 'cancelled', 'payment_failed'] } }
        ]
      },
      include: {
        items: true,
        returns: true,
        exchanges: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return NextResponse.json({ success: true, orders }, { status: 200 });
  } catch (error) {
    console.error('Portal Orders API Error:', error);
    return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 });
  }
}
