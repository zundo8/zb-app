import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import prisma from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * PATCH /api/admin/reviews/[id]
 * Toggle review status between VISIBLE and HIDDEN.
 * Body: { status: 'VISIBLE' | 'HIDDEN' }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = (await getServerSession(authOptions as any)) as any;
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const role = session.user.role;
    if (role !== 'ADMIN' && role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { status } = body;

    if (!status || !['VISIBLE', 'HIDDEN'].includes(status)) {
      return NextResponse.json(
        { error: 'status must be VISIBLE or HIDDEN' },
        { status: 400 }
      );
    }

    const review = await prisma.productReview.update({
      where: { id: params.id },
      data: { status },
    });

    return NextResponse.json({ success: true, review });
  } catch (err: any) {
    if (err?.code === 'P2025') {
      return NextResponse.json(
        { error: 'Review not found' },
        { status: 404 }
      );
    }
    console.error('[PATCH /api/admin/reviews/[id]] Error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/reviews/[id]
 * Permanently delete a review.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = (await getServerSession(authOptions as any)) as any;
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const role = session.user.role;
    if (role !== 'ADMIN' && role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await prisma.productReview.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    if (err?.code === 'P2025') {
      return NextResponse.json(
        { error: 'Review not found' },
        { status: 404 }
      );
    }
    console.error('[DELETE /api/admin/reviews/[id]] Error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
