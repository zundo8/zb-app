import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { requireAdmin, handleAuthError } from '@/lib/auth/rbac';
import { revealPayoutAccount } from '@/lib/affiliate/bank';
import { rateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireAdmin('AFFILIATES' as any, 'view');
    const adminUserId = (session.user as any)?.id;
    const { id: affiliateId } = params;

    // Strict rate limit on bank account reveal (max 10 reveals per 10 minutes per admin)
    const { allowed } = await rateLimit(`reveal_bank_${adminUserId}`, { maxRequests: 10, windowMs: 600_000 });
    if (!allowed) {
      return NextResponse.json({ error: 'Too many bank reveal requests. Please wait a moment.' }, { status: 429 });
    }

    const payoutAccount = await prisma.affiliatePayoutAccount.findFirst({
      where: { affiliateId, isDefault: true },
      select: { id: true },
    });

    if (!payoutAccount) {
      return NextResponse.json({ error: 'No payout account found for this affiliate' }, { status: 404 });
    }

    const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || req.headers.get('x-real-ip') || undefined;
    const userAgent = req.headers.get('user-agent') || undefined;

    // MANDATORY AUDITED REVEAL
    const revealed = await revealPayoutAccount({
      payoutAccountId: payoutAccount.id,
      adminUserId,
      ipAddress,
      userAgent,
    });

    return NextResponse.json({
      success: true,
      account: revealed,
    });
  } catch (error: any) {
    return handleAuthError(error);
  }
}
