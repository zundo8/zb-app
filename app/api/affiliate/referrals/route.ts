import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getAuthenticatedCustomer } from '../auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const customer = await getAuthenticatedCustomer(req);
  if (!customer) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const affiliate = await prisma.affiliate.findUnique({
      where: { customerId: customer.id },
      select: { id: true, status: true },
    });

    if (!affiliate || affiliate.status !== 'APPROVED') {
      return NextResponse.json({ error: 'Affiliate account not approved' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const cursor = searchParams.get('cursor');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 50);

    // Cursor-based, indexed pagination on [affiliateId, status, createdAt]
    const referrals = await prisma.affiliateReferral.findMany({
      where: { affiliateId: affiliate.id },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { createdAt: 'desc' },
      include: {
        order: {
          select: {
            internalOrderNumber: true,
            shopifyOrderId: true,
            createdAt: true,
          },
        },
      },
    });

    let nextCursor: string | null = null;
    if (referrals.length > limit) {
      const nextItem = referrals.pop();
      nextCursor = nextItem ? nextItem.id : null;
    }

    // Masked, sanitized for creator privacy (no customer PII)
    const sanitizedReferrals = referrals.map((ref: any) => {
      const displayOrderNumber =
        ref.order.internalOrderNumber ||
        (ref.order.shopifyOrderId ? `#${ref.order.shopifyOrderId}` : `#ZB${ref.orderId.slice(-5).toUpperCase()}`);

      return {
        id: ref.id,
        orderNumber: displayOrderNumber,
        orderTotal: ref.orderTotal,
        eligibleAmount: ref.eligibleAmount,
        commissionRate: ref.commissionRate,
        commissionAmount: ref.commissionAmount,
        status: ref.status,
        confirmedAt: ref.confirmedAt,
        createdAt: ref.createdAt,
      };
    });

    return NextResponse.json({
      referrals: sanitizedReferrals,
      nextCursor,
    });
  } catch (error: any) {
    console.error('[Affiliate Referrals] Error fetching referrals feed:', error);
    return NextResponse.json({ error: 'Failed to fetch referrals' }, { status: 500 });
  }
}
