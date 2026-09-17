import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/db';
import { requireAdmin, handleAuthError } from '@/lib/auth/rbac';
import { logAudit } from '@/lib/audit';
import { triggerAffiliateEvent } from '@/lib/affiliate/pusher';

export const dynamic = 'force-dynamic';

const SuspendSchema = z.object({
  reason: z.string().trim().max(500).optional(),
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
    const parseResult = SuspendSchema.safeParse(rawBody);
    const reason = parseResult.success ? parseResult.data.reason : undefined;

    const updated = await prisma.affiliate.update({
      where: { id },
      data: {
        status: 'SUSPENDED',
        notes: reason ? `Suspended: ${reason}` : undefined,
      },
    });

    // Audit log
    await logAudit({
      action: 'AFFILIATE_SUSPEND',
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
      status: 'SUSPENDED',
      reason,
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      message: 'Affiliate account suspended. Active links will no longer attribute conversions.',
      affiliate: updated,
    });
  } catch (error: any) {
    return handleAuthError(error);
  }
}
