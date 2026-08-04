/**
 * lib/orderNumber.ts
 * 
 * Universal order number allocation.
 * 
 * All order-number generation MUST go through this module.
 * Numbers are allocated via Postgres sequences inside the caller's transaction
 * so concurrent checkouts can never get duplicates.
 *
 * Successful orders:  ZB81000, ZB81001, ZB81002 …  (zb_universal_order_seq)
 * Failed/pending:     ZBPF81000, ZBPP81001 …       (zb_failed_order_seq + prefix)
 *
 * Prefix mapping:
 *   PF = payment failed
 *   PP = payment pending
 *   CX = cancelled
 *   XX = other / unknown
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type FailedCause = 'payment_failed' | 'pending' | 'cancelled' | 'unknown';

/** Anything that exposes $queryRawUnsafe — works with both prisma and tx */
interface TxLike {
  $queryRawUnsafe: (...args: any[]) => Promise<any>;
}

// ---------------------------------------------------------------------------
// Prefix resolution
// ---------------------------------------------------------------------------

const PREFIX_MAP: Record<string, string> = {
  payment_failed: 'PF',
  failed: 'PF',
  pending: 'PP',
  payment_pending: 'PP',
  cancelled: 'CX',
  canceled: 'CX',
  unknown: 'XX',
};

/**
 * Resolve the two-letter prefix from a cause / paymentStatus string.
 */
export function resolvePrefixFromCause(cause: string | null | undefined): string {
  if (!cause) return 'XX';
  const key = cause.toLowerCase().trim();
  return PREFIX_MAP[key] || 'XX';
}

// ---------------------------------------------------------------------------
// Sequence helpers (atomic, gapless within each sequence)
// ---------------------------------------------------------------------------

/**
 * Allocate the next number from the universal successful-order sequence.
 *
 * MUST be called inside the same Prisma transaction that writes the order
 * so concurrency is handled by Postgres row-level locking on the sequence.
 *
 * @returns e.g. "ZB81000"
 */
export async function assignUniversalOrderNumber(tx: TxLike): Promise<string> {
  const rows: any[] = await tx.$queryRawUnsafe(
    `SELECT nextval('zb_universal_order_seq') AS seq_val`
  );
  const seqVal = Number(rows[0].seq_val);
  return `ZB${seqVal}`;
}

/**
 * Allocate the next number from the shared failed-order sequence,
 * prefixed by the cause.
 *
 * @returns e.g. "ZBPF81000", "ZBPP81001", "ZBCX81002"
 */
export async function assignFailedOrderNumber(
  tx: TxLike,
  opts: { cause: string }
): Promise<string> {
  const prefix = resolvePrefixFromCause(opts.cause);
  const rows: any[] = await tx.$queryRawUnsafe(
    `SELECT nextval('zb_failed_order_seq') AS seq_val`
  );
  const seqVal = Number(rows[0].seq_val);
  return `ZB${prefix}${seqVal}`;
}

// ---------------------------------------------------------------------------
// Utility: detect whether an existing order number is a "failed" prefix
// ---------------------------------------------------------------------------

const FAILED_PREFIX_RE = /^ZB(PF|PP|CX|XX)\d+$/;

/**
 * Returns true if the order number is a failed/pending prefix number
 * (ZBPF…, ZBPP…, ZBCX…, ZBXX…) and therefore eligible for promotion
 * to a real ZB number.
 */
export function isFailedPrefixNumber(orderNumber: string | null | undefined): boolean {
  if (!orderNumber) return false;
  return FAILED_PREFIX_RE.test(orderNumber);
}

/**
 * Returns true if the order number is a real universal ZB number
 * (not a failed prefix and not a legacy format).
 */
export function isUniversalZBNumber(orderNumber: string | null | undefined): boolean {
  if (!orderNumber) return false;
  // Must start with ZB, followed by digits only (no PF/PP/CX/XX prefix, no dashes)
  return /^ZB\d+$/.test(orderNumber);
}
