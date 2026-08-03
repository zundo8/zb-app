import prisma from '@/lib/db';

/**
 * Compute the aggregate rating for a single product from VISIBLE reviews.
 * Returns { value, count } or undefined if no reviews exist.
 */
export async function getProductAggregateRating(
  productId: string
): Promise<{ value: number; count: number } | undefined> {
  const result = await prisma.productReview.aggregate({
    where: {
      productId,
      status: 'VISIBLE',
    },
    _avg: { rating: true },
    _count: { rating: true },
  });

  if (!result._count.rating || result._count.rating === 0) {
    return undefined;
  }

  return {
    value: Math.round((result._avg.rating || 0) * 10) / 10, // one decimal
    count: result._count.rating,
  };
}

/**
 * Fetch visible reviews for a product for on-page display.
 */
export async function getProductReviews(
  productId: string,
  options: { limit?: number; offset?: number } = {}
): Promise<
  {
    id: string;
    rating: number;
    title: string | null;
    body: string;
    userId: string;
    verifiedPurchase: boolean;
    createdAt: Date;
  }[]
> {
  const { limit = 20, offset = 0 } = options;

  return prisma.productReview.findMany({
    where: {
      productId,
      status: 'VISIBLE',
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
    skip: offset,
    select: {
      id: true,
      rating: true,
      title: true,
      body: true,
      userId: true,
      verifiedPurchase: true,
      createdAt: true,
    },
  });
}

/**
 * Compute the aggregate rating across ALL visible product reviews store-wide.
 * Used for Organization / ClothingStore JSON-LD.
 * Returns { value, count } or undefined if no reviews exist.
 */
export async function getStoreAggregateRating(): Promise<
  { value: number; count: number } | undefined
> {
  const result = await prisma.productReview.aggregate({
    where: {
      status: 'VISIBLE',
    },
    _avg: { rating: true },
    _count: { rating: true },
  });

  if (!result._count.rating || result._count.rating === 0) {
    return undefined;
  }

  return {
    value: Math.round((result._avg.rating || 0) * 10) / 10,
    count: result._count.rating,
  };
}
