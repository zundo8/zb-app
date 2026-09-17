import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/db';
import { requireAdmin, handleAuthError } from '@/lib/auth/rbac';
import { logAudit } from '@/lib/audit';
import { triggerAffiliateEvent } from '@/lib/affiliate/pusher';

export const dynamic = 'force-dynamic';

const RejectSchema = z.object({
  reason: z.string().trim().min(2).max(500),
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
    const parseResult = RejectSchema.safeParse(rawBody);
    if (!parseResult.success) {
      return NextResponse.json({ error: parseResult.error.issues[0]?.message || 'A rejection reason is required' }, { status: 400 });
    }

    const { reason } = parseResult.data;

    const updated = await prisma.affiliate.update({
      where: { id },
      data: {
        status: 'REJECTED',
        rejectedReason: reason,
      },
    });

    // Audit log
    await logAudit({
      action: 'AFFILIATE_REJECT',
      module: 'AFFILIATES',
      targetId: id,
      metadata: {
        adminUserId,
        reason,
      },
      ipAddress: req.headers.get('x-forwarded-for') || undefined,
      userAgent: req.headers.get('user-agent') || undefined,
    });

    // Notify creator
    triggerAffiliateEvent(id, 'withdrawal_update', {
      status: 'REJECTED',
      reason,
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      message: 'Affiliate application rejected.',
      affiliate: updated,
    });
  } catch (error: any) {
    return handleAuthError(error);
  }
}
