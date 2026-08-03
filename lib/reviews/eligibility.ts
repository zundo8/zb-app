import prisma from '@/lib/db';

/**
 * Check if a user is eligible to review a given product.
 * Eligibility requires:
 * 1. The user has at least one order containing that product
 * 2. That order has deliveryStatus === 'delivered'
 * 3. No existing ProductReview exists for (userId, productId)
 */
export async function canReview(
  userId: string,
  productId: string
): Promise<boolean> {
  // Check if user already reviewed this product
  const existingReview = await prisma.productReview.findUnique({
    where: {
      userId_productId: { userId, productId },
    },
  });

  if (existingReview) return false;

  // Check if user has a delivered order containing this product
  const deliveredOrder = await prisma.order.findFirst({
    where: {
      customerId: userId,
      deliveryStatus: 'delivered',
      items: {
        some: {
          productId: productId,
        },
      },
    },
    select: { id: true },
  });

  return !!deliveredOrder;
}

/**
 * For a given order, return the products the user hasn't yet reviewed
 * and that have been delivered.
 */
export async function getReviewableProductsForOrder(
  userId: string,
  orderId: string
): Promise<
  { productId: string; title: string; image: string | null }[]
> {
  const order = await prisma.order.findFirst({
    where: {
      id: orderId,
      customerId: userId,
      deliveryStatus: 'delivered',
    },
    include: {
      items: {
        select: {
          productId: true,
          title: true,
          image: true,
        },
      },
    },
  });

  if (!order) return [];

  // Get product IDs user has already reviewed
  const productIds = order.items
    .filter((item: { productId: string | null }) => item.productId)
    .map((item: { productId: string | null }) => item.productId as string);

  if (productIds.length === 0) return [];

  const existingReviews = await prisma.productReview.findMany({
    where: {
      userId,
      productId: { in: productIds },
    },
    select: { productId: true },
  });

  const reviewedProductIds = new Set(existingReviews.map((r: { productId: string }) => r.productId));

  return order.items
    .filter(
      (item: { productId: string | null; title: string; image: string | null }) => item.productId && !reviewedProductIds.has(item.productId)
    )
    .map((item: { productId: string | null; title: string; image: string | null }) => ({
      productId: item.productId as string,
      title: item.title,
      image: item.image,
    }));
}

/**
 * Get the user's existing review for a product, if any.
 */
export async function getUserReviewForProduct(
  userId: string,
  productId: string
) {
  return prisma.productReview.findUnique({
    where: {
      userId_productId: { userId, productId },
    },
  });
}
