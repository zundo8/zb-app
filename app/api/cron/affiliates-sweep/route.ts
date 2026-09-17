import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { confirmDueReferrals } from '@/lib/affiliate/earnings';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const secret = searchParams.get('secret');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && secret !== cronSecret && req.headers.get('Authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // 1. Confirm due referrals whose hold window has elapsed on delivered orders
    const sweepResult = await confirmDueReferrals(100);

    // 2. Defensive reconciliation pass: check if any active affiliate's balance has drifted from ledger
    const activeAffiliates = await prisma.affiliate.findMany({
      where: {
        status: 'APPROVED',
        availableBalance: { gt: 0 },
      },
      select: {
        id: true,
        code: true,
        availableBalance: true,
        ledger: {
          select: {
            amount: true,
            type: true,
          },
        },
      },
      take: 20,
      orderBy: { updatedAt: 'desc' },
    });

    const discrepancies: any[] = [];
    for (const aff of activeAffiliates) {
      const ledgerSum = Math.round(aff.ledger.reduce((acc: number, entry: any) => acc + entry.amount, 0) * 100) / 100;
      const cachedBalance = Math.round(aff.availableBalance * 100) / 100;

      if (Math.abs(ledgerSum - cachedBalance) > 0.05) {
        discrepancies.push({
          affiliateId: aff.id,
          code: aff.code,
          cachedBalance,
          ledgerSum,
          diff: Math.round((cachedBalance - ledgerSum) * 100) / 100,
        });
        console.warn(`[Affiliate Cron] Balance drift detected for affiliate ${aff.code}: cached=₹${cachedBalance}, ledger=₹${ledgerSum}`);
      }
    }

    // 3. Log heartbeat ping to SyncLog
    try {
      await prisma.syncLog.create({
        data: {
          orderId: 'system',
          action: 'CRON_AFFILIATES_SWEEP',
          status: 'SUCCESS',
          payload: JSON.stringify({
            confirmedCount: sweepResult.confirmedCount,
            processedCount: sweepResult.processedCount,
            discrepancyCount: discrepancies.length,
          }),
        },
      });
    } catch (logErr: any) {
      console.warn('[Affiliate Cron] Could not write to sync log:', logErr.message);
    }

    return NextResponse.json({
      success: true,
      sweep: sweepResult,
      reconciliation: {
        auditedCount: activeAffiliates.length,
        discrepancyCount: discrepancies.length,
        discrepancies,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[Affiliate Cron] Error during affiliate sweep:', error);
    return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 });
  }
}
