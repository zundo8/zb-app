import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/db';
import { requireAdmin, handleAuthError } from '@/lib/auth/rbac';
import { logAudit } from '@/lib/audit';
import { recordLedgerRelease } from '@/lib/affiliate/ledger';
import { triggerAffiliateEvent } from '@/lib/affiliate/pusher';

export const dynamic = 'force-dynamic';

const RejectWithdrawalSchema = z.object({
  reason: z.string().trim().min(2, 'A rejection reason is required').max(500),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireAdmin('AFFILIATES' as any, 'edit');
    const { id } = params;
    const adminUserId = (session.user as any)?.id;

    const rawBody = await req.json().catch(() => ({}));
    const parseResult = RejectWithdrawalSchema.safeParse(rawBody);
    if (!parseResult.success) {
      return NextResponse.json({ error: parseResult.error.issues[0]?.message || 'A rejection reason is required' }, { status: 400 });
    }

    const { reason } = parseResult.data;

    // Transactionally reject withdrawal and release ledger hold
    const updated = await prisma.$transaction(async (tx: any) => {
      const withdrawal = await tx.affiliateWithdrawal.findUnique({
        where: { id },
      });

      if (!withdrawal) {
        throw new Error('Withdrawal record not found');
      }

      if (withdrawal.status === 'PAID') {
        throw new Error('Cannot reject a withdrawal that has already been PAID');
      }

      if (withdrawal.status === 'REJECTED') {
        throw new Error('Withdrawal is already REJECTED');
      }

      const now = new Date();
      const updatedWd = await tx.affiliateWithdrawal.update({
        where: { id },
        data: {
          status: 'REJECTED',
          rejectionReason: reason,
          reviewedByUserId: adminUserId,
          reviewedAt: now,
        },
      });

      // Release the held funds back to creator's available balance
      await recordLedgerRelease(
        {
          affiliateId: withdrawal.affiliateId,
          amount: withdrawal.amount,
          withdrawalId: withdrawal.id,
          reason: `Withdrawal rejected: ${reason}`,
        },
        tx
      );

      return updatedWd;
    });

    // Audit log
    await logAudit({
      action: 'AFFILIATE_WITHDRAWAL_REJECT',
      module: 'AFFILIATES',
      targetId: id,
      metadata: {
        adminUserId,
        affiliateId: updated.affiliateId,
        amount: updated.amount,
        reason,
      },
      ipAddress: req.headers.get('x-forwarded-for') || undefined,
      userAgent: req.headers.get('user-agent') || undefined,
    });

    // Notify creator
    triggerAffiliateEvent(updated.affiliateId, 'withdrawal_update', {
      withdrawalId: id,
      status: 'REJECTED',
      amount: updated.amount,
      reason,
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      message: 'Withdrawal rejected and held funds released back to creator available balance.',
      withdrawal: updated,
    });
  } catch (error: any) {
    return handleAuthError(error);
  }
}
