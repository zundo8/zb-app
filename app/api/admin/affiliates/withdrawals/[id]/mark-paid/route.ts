import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/db';
import { requireAdmin, handleAuthError } from '@/lib/auth/rbac';
import { logAudit } from '@/lib/audit';
import { recordLedgerDebit } from '@/lib/affiliate/ledger';
import { triggerAffiliateEvent } from '@/lib/affiliate/pusher';

export const dynamic = 'force-dynamic';

const MarkPaidSchema = z.object({
  payoutRef: z.string().trim().min(3, 'A valid UTR or payment reference is required').max(100),
  notes: z.string().trim().max(500).optional(),
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
    const parseResult = MarkPaidSchema.safeParse(rawBody);
    if (!parseResult.success) {
      return NextResponse.json({ error: parseResult.error.issues[0]?.message || 'Invalid UTR reference' }, { status: 400 });
    }

    const { payoutRef, notes } = parseResult.data;

    // Transactionally settle withdrawal and ledger
    const updated = await prisma.$transaction(async (tx: any) => {
      const withdrawal = await tx.affiliateWithdrawal.findUnique({
        where: { id },
      });

      if (!withdrawal) {
        throw new Error('Withdrawal record not found');
      }

      if (withdrawal.status === 'PAID') {
        throw new Error('Withdrawal has already been marked as PAID');
      }

      if (withdrawal.status === 'REJECTED' || withdrawal.status === 'FAILED') {
        throw new Error(`Cannot settle withdrawal with status ${withdrawal.status}`);
      }

      const now = new Date();
      const updatedWd = await tx.affiliateWithdrawal.update({
        where: { id },
        data: {
          status: 'PAID',
          payoutProvider: withdrawal.payoutProvider || 'manual',
          payoutRef,
          paidAt: now,
          reviewedByUserId: adminUserId,
          reviewedAt: now,
        },
      });

      // Settle the held amount as final DEBIT in ledger
      await recordLedgerDebit(
        {
          affiliateId: withdrawal.affiliateId,
          amount: withdrawal.amount,
          withdrawalId: withdrawal.id,
          reason: `Manual payout settled (Ref/UTR: ${payoutRef})${notes ? ` - ${notes}` : ''}`,
        },
        tx
      );

      return updatedWd;
    });

    // Audit log
    await logAudit({
      action: 'AFFILIATE_WITHDRAWAL_PAID',
      module: 'AFFILIATES',
      targetId: id,
      metadata: {
        adminUserId,
        affiliateId: updated.affiliateId,
        amount: updated.amount,
        payoutRef,
      },
      ipAddress: req.headers.get('x-forwarded-for') || undefined,
      userAgent: req.headers.get('user-agent') || undefined,
    });

    // Notify creator
    triggerAffiliateEvent(updated.affiliateId, 'withdrawal_update', {
      withdrawalId: id,
      status: 'PAID',
      amount: updated.amount,
      payoutRef,
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      message: 'Withdrawal marked as PAID and settled in creator ledger.',
      withdrawal: updated,
    });
  } catch (error: any) {
    return handleAuthError(error);
  }
}
