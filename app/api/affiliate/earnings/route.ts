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
    const range = (searchParams.get('range') || '30d').toLowerCase();

    let days = 30;
    if (range === '7d') days = 7;
    else if (range === '90d') days = 90;
    else if (range === 'all') days = 365;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    // Time-bounded, indexed query on [affiliateId, status, createdAt]
    const referrals = await prisma.affiliateReferral.findMany({
      where: {
        affiliateId: affiliate.id,
        createdAt: { gte: startDate },
        status: { in: ['PENDING', 'CONFIRMED', 'PAID'] },
      },
      select: {
        commissionAmount: true,
        eligibleAmount: true,
        status: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    // Bucket by day (YYYY-MM-DD)
    const dailyMap = new Map<string, { date: string; earnings: number; revenue: number; conversions: number }>();

    // Pre-populate all days in range
    const cur = new Date(startDate);
    const today = new Date();
    while (cur <= today) {
      const key = cur.toISOString().split('T')[0];
      dailyMap.set(key, { date: key, earnings: 0, revenue: 0, conversions: 0 });
      cur.setDate(cur.getDate() + 1);
    }

    for (const ref of referrals) {
      const key = ref.createdAt.toISOString().split('T')[0];
      const entry = dailyMap.get(key) || { date: key, earnings: 0, revenue: 0, conversions: 0 };
      entry.earnings = Math.round((entry.earnings + ref.commissionAmount) * 100) / 100;
      entry.revenue = Math.round((entry.revenue + ref.eligibleAmount) * 100) / 100;
      entry.conversions += 1;
      dailyMap.set(key, entry);
    }

    const series = Array.from(dailyMap.values());

    return NextResponse.json({
      range,
      series,
    });
  } catch (error: any) {
    console.error('[Affiliate Earnings] Error fetching earnings series:', error);
    return NextResponse.json({ error: 'Failed to fetch earnings' }, { status: 500 });
  }
}
