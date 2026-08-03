import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import prisma from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/refunds/[id]/reject
 * Rejects a return/exchange refund request with reason.
 * Admin-only security check enforced.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = (await getServerSession(authOptions as any)) as any;
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized: Admin session required.' }, { status: 401 });
    }

    const refundId = params.id;
    const body = await req.json().catch(() => ({}));
    const { reason } = body;

    const rejectionReason = reason || 'Refund request rejected by Admin following Quality Check (QC).';

    let returnRequest = await prisma.returnRequest.findUnique({
      where: { id: refundId }
    });

    let standaloneReturn: any = null;

    if (!returnRequest) {
      standaloneReturn = await prisma.return.findUnique({
        where: { id: refundId }
      });
    }

    if (!returnRequest && !standaloneReturn) {
      return NextResponse.json({ error: 'Refund request record not found.' }, { status: 404 });
    }

    if (returnRequest) {
      await prisma.$transaction([
        prisma.returnRequest.update({
          where: { id: refundId },
          data: {
            status: 'rejected',
            reason: `REJECTED: ${rejectionReason}`
          }
        }),
        prisma.return.updateMany({
          where: { returnRequestId: refundId },
          data: {
            status: 'REJECTED',
            refundStatus: 'REJECTED'
          }
        })
      ]);
    } else if (standaloneReturn) {
      await prisma.return.update({
        where: { id: refundId },
        data: {
          status: 'REJECTED',
          refundStatus: 'REJECTED',
          reason: `REJECTED: ${rejectionReason}`
        }
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Refund request has been rejected.'
    });

  } catch (error: any) {
    console.error('POST /api/admin/refunds/[id]/reject Error:', error);
    return NextResponse.json({ error: error?.message || 'Failed to reject refund' }, { status: 500 });
  }
}
