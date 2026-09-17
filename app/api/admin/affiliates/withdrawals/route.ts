import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { requireAdmin, handleAuthError } from '@/lib/auth/rbac';
import { AffiliateWithdrawalStatus } from '@prisma/client';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    await requireAdmin('AFFILIATES' as any, 'view');

    const { searchParams } = new URL(req.url);
    const statusParam = searchParams.get('status');
    const page = Math.max(parseInt(searchParams.get('page') || '1', 10), 1);
    const limit = Math.min(parseInt(searchParams.get('limit') || '25', 10), 100);
    const skip = (page - 1) * limit;

    const where: any = {};
    if (statusParam && Object.values(AffiliateWithdrawalStatus).includes(statusParam as AffiliateWithdrawalStatus)) {
      where.status = statusParam as AffiliateWithdrawalStatus;
    }

    const [withdrawals, totalCount] = await Promise.all([
      prisma.affiliateWithdrawal.findMany({
        where,
        include: {
          affiliate: {
            select: {
              id: true,
              code: true,
              displayName: true,
              availableBalance: true,
              firstWithdrawalDone: true,
              customer: {
                select: {
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
            },
          },
        },
        orderBy: { requestedAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.affiliateWithdrawal.count({ where }),
    ]);

    return NextResponse.json({
      withdrawals,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    });
  } catch (error: any) {
    return handleAuthError(error);
  }
}
