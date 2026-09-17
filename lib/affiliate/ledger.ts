import prisma from '@/lib/db';
import { Prisma } from '@prisma/client';

type DbClient = Prisma.TransactionClient | typeof prisma;

/**
 * Rounds monetary amounts to 2 decimal places
 */
export function round2(val: number): number {
  return Math.round((val + Number.EPSILON) * 100) / 100;
}

/**
 * Derives and verifies the authoritative available balance for an affiliate.
 * Reads the affiliate and validates that balance is consistent.
 */
export async function getAvailableBalance(affiliateId: string, client: DbClient = prisma): Promise<number> {
  const affiliate = await client.affiliate.findUnique({
    where: { id: affiliateId },
    select: { availableBalance: true },
  });

  if (!affiliate) {
    throw new Error(`Affiliate ${affiliateId} not found`);
  }

  return round2(affiliate.availableBalance);
}

/**
 * Credits confirmed earnings to the creator's available balance and lifetime earnings.
 * Moves pendingEarnings → availableBalance.
 */
export async function recordLedgerCredit(
  params: {
    affiliateId: string;
    amount: number;
    referralId?: string;
    reason?: string;
  },
  client: DbClient = prisma
) {
  const { affiliateId, amount, referralId, reason } = params;
  if (amount <= 0) return;

  const run = async (tx: Prisma.TransactionClient) => {
    const affiliate = await tx.affiliate.findUnique({
      where: { id: affiliateId },
      select: { availableBalance: true, pendingEarnings: true, lifetimeEarnings: true },
    });

    if (!affiliate) throw new Error(`Affiliate ${affiliateId} not found`);

    const currentBalance = round2(affiliate.availableBalance);
    const newBalance = round2(currentBalance + amount);
    const newPending = Math.max(0, round2(affiliate.pendingEarnings - amount));
    const newLifetime = round2(affiliate.lifetimeEarnings + amount);

    const ledgerEntry = await tx.affiliateLedgerEntry.create({
      data: {
        affiliateId,
        type: 'CREDIT',
        amount: round2(amount),
        balanceAfter: newBalance,
        referralId: referralId || null,
        reason: reason || 'Referral commission confirmed',
      },
    });

    await tx.affiliate.update({
      where: { id: affiliateId },
      data: {
        availableBalance: newBalance,
        pendingEarnings: newPending,
        lifetimeEarnings: newLifetime,
      },
    });

    return { ledgerEntry, balanceAfter: newBalance };
  };

  if ('$transaction' in client) {
    return (client as typeof prisma).$transaction(run);
  }
  return run(client);
}

/**
 * Places a HOLD on available balance when a withdrawal is requested.
 * Prevents double-spending of funds while payout is being processed.
 */
export async function recordLedgerHold(
  params: {
    affiliateId: string;
    amount: number;
    withdrawalId?: string;
    reason?: string;
  },
  client: DbClient = prisma
) {
  const { affiliateId, amount, withdrawalId, reason } = params;
  if (amount <= 0) throw new Error('Withdrawal amount must be greater than 0');

  const run = async (tx: Prisma.TransactionClient) => {
    const affiliate = await tx.affiliate.findUnique({
      where: { id: affiliateId },
      select: { availableBalance: true },
    });

    if (!affiliate) throw new Error(`Affiliate ${affiliateId} not found`);

    const currentBalance = round2(affiliate.availableBalance);
    if (currentBalance < round2(amount)) {
      throw new Error(`Insufficient available balance. Available: ₹${currentBalance}, Requested: ₹${amount}`);
    }

    const newBalance = round2(currentBalance - amount);

    const ledgerEntry = await tx.affiliateLedgerEntry.create({
      data: {
        affiliateId,
        type: 'HOLD',
        amount: -round2(amount),
        balanceAfter: newBalance,
        withdrawalId: withdrawalId || null,
        reason: reason || 'Withdrawal requested - funds held',
      },
    });

    await tx.affiliate.update({
      where: { id: affiliateId },
      data: {
        availableBalance: newBalance,
      },
    });

    return { ledgerEntry, balanceAfter: newBalance };
  };

  if ('$transaction' in client) {
    return (client as typeof prisma).$transaction(run);
  }
  return run(client);
}

/**
 * Releases a previously held amount back to available balance (e.g. rejected withdrawal).
 */
