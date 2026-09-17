import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getAuthenticatedCustomer } from '../auth';
import { AFFILIATE_CONFIG } from '@/lib/affiliate/config';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const customer = await getAuthenticatedCustomer(req);
  if (!customer) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const affiliate = await prisma.affiliate.findUnique({
      where: { customerId: customer.id },
      include: {
        links: {
          where: { targetType: 'STORE' },
          take: 1,
          select: { slug: true, destination: true },
        },
        payoutAccounts: {
          where: { isDefault: true },
          take: 1,
          select: { id: true, method: true, last4: true, bankName: true, isVerified: true },
        },
      },
    });

    if (!affiliate) {
      return NextResponse.json({
        isAffiliate: false,
      });
    }

    const host = req.headers.get('host') || 'zicabella.com';
    const proto = req.headers.get('x-forwarded-proto') || 'https';
    const siteUrl = `${proto}://${host}`;

    const primarySlug = affiliate.links[0]?.slug || affiliate.code.toLowerCase();
    const primaryUrl = `${siteUrl}/r/${primarySlug}`;

    const conversionRate = affiliate.totalClicks > 0
      ? Math.round((affiliate.totalConversions / affiliate.totalClicks) * 1000) / 10
      : 0;

    return NextResponse.json({
      isAffiliate: true,
      affiliate: {
        id: affiliate.id,
        code: affiliate.code,
        displayName: affiliate.displayName,
        status: affiliate.status,
        commissionRate: affiliate.commissionRate,
        appliedAt: affiliate.appliedAt,
        approvedAt: affiliate.approvedAt,
        rejectedReason: affiliate.rejectedReason,

        // Cached KPI counters (high-speed, zero scan)
        totalClicks: affiliate.totalClicks,
        totalConversions: affiliate.totalConversions,
        conversionRate,
        totalRevenue: affiliate.totalRevenue,
        pendingEarnings: affiliate.pendingEarnings,
        availableBalance: affiliate.availableBalance,
        lifetimeEarnings: affiliate.lifetimeEarnings,
        paidOut: affiliate.paidOut,
        firstWithdrawalDone: affiliate.firstWithdrawalDone,

        // Thresholds
        minFirstWithdrawal: AFFILIATE_CONFIG.MIN_FIRST_WITHDRAWAL,
        minWithdrawal: AFFILIATE_CONFIG.MIN_WITHDRAWAL,

        primaryLink: {
          slug: primarySlug,
          url: primaryUrl,
        },
        hasPayoutAccount: affiliate.payoutAccounts.length > 0,
        defaultPayoutAccount: affiliate.payoutAccounts[0] || null,
      },
    });
  } catch (error: any) {
    console.error('[Affiliate Me] Error fetching affiliate profile:', error);
    return NextResponse.json({ error: 'Failed to fetch affiliate profile' }, { status: 500 });
  }
}
