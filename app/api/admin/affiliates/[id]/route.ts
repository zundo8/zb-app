import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/db';
import { requireAdmin, handleAuthError } from '@/lib/auth/rbac';
import { logAudit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

const PatchAffiliateSchema = z.object({
  commissionRate: z.number().min(0).max(1).optional(),
  displayName: z.string().trim().min(2).max(100).optional(),
  notes: z.string().trim().max(1000).optional().nullable(),
});

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAdmin('AFFILIATES' as any, 'view');
    const { id } = params;

    const affiliate = await prisma.affiliate.findUnique({
      where: { id },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            createdAt: true,
            ordersCount: true,
            totalSpent: true,
          },
        },
        links: {
          orderBy: { createdAt: 'desc' },
        },
        payoutAccounts: {
          select: {
            id: true,
            method: true,
            accountHolderName: true,
            bankName: true,
            last4: true,
            isDefault: true,
            isVerified: true,
            createdAt: true,
          },
        },
        withdrawals: {
          orderBy: { requestedAt: 'desc' },
          take: 20,
        },
        referrals: {
          orderBy: { createdAt: 'desc' },
          take: 25,
          include: {
            order: {
              select: {
                id: true,
                internalOrderNumber: true,
                shopifyOrderId: true,
                totalPrice: true,
                status: true,
                paymentStatus: true,
                deliveryStatus: true,
              },
            },
          },
        },
        ledger: {
          orderBy: { createdAt: 'desc' },
          take: 25,
        },
      },
    });

    if (!affiliate) {
      return NextResponse.json({ error: 'Affiliate not found' }, { status: 404 });
    }

    return NextResponse.json({ affiliate });
  } catch (error: any) {
    return handleAuthError(error);
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireAdmin('AFFILIATES' as any, 'edit');
    const { id } = params;

    const rawBody = await req.json().catch(() => ({}));
    const parseResult = PatchAffiliateSchema.safeParse(rawBody);
    if (!parseResult.success) {
      return NextResponse.json({ error: parseResult.error.issues[0]?.message || 'Invalid input' }, { status: 400 });
    }

    const { commissionRate, displayName, notes } = parseResult.data;

    const updated = await prisma.affiliate.update({
      where: { id },
      data: {
        ...(commissionRate !== undefined ? { commissionRate } : {}),
        ...(displayName !== undefined ? { displayName } : {}),
        ...(notes !== undefined ? { notes } : {}),
      },
    });

    // Audit log
    await logAudit({
      action: 'AFFILIATE_UPDATE',
      module: 'AFFILIATES',
      targetId: id,
      metadata: {
        adminUserId: (session.user as any)?.id,
        changes: parseResult.data,
      },
      ipAddress: req.headers.get('x-forwarded-for') || undefined,
      userAgent: req.headers.get('user-agent') || undefined,
    });

    return NextResponse.json({
      success: true,
      message: 'Affiliate details updated',
      affiliate: updated,
    });
  } catch (error: any) {
    return handleAuthError(error);
  }
}
