import { AFFILIATE_CONFIG } from './config';
import prisma from '@/lib/db';
import { decryptSecret } from '@/lib/crypto/secret-box';

export interface PayoutExecutionResult {
  provider: 'manual' | 'razorpayx';
  requiresManualUTR: boolean;
  payoutRef?: string;
  status?: string;
  error?: string;
}

/**
 * Executes a payout for an approved withdrawal.
 * If RAZORPAY_PAYOUTS_ENABLED is false (default), gracefully falls back
 * to manual mode requiring admin UTR entry.
 */
export async function executePayout(withdrawalId: string): Promise<PayoutExecutionResult> {
  const withdrawal = await prisma.affiliateWithdrawal.findUnique({
    where: { id: withdrawalId },
    include: {
      affiliate: {
        include: {
          customer: { select: { name: true, email: true, phone: true } },
          payoutAccounts: {
            where: { isDefault: true },
            take: 1,
          },
        },
      },
    },
  });

  if (!withdrawal) {
    throw new Error('Withdrawal record not found');
  }

  // Check if RazorpayX is enabled
  if (!AFFILIATE_CONFIG.RAZORPAY_PAYOUTS_ENABLED) {
    return {
      provider: 'manual',
      requiresManualUTR: true,
      status: 'APPROVED',
    };
  }

  // RazorpayX execution path
  try {
    const account = withdrawal.affiliate.payoutAccounts[0];
    if (!account) {
      throw new Error('No payout account linked for this affiliate');
    }

    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    const accountNumber = AFFILIATE_CONFIG.RAZORPAYX_ACCOUNT_NUMBER;

    if (!keyId || !keySecret || !accountNumber) {
      console.warn('[RazorpayX Payout] Credentials missing; falling back to manual mode');
      return {
        provider: 'manual',
        requiresManualUTR: true,
        status: 'APPROVED',
      };
    }

    const authHeader = `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`;

    // 1. Create / resolve contact on RazorpayX
    const contactRes = await fetch('https://api.razorpay.com/v1/contacts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authHeader,
      },
      body: JSON.stringify({
        name: account.accountHolderName || withdrawal.affiliate.customer.name || 'Affiliate Creator',
        email: withdrawal.affiliate.customer.email || undefined,
        contact: withdrawal.affiliate.customer.phone || undefined,
        type: 'vendor',
        reference_id: `aff_${withdrawal.affiliate.id}`,
      }),
    });

    const contact = await contactRes.json();
    if (!contactRes.ok) {
      throw new Error(`RazorpayX contact creation failed: ${contact.error?.description || contactRes.statusText}`);
    }

    // 2. Create fund account
    let fundAccountPayload: any = {
      contact_id: contact.id,
      account_type: account.method === 'BANK' ? 'bank_account' : 'vpa',
    };

    if (account.method === 'BANK') {
      const accNum = account.accountNumberEnc ? decryptSecret(account.accountNumberEnc) : '';
      const ifsc = account.ifscEnc ? decryptSecret(account.ifscEnc) : '';
      fundAccountPayload.bank_account = {
        name: account.accountHolderName,
        ifsc,
        account_number: accNum,
      };
    } else {
      const upi = account.upiIdEnc ? decryptSecret(account.upiIdEnc) : '';
      fundAccountPayload.vpa = {
        address: upi,
      };
    }

    const fundRes = await fetch('https://api.razorpay.com/v1/fund_accounts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authHeader,
      },
      body: JSON.stringify(fundAccountPayload),
    });

    const fundAccount = await fundRes.json();
    if (!fundRes.ok) {
      throw new Error(`RazorpayX fund account creation failed: ${fundAccount.error?.description || fundRes.statusText}`);
    }

    // 3. Initiate Payout
    const payoutRes = await fetch('https://api.razorpay.com/v1/payouts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authHeader,
        'X-Payout-Idempotency': withdrawal.idempotencyKey,
      },
      body: JSON.stringify({
        account_number: accountNumber,
        fund_account_id: fundAccount.id,
        amount: Math.round(withdrawal.amount * 100), // paise
        currency: 'INR',
        mode: account.method === 'BANK' ? 'IMPS' : 'UPI',
        purpose: 'payout',
        queue_if_low_balance: true,
        reference_id: withdrawal.id,
        narration: 'ZB Creator Payout',
      }),
    });

    const payout = await payoutRes.json();
    if (!payoutRes.ok) {
      throw new Error(`RazorpayX payout request failed: ${payout.error?.description || payoutRes.statusText}`);
    }

    return {
      provider: 'razorpayx',
      requiresManualUTR: false,
      payoutRef: payout.id,
      status: payout.status || 'PROCESSING',
    };
  } catch (error: any) {
    console.error(`[RazorpayX Payout] Error processing withdrawal ${withdrawalId}:`, error.message);
    return {
      provider: 'manual',
      requiresManualUTR: true,
      error: error.message,
    };
  }
}
