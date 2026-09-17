import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { requireAdmin, handleAuthError } from '@/lib/auth/rbac';
import { AffiliateStatus } from '@prisma/client';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    await requireAdmin('AFFILIATES' as any, 'view');

    const { searchParams } = new URL(req.url);
    const statusParam = searchParams.get('status');
    const searchParam = searchParams.get('search')?.trim();
    const page = Math.max(parseInt(searchParams.get('page') || '1', 10), 1);
    const limit = Math.min(parseInt(searchParams.get('limit') || '25', 10), 100);
    const skip = (page - 1) * limit;

    // Filter by status if provided
    let statusFilter: AffiliateStatus | undefined = undefined;
    if (statusParam && Object.values(AffiliateStatus).includes(statusParam as AffiliateStatus)) {
      statusFilter = statusParam as AffiliateStatus;
    }

    // Exact indexed search conditions (no LIKE/ILIKE full-table scans)
    const where: any = {};
    if (statusFilter) {
      where.status = statusFilter;
    }

    if (searchParam) {
      const cleanUpper = searchParam.toUpperCase();
      const cleanEmail = searchParam.toLowerCase();
      const digits = searchParam.replace(/\D/g, '').slice(-10);

      where.OR = [
        { code: cleanUpper },
        { customer: { email: cleanEmail } },
        ...(digits.length === 10 ? [{ customer: { phoneLast10: digits } }] : []),
      ];
    }

    // Fetch paginated affiliates using indexed order
    const [affiliates, totalCount] = await Promise.all([
      prisma.affiliate.findMany({
        where,
        include: {
          customer: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
            },
          },
          payoutAccounts: {
            where: { isDefault: true },
            take: 1,
            select: {
              id: true,
              method: true,
              accountHolderName: true,
              bankName: true,
              last4: true,
              isVerified: true,
            },
          },
          _count: {
            select: {
              referrals: true,
              links: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.affiliate.count({ where }),
    ]);

    // KPI Summary Metrics (aggregated efficiently)
    const [totalApproved, totalPending, totalSuspended, totals] = await Promise.all([
      prisma.affiliate.count({ where: { status: 'APPROVED' } }),
      prisma.affiliate.count({ where: { status: 'PENDING' } }),
      prisma.affiliate.count({ where: { status: 'SUSPENDED' } }),
      prisma.affiliate.aggregate({
        _sum: {
          totalClicks: true,
          totalConversions: true,
          totalRevenue: true,
          pendingEarnings: true,
          availableBalance: true,
          paidOut: true,
        },
      }),
    ]);

    const metrics = {
      totalCreators: totalCount,
      approvedCreators: totalApproved,
      pendingApplications: totalPending,
      suspendedCreators: totalSuspended,
      totalClicks: totals._sum.totalClicks || 0,
      totalConversions: totals._sum.totalConversions || 0,
      totalRevenue: totals._sum.totalRevenue || 0,
      pendingEarnings: totals._sum.pendingEarnings || 0,
      availableBalance: totals._sum.availableBalance || 0,
      totalPaidOut: totals._sum.paidOut || 0,
    };

    return NextResponse.json({
      affiliates,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
      metrics,
    });
  } catch (error: any) {
    return handleAuthError(error);
  }
}
