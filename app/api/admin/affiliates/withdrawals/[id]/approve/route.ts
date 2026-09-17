import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { requireAdmin, handleAuthError } from '@/lib/auth/rbac';
import { logAudit } from '@/lib/audit';
import { executePayout } from '@/lib/affiliate/payout';
import { triggerAffiliateEvent } from '@/lib/affiliate/pusher';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireAdmin('AFFILIATES' as any, 'edit');
    const { id } = params;
    const adminUserId = (session.user as any)?.id;

    const withdrawal = await prisma.affiliateWithdrawal.findUnique({
      where: { id },
      include: { affiliate: true },
    });

    if (!withdrawal) {
      return NextResponse.json({ error: 'Withdrawal record not found' }, { status: 404 });
    }

    if (withdrawal.status !== 'REQUESTED') {
      return NextResponse.json({ error: `Withdrawal is already in ${withdrawal.status} status` }, { status: 400 });
    }

    // Execute payout (calls RazorpayX or safely falls back to manual)
    const payoutResult = await executePayout(withdrawal.id);

    const targetStatus = payoutResult.provider === 'razorpayx' ? 'PROCESSING' : 'APPROVED';

    const updated = await prisma.affiliateWithdrawal.update({
      where: { id },
      data: {
        status: targetStatus,
        reviewedByUserId: adminUserId,
        reviewedAt: new Date(),
        payoutProvider: payoutResult.provider,
        payoutRef: payoutResult.payoutRef || null,
      },
    });

    // Audit log
    await logAudit({
      action: 'AFFILIATE_WITHDRAWAL_APPROVE',
      module: 'AFFILIATES',
      targetId: id,
      metadata: {
        adminUserId,
        affiliateId: withdrawal.affiliateId,
        amount: withdrawal.amount,
        payoutProvider: payoutResult.provider,
        status: targetStatus,
      },
      ipAddress: req.headers.get('x-forwarded-for') || undefined,
      userAgent: req.headers.get('user-agent') || undefined,
    });

    // Notify creator
    triggerAffiliateEvent(withdrawal.affiliateId, 'withdrawal_update', {
      withdrawalId: id,
      status: targetStatus,
      amount: withdrawal.amount,
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      message: payoutResult.requiresManualUTR
        ? 'Withdrawal approved. Awaiting manual transfer and UTR entry.'
        : 'Payout initiated through RazorpayX.',
      withdrawal: updated,
      requiresManualUTR: payoutResult.requiresManualUTR,
    });
  } catch (error: any) {
    return handleAuthError(error);
  }
}
