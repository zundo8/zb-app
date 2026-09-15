/**
 * Shared cart conversion predicates — single source of truth.
 *
 * Used by:
 *  - app/api/admin/analytics/overview/route.ts
 *  - app/api/admin/analytics/carts/route.ts
 *  - app/api/admin/analytics/realtime/route.ts
 *  - app/api/admin/abandoned-carts/route.ts
 *
 * Definitions:
 *  - Converted:  status='converted' OR convertedOrderId != null OR linked order is valid
 *  - Abandoned:  not converted, has items, status='abandoned' OR (status='active' & stale)
 *  - Live/Active: status='active', not converted, has items, recently active
 *  - Merged/expired are excluded from all counts
 */

// Re-export the runtime order validation helper
export { isOrderValidConverted } from './cartValidation';

/**
 * Prisma `where` fragment that matches a cart whose linked order is genuinely valid.
 * This is the canonical definition shared across analytics and abandoned-carts pages.
 */
export const validConvertedOrderClause = {
  OR: [
    {
      convertedOrder: {
        is: {
          NOT: [
            { status: { in: ['failed', 'FAILED', 'payment_failed', 'payment_pending', 'cancelled', 'CANCELLED', 'draft', 'voided'] } },
            { paymentStatus: { in: ['failed', 'FAILED', 'payment_failed', 'payment_pending', 'cancelled', 'CANCELLED', 'voided'] } }
          ],
          OR: [
            { paymentStatus: { in: ['paid', 'cod_upfront_paid', 'partially_paid', 'refunded', 'partially_refunded', 'PAID', 'SUCCESS', 'success', 'captured', 'authorized', 'approved'] } },
            { status: { in: ['approved', 'open', 'active', 'fulfilled', 'delivered', 'shipped', 'completed', 'processing', 'processed', 'CONFIRMED', 'confirmed', 'placed', 'synced', 'closed'] } }
          ]
        }
      }
    },
    { status: 'converted' },
    { convertedOrderId: { not: null } }
  ]
};

/**
 * Where clause for converted carts, optionally scoped by date and platform.
 */
export function convertedCartWhere(dateFilter?: { gte: Date; lte: Date }, platformFilter?: Record<string, unknown>) {
  return {
    ...validConvertedOrderClause,
    status: { notIn: ['merged', 'expired'] },
    ...(dateFilter ? { createdAt: dateFilter } : {}),
    ...(platformFilter || {}),
  };
}

/**
 * Where clause for abandoned carts.
 * threshold: carts with lastActivityAt <= this are considered stale/abandoned
 */
export function abandonedCartWhere(
  dateFilter?: { gte: Date; lte: Date },
  threshold?: Date,
  platformFilter?: Record<string, unknown>,
) {
  const staleThreshold = threshold || new Date(Date.now() - 30 * 60 * 1000); // default 30min
  return {
    convertedOrderId: null,
    items: { some: {} },
    status: { notIn: ['merged', 'expired', 'converted'] },
    OR: [
      { status: 'abandoned' },
      { status: 'active', lastActivityAt: { lte: staleThreshold } },
    ],
    ...(dateFilter ? { createdAt: dateFilter } : {}),
    ...(platformFilter || {}),
  };
}

/**
 * Where clause for live/active carts (currently being shopped).
 * sinceDate: carts active since this time (e.g. 15 minutes ago)
 */
export function liveCartWhere(sinceDate: Date) {
  return {
    status: 'active',
    convertedOrderId: null,
    items: { some: {} },
    lastActivityAt: { gte: sinceDate },
  };
}
