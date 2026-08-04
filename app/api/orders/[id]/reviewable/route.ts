import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import prisma from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = (session.user as any).id;
    const orderId = params.id;

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          select: {
            id: true,
            productId: true,
            title: true,
            image: true,
          },
        },
      },
    });

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // Verify order belongs to user
    if (order.customerId !== userId && (session.user as any).role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const isDelivered = (order.deliveryStatus || '').toLowerCase() === 'delivered';

    if (!isDelivered) {
      return NextResponse.json({
        success: true,
        isDelivered: false,
        items: [],
      });
    }

    // Get existing reviews for these products by this user
    const productIds = order.items
      .map((item: any) => item.productId)
      .filter(Boolean) as string[];

    const existingReviews = await prisma.productReview.findMany({
      where: {
        userId,
        productId: { in: productIds },
      },
    });

    const reviewMap = new Map<string, any>();
    existingReviews.forEach((r: any) => reviewMap.set(r.productId, r));

    const items = order.items.map((item: any) => {
      const pId = item.productId || item.id;
      const review: any = reviewMap.get(pId);

      return {
        id: item.id,
        productId: pId,
        title: item.title,
        image: item.image,
        reviewed: !!review,
        review: review
          ? {
              id: review.id,
              rating: review.rating,
              title: review.title,
              body: review.body,
              status: review.status,
              createdAt: review.createdAt,
            }
          : null,
      };
    });

    return NextResponse.json({
      success: true,
      isDelivered: true,
      items,
    });
  } catch (err: any) {
    console.error('[GET /api/orders/[id]/reviewable] Error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
