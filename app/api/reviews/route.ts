import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import prisma from '@/lib/db';
import { canReview } from '@/lib/reviews/eligibility';

export const dynamic = 'force-dynamic';

/**
 * POST /api/reviews
 * Submit a verified-purchaser review for a delivered product.
 * Body: { productId, orderId, rating (1-5), title?, body }
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = (session.user as any).id;
    if (!userId) {
      return NextResponse.json(
        { error: 'No valid user identifier' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { productId, orderId, rating, title, body: reviewBody } = body;

    // Validate required fields
    if (!productId || !orderId || !rating || !reviewBody) {
      return NextResponse.json(
        { error: 'Missing required fields: productId, orderId, rating, body' },
        { status: 400 }
      );
    }

    // Validate rating range
    if (typeof rating !== 'number' || rating < 1 || rating > 5 || !Number.isInteger(rating)) {
      return NextResponse.json(
        { error: 'Rating must be an integer between 1 and 5' },
        { status: 400 }
      );
    }

    // Validate body length
    if (typeof reviewBody !== 'string' || reviewBody.trim().length < 3) {
      return NextResponse.json(
        { error: 'Review body must be at least 3 characters' },
        { status: 400 }
      );
    }

    // Server-side eligibility check — never trust client
    const eligible = await canReview(userId, productId);
    if (!eligible) {
      return NextResponse.json(
        {
          error:
            'You are not eligible to review this product. Either you have not received this product yet, or you have already submitted a review.',
        },
        { status: 403 }
      );
    }

    // Create the review — the unique constraint (userId, productId) is the hard backstop
    try {
      const review = await prisma.productReview.create({
        data: {
          productId,
          orderId,
          userId,
          rating,
          title: title?.trim() || null,
          body: reviewBody.trim(),
          verifiedPurchase: true,
          status: 'VISIBLE',
        },
      });

      return NextResponse.json({ success: true, review }, { status: 201 });
    } catch (err: any) {
      // Handle unique constraint violation gracefully
      if (
        err?.code === 'P2002' ||
        err?.message?.includes('Unique constraint')
      ) {
        return NextResponse.json(
          { error: 'You have already reviewed this product' },
          { status: 409 }
        );
      }
      throw err;
    }
  } catch (err: any) {
    console.error('[POST /api/reviews] Error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/reviews?productId=...&limit=20&offset=0
 * Fetch visible reviews for a product (public, no auth required).
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const productId = searchParams.get('productId');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50);
    const offset = parseInt(searchParams.get('offset') || '0');

    if (!productId) {
      return NextResponse.json(
        { error: 'productId is required' },
        { status: 400 }
      );
    }

    const [reviews, aggregate] = await Promise.all([
      prisma.productReview.findMany({
        where: { productId, status: 'VISIBLE' },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.productReview.aggregate({
        where: { productId, status: 'VISIBLE' },
        _avg: { rating: true },
        _count: { rating: true },
      }),
    ]);

    return NextResponse.json({
      reviews,
      aggregate: aggregate._count.rating > 0
        ? {
            value: Math.round((aggregate._avg.rating || 0) * 10) / 10,
            count: aggregate._count.rating,
          }
        : null,
    });
  } catch (err: any) {
    console.error('[GET /api/reviews] Error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
