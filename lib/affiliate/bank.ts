import prisma from '@/lib/db';
import { encryptSecret, decryptSecret } from '@/lib/crypto/secret-box';
import { logAudit } from '@/lib/audit';
import { AffiliatePayoutMethod } from '@prisma/client';

export interface SavePayoutAccountParams {
  affiliateId: string;
  method: AffiliatePayoutMethod;
  accountHolderName: string;
  accountNumber?: string;
  ifsc?: string;
  bankName?: string;
  upiId?: string;
}

export interface MaskedPayoutAccount {
  id: string;
  method: AffiliatePayoutMethod;
  accountHolderName: string;
  bankName: string | null;
  last4: string | null;
  upiIdMasked?: string | null;
  isDefault: boolean;
  isVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Saves or updates an affiliate's payout account with AES-256-GCM encryption
 */
export async function savePayoutAccount(params: SavePayoutAccountParams): Promise<MaskedPayoutAccount> {
  const { affiliateId, method, accountHolderName, accountNumber, ifsc, bankName, upiId } = params;

  let accountNumberEnc: string | null = null;
  let ifscEnc: string | null = null;
  let upiIdEnc: string | null = null;
  let last4: string | null = null;

  if (method === 'BANK') {
    if (!accountNumber || !ifsc) {
      throw new Error('Account number and IFSC code are required for bank payout method');
    }
    const cleanAcc = accountNumber.trim().replace(/\s+/g, '');
    const cleanIfsc = ifsc.trim().toUpperCase();

    accountNumberEnc = encryptSecret(cleanAcc);
    ifscEnc = encryptSecret(cleanIfsc);
    last4 = cleanAcc.slice(-4);
  } else if (method === 'UPI') {
    if (!upiId) {
      throw new Error('UPI ID is required for UPI payout method');
    }
    const cleanUpi = upiId.trim().toLowerCase();
    upiIdEnc = encryptSecret(cleanUpi);
    last4 = cleanUpi.length > 4 ? cleanUpi.slice(-4) : cleanUpi;
  }

  // Deactivate existing defaults for this affiliate
  await prisma.affiliatePayoutAccount.updateMany({
    where: { affiliateId, isDefault: true },
    data: { isDefault: false },
  });

  const account = await prisma.affiliatePayoutAccount.create({
    data: {
      affiliateId,
      method,
      accountHolderName: accountHolderName.trim(),
      accountNumberEnc,
      ifscEnc,
      bankName: bankName?.trim() || null,
      upiIdEnc,
      last4,
      isDefault: true,
      isVerified: false,
    },
  });

  return {
    id: account.id,
    method: account.method,
    accountHolderName: account.accountHolderName,
    bankName: account.bankName,
    last4: account.last4,
    upiIdMasked: account.method === 'UPI' ? `***${account.last4}` : null,
    isDefault: account.isDefault,
    isVerified: account.isVerified,
    createdAt: account.createdAt,
    updatedAt: account.updatedAt,
  };
}

/**
 * Returns the masked payout account (safe for creator and standard admin UI display)
 */
export async function getMaskedPayoutAccount(affiliateId: string): Promise<MaskedPayoutAccount | null> {
  const account = await prisma.affiliatePayoutAccount.findFirst({
    where: { affiliateId, isDefault: true },
    orderBy: { createdAt: 'desc' },
  });

  if (!account) return null;

  return {
    id: account.id,
    method: account.method,
    accountHolderName: account.accountHolderName,
    bankName: account.bankName,
    last4: account.last4,
    upiIdMasked: account.method === 'UPI' && account.last4 ? `***${account.last4}` : null,
    isDefault: account.isDefault,
    isVerified: account.isVerified,
    createdAt: account.createdAt,
    updatedAt: account.updatedAt,
  };
}

/**
 * Decrypts full bank account details.
 * ADMIN-ONLY ACTION: Enforces mandatory audit logging.
 */
export async function revealPayoutAccount(params: {
  payoutAccountId: string;
  adminUserId: string;
  ipAddress?: string;
  userAgent?: string;
}) {
  const { payoutAccountId, adminUserId, ipAddress, userAgent } = params;

  const account = await prisma.affiliatePayoutAccount.findUnique({
    where: { id: payoutAccountId },
    include: { affiliate: { select: { id: true, code: true, customerId: true } } },
  });

  if (!account) {
    throw new Error('Payout account not found');
  }

  // MANDATORY Audit Log
  await logAudit({
    action: 'AFFILIATE_BANK_REVEAL',
    module: 'AFFILIATES',
    targetId: account.id,
    metadata: {
      affiliateId: account.affiliateId,
      affiliateCode: account.affiliate.code,
      method: account.method,
      adminUserId,
    },
    ipAddress,
    userAgent,
  });

  let accountNumber: string | null = null;
  let ifsc: string | null = null;
  let upiId: string | null = null;

  if (account.accountNumberEnc) {
    accountNumber = decryptSecret(account.accountNumberEnc);
  }
  if (account.ifscEnc) {
    ifsc = decryptSecret(account.ifscEnc);
  }
  if (account.upiIdEnc) {
    upiId = decryptSecret(account.upiIdEnc);
  }

  return {
    id: account.id,
    method: account.method,
    accountHolderName: account.accountHolderName,
    accountNumber,
    ifsc,
    bankName: account.bankName,
    upiId,
    last4: account.last4,
  };
}