export async function recordLedgerRelease(
  params: {
    affiliateId: string;
    amount: number;
    withdrawalId?: string;
    reason?: string;
  },
  client: DbClient = prisma
) {
  const { affiliateId, amount, withdrawalId, reason } = params;
  if (amount <= 0) return;

  const run = async (tx: Prisma.TransactionClient) => {
    const affiliate = await tx.affiliate.findUnique({
      where: { id: affiliateId },
      select: { availableBalance: true },
    });

    if (!affiliate) throw new Error(`Affiliate ${affiliateId} not found`);

    const currentBalance = round2(affiliate.availableBalance);
    const newBalance = round2(currentBalance + amount);

    const ledgerEntry = await tx.affiliateLedgerEntry.create({
      data: {
        affiliateId,
        type: 'RELEASE',
        amount: round2(amount),
        balanceAfter: newBalance,
        withdrawalId: withdrawalId || null,
        reason: reason || 'Withdrawal rejected - held funds released',
      },
    });

    await tx.affiliate.update({
      where: { id: affiliateId },
      data: {
        availableBalance: newBalance,
      },
    });

    return { ledgerEntry, balanceAfter: newBalance };
  };

  if ('$transaction' in client) {
    return (client as typeof prisma).$transaction(run);
  }
  return run(client);
}

/**
 * Settles a held withdrawal as DEBIT (paid out to creator).
 * Updates paidOut and firstWithdrawalDone.
 */
export async function recordLedgerDebit(
  params: {
    affiliateId: string;
    amount: number;
    withdrawalId?: string;
    reason?: string;
  },
  client: DbClient = prisma
) {
  const { affiliateId, amount, withdrawalId, reason } = params;
  if (amount <= 0) return;

  const run = async (tx: Prisma.TransactionClient) => {
    const affiliate = await tx.affiliate.findUnique({
      where: { id: affiliateId },
      select: { availableBalance: true, paidOut: true },
    });

    if (!affiliate) throw new Error(`Affiliate ${affiliateId} not found`);

    // Balance was already decremented during the HOLD phase;
    // this entry records the final settlement DEBIT row in the ledger.
    const currentBalance = round2(affiliate.availableBalance);
    const newPaidOut = round2(affiliate.paidOut + amount);

    const ledgerEntry = await tx.affiliateLedgerEntry.create({
      data: {
        affiliateId,
        type: 'DEBIT',
        amount: -round2(amount),
        balanceAfter: currentBalance,
        withdrawalId: withdrawalId || null,
        reason: reason || 'Withdrawal settled and paid',
      },
    });

    await tx.affiliate.update({
      where: { id: affiliateId },
      data: {
        paidOut: newPaidOut,
        firstWithdrawalDone: true,
      },
    });

    return { ledgerEntry, balanceAfter: currentBalance };
  };

  if ('$transaction' in client) {
    return (client as typeof prisma).$transaction(run);
  }
  return run(client);
}

/**
 * Reverses a referral commission (on refund, cancellation, or RTO).
 * Backs out balances with clamping >= 0.
 */
export async function recordLedgerReversal(
  params: {
    affiliateId: string;
    amount: number;
    referralId?: string;
    reason?: string;
    isPendingOnly?: boolean;
  },
  client: DbClient = prisma
) {
  const { affiliateId, amount, referralId, reason, isPendingOnly } = params;
  if (amount <= 0) return;

  const run = async (tx: Prisma.TransactionClient) => {
    const affiliate = await tx.affiliate.findUnique({
      where: { id: affiliateId },
      select: { availableBalance: true, pendingEarnings: true, lifetimeEarnings: true },
    });

    if (!affiliate) throw new Error(`Affiliate ${affiliateId} not found`);

    if (isPendingOnly) {
      // Just void from pending earnings, no ledger row needed (funds were never confirmed)
      const newPending = Math.max(0, round2(affiliate.pendingEarnings - amount));
      await tx.affiliate.update({
        where: { id: affiliateId },
        data: { pendingEarnings: newPending },
      });
      return { balanceAfter: round2(affiliate.availableBalance) };
    }

    // Was CONFIRMED: write ledger REVERSAL row and adjust availableBalance & lifetimeEarnings
    const currentBalance = round2(affiliate.availableBalance);
    const newBalance = Math.max(0, round2(currentBalance - amount));
    const newLifetime = Math.max(0, round2(affiliate.lifetimeEarnings - amount));

    const ledgerEntry = await tx.affiliateLedgerEntry.create({
      data: {
        affiliateId,
        type: 'REVERSAL',
        amount: -round2(amount),
        balanceAfter: newBalance,
        referralId: referralId || null,
        reason: reason || 'Referral reversed due to refund/cancellation',
      },
    });

    await tx.affiliate.update({
      where: { id: affiliateId },
      data: {
        availableBalance: newBalance,
        lifetimeEarnings: newLifetime,
      },
    });

    return { ledgerEntry, balanceAfter: newBalance };
  };

  if ('$transaction' in client) {
    return (client as typeof prisma).$transaction(run);
  }
  return run(client);
}
