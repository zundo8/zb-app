import prisma from '@/lib/db';
import { recordLedgerCredit, recordLedgerReversal } from './ledger';
import { triggerAffiliateEvent } from './pusher';

/**
 * Checks if an order is confirmed delivered or COD verified
 */
function isOrderDeliveredOrCodConfirmed(order: any): boolean {
  if (!order) return false;

  const status = (order.status || '').toLowerCase();
  const refundStatus = (order.refundStatus || '').toLowerCase();
  if (status === 'cancelled' || refundStatus === 'completed' || refundStatus === 'refunded') {
    return false;
  }

  const deliveryStatus = (order.deliveryStatus || '').toLowerCase();
  const isDelivered = deliveryStatus === 'delivered' || order.deliveredAt != null;

  const codStatus = (order.codConfirmationStatus || '').toLowerCase();
  const isCodConfirmed = codStatus === 'confirmed' || order.codConfirmedAt != null;

  return isDelivered || isCodConfirmed;
}

/**
 * Cron sweep: Promotes eligible PENDING referrals to CONFIRMED.
 * Requirements:
 * - Status is PENDING
 * - holdUntil <= now
 * - Order is delivered or COD-confirmed
 * - Order is NOT cancelled or refunded
 */
export async function confirmDueReferrals(batchSize = 50): Promise<{ confirmedCount: number; processedCount: number }> {
  const now = new Date();

  // Time-bounded indexed lookup
  const dueReferrals = await prisma.affiliateReferral.findMany({
    where: {
      status: 'PENDING',
      holdUntil: { lte: now },
    },
    include: {
      order: {
        select: {
          id: true,
          status: true,
          paymentStatus: true,
          deliveryStatus: true,
          deliveredAt: true,
          codConfirmationStatus: true,
          codConfirmedAt: true,
          refundStatus: true,
        },
      },
    },
    take: batchSize,
  });

  let confirmedCount = 0;

  for (const referral of dueReferrals) {
    try {
      const order = referral.order;

      // Check if order was cancelled or refunded
      const status = (order?.status || '').toLowerCase();
      const refundStatus = (order?.refundStatus || '').toLowerCase();
      if (status === 'cancelled' || refundStatus === 'completed' || refundStatus === 'refunded') {
        // Reverse rather than confirm
        await reverseReferral(referral.orderId, 'Order was cancelled or refunded before confirmation');
        continue;
      }

      // Check delivery / COD confirmation
      if (!isOrderDeliveredOrCodConfirmed(order)) {
        // Still in transit; wait for next sweep
        continue;
      }

      // Confirm referral and credit ledger inside a transaction
      await prisma.$transaction(async (tx: any) => {
        await tx.affiliateReferral.update({
          where: { id: referral.id },
          data: {
            status: 'CONFIRMED',
            confirmedAt: now,
          },
        });

        await recordLedgerCredit(
          {
            affiliateId: referral.affiliateId,
            amount: referral.commissionAmount,
            referralId: referral.id,
            reason: `Commission confirmed for order ${referral.orderId}`,
          },
          tx
        );
      });

      confirmedCount++;

      // Trigger real-time Pusher event to creator
      triggerAffiliateEvent(referral.affiliateId, 'confirmed', {
        referralId: referral.id,
        orderId: referral.orderId,
        amount: referral.commissionAmount,
      }).catch(() => {});
    } catch (err: any) {
      console.error(`[Affiliate Earnings] Failed to confirm referral ${referral.id}:`, err.message);
    }
  }

  return { confirmedCount, processedCount: dueReferrals.length };
}

/**
 * Reverses a referral commission when an order is cancelled, refunded, or returned via RTO.
 * Idempotent and safe against negative balance crashes.
 */
export async function reverseReferral(orderId: string, reason: string): Promise<{ reversed: boolean; referralId?: string }> {
  try {
    const referral = await prisma.affiliateReferral.findUnique({
      where: { orderId },
      select: {
        id: true,
        affiliateId: true,
        status: true,
        commissionAmount: true,
      },
    });

    if (!referral) {
      return { reversed: false };
    }

    if (referral.status === 'REVERSED') {
      return { reversed: false, referralId: referral.id }; // already reversed
    }

    const wasPending = referral.status === 'PENDING';
    const now = new Date();

    await prisma.$transaction(async (tx: any) => {
      await tx.affiliateReferral.update({
        where: { id: referral.id },
        data: {
          status: 'REVERSED',
          reversedAt: now,
          reversedReason: reason.slice(0, 255),
        },
      });

      await recordLedgerReversal(
        {
          affiliateId: referral.affiliateId,
          amount: referral.commissionAmount,
          referralId: referral.id,
          reason: `Referral reversed: ${reason}`,
          isPendingOnly: wasPending,
        },
        tx
      );
    });

    console.log(`[Affiliate Earnings] Reverted commission of ₹${referral.commissionAmount} for order ${orderId} (reason: ${reason})`);

    // Real-time Pusher notification
    triggerAffiliateEvent(referral.affiliateId, 'reversal', {
      referralId: referral.id,
      orderId,
      amount: referral.commissionAmount,
      reason,
    }).catch(() => {});

    return { reversed: true, referralId: referral.id };
  } catch (err: any) {
    console.error(`[Affiliate Earnings] Error reversing referral for order ${orderId}:`, err.message);
    return { reversed: false };
  }
}
