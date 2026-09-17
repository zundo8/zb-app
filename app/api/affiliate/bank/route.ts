import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/db';
import { getAuthenticatedCustomer } from '../auth';
import { savePayoutAccount, getMaskedPayoutAccount } from '@/lib/affiliate/bank';
import { rateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

const PayoutAccountSchema = z.object({
  method: z.enum(['BANK', 'UPI']),
  accountHolderName: z.string().trim().min(2).max(100),
  accountNumber: z.string().trim().min(6).max(30).optional(),
  ifsc: z.string().trim().min(5).max(15).optional(),
  bankName: z.string().trim().max(100).optional(),
  upiId: z.string().trim().min(3).max(100).optional(),
}).refine(
  (data) => {
    if (data.method === 'BANK') {
      return Boolean(data.accountNumber && data.ifsc);
    }
    if (data.method === 'UPI') {
      return Boolean(data.upiId);
    }
    return false;
  },
  { message: 'Incomplete payout account details for the selected method' }
);

export async function GET(req: NextRequest) {
  const customer = await getAuthenticatedCustomer(req);
  if (!customer) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const affiliate = await prisma.affiliate.findUnique({
      where: { customerId: customer.id },
      select: { id: true, status: true },
    });

    if (!affiliate) {
      return NextResponse.json({ error: 'Affiliate account not found' }, { status: 404 });
    }

    const account = await getMaskedPayoutAccount(affiliate.id);
    return NextResponse.json({ account });
  } catch (error: any) {
    console.error('[Affiliate Bank] Error fetching payout account:', error);
    return NextResponse.json({ error: 'Failed to fetch payout account' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const customer = await getAuthenticatedCustomer(req);
  if (!customer) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Rate limiting (max 5 edits per 10 minutes)
  const { allowed } = await rateLimit(`aff_bank_${customer.id}`, { maxRequests: 5, windowMs: 600_000 });
  if (!allowed) {
    return NextResponse.json({ error: 'Too many bank account updates. Please wait a moment.' }, { status: 429 });
  }

  try {
    const affiliate = await prisma.affiliate.findUnique({
      where: { customerId: customer.id },
      select: { id: true, status: true },
    });

    if (!affiliate || affiliate.status !== 'APPROVED') {
      return NextResponse.json({ error: 'Only approved affiliates can manage payout accounts' }, { status: 403 });
    }

    const rawBody = await req.json().catch(() => ({}));
    const parseResult = PayoutAccountSchema.safeParse(rawBody);
    if (!parseResult.success) {
      return NextResponse.json({ error: parseResult.error.issues[0]?.message || 'Invalid payout account details' }, { status: 400 });
    }

    const account = await savePayoutAccount({
      affiliateId: affiliate.id,
      ...parseResult.data,
    });

    return NextResponse.json({
      success: true,
      message: 'Payout account details saved securely.',
      account,
    });
  } catch (error: any) {
    console.error('[Affiliate Bank] Error saving payout account:', error);
    return NextResponse.json({ error: error.message || 'Failed to save payout account' }, { status: 500 });
  }
}

export const PUT = POST;
