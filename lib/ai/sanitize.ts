/**
 * lib/ai/sanitize.ts
 * Data sanitization for customer-facing Claude responses.
 *
 * Uses ALLOW-LIST approach — only explicitly listed fields pass through.
 * All internal fields (cost, vendor, SKU, warehouse, batch IDs) are stripped.
 */

// ---------------------------------------------------------------------------
// Order sanitization — explicit field allow-list
// ---------------------------------------------------------------------------

/** Fields allowed in customer-visible order data */
const ORDER_SAFE_FIELDS = new Set([
  'id',
  'shopifyOrderId',
  'shopifyOrderName',
  'totalPrice',
  'subtotalPrice',
  'currency',
  'status',
  'paymentStatus',
  'fulfillmentStatus',
  'deliveryStatus',
  'createdAt',
  'updatedAt',
  'items',
  'discountAmount',
  'discountCode',
  'storeCreditAmount',
]);

/** Fields allowed in customer-visible order item data */
const ORDER_ITEM_SAFE_FIELDS = new Set([
  'title',
  'quantity',
  'price',
  'image',
]);

/** Fields allowed in shipment data */
const SHIPMENT_SAFE_FIELDS = new Set([
  'trackingNumber',
  'courier',
  'status',
  'trackingUrl',
  'estimatedDelivery',
  'currentLocation',
]);

/** Fields allowed in payment data */
const PAYMENT_SAFE_FIELDS = new Set([
  'amount',
  'type',
  'status',
  'gateway',
  'createdAt',
]);

/**
 * Sanitize an order object for customer view.
 * Uses allow-list: only listed fields pass through.
 */
export function sanitizeOrderForCustomer(order: any): Record<string, any> {
  if (!order) return {};

  const safe: Record<string, any> = {};

  for (const field of ORDER_SAFE_FIELDS) {
    if (order[field] !== undefined) {
      safe[field] = order[field];
    }
  }

  // Sanitize nested items
  if (Array.isArray(order.items)) {
    safe.items = order.items.map((item: any) => {
      const safeItem: Record<string, any> = {};
      for (const field of ORDER_ITEM_SAFE_FIELDS) {
        if (item[field] !== undefined) {
          safeItem[field] = item[field];
        }
      }
      return safeItem;
    });
  }

  // Map status to customer-facing text
  safe.status = mapInternalStatus(order.status);
  safe.paymentStatus = mapPaymentStatus(order.paymentStatus);
  safe.deliveryStatus = mapDeliveryStatus(order.deliveryStatus);

  return safe;
}

/**
 * Sanitize shipment data for customer view.
 */
export function sanitizeShipmentForCustomer(shipment: any): Record<string, any> {
  if (!shipment) return {};
  const safe: Record<string, any> = {};
  for (const field of SHIPMENT_SAFE_FIELDS) {
    if (shipment[field] !== undefined) {
      safe[field] = shipment[field];
    }
  }
  return safe;
}

/**
 * Sanitize payment data for customer view.
 */
export function sanitizePaymentForCustomer(payment: any): Record<string, any> {
  if (!payment) return {};
  const safe: Record<string, any> = {};
  for (const field of PAYMENT_SAFE_FIELDS) {
    if (payment[field] !== undefined) {
      safe[field] = payment[field];
    }
  }
  safe.status = mapPaymentStatus(payment.status);
  return safe;
}

// ---------------------------------------------------------------------------
// Status mapping — internal → customer-facing
// ---------------------------------------------------------------------------

const STATUS_MAP: Record<string, string> = {
  pending: 'Order Placed',
  processing: 'Processing',
  confirmed: 'Processing',
  ready_for_dispatch: 'Ready for Dispatch',
  dispatched: 'Shipped',
  shipped: 'Shipped',
  in_transit: 'Out for Delivery',
  out_for_delivery: 'Out for Delivery',
  delivered: 'Delivered',
  return_requested: 'Return Requested',
  exchange_requested: 'Exchange Requested',
  cancelled: 'Cancelled',
  failed: 'Cancelled',
};

export function mapInternalStatus(status: string): string {
  if (!status) return 'Unknown';
  return STATUS_MAP[status.toLowerCase()] ?? status;
}

const PAYMENT_STATUS_MAP: Record<string, string> = {
  paid: 'Paid',
  pending: 'Pending',
  authorized: 'Pending',
  failed: 'Failed',
  refunded: 'Refunded',
  partially_refunded: 'Partially Refunded',
  cancelled: 'Cancelled',
};

export function mapPaymentStatus(status: string): string {
  if (!status) return 'Unknown';
  return PAYMENT_STATUS_MAP[status.toLowerCase()] ?? status;
}

const DELIVERY_STATUS_MAP: Record<string, string> = {
  pending: 'Processing',
  dispatched: 'Shipped',
  shipped: 'Shipped',
  in_transit: 'In Transit',
  out_for_delivery: 'Out for Delivery',
  delivered: 'Delivered',
  rto: 'Returning to Warehouse',
};

export function mapDeliveryStatus(status: string): string {
  if (!status) return 'Processing';
  return DELIVERY_STATUS_MAP[status.toLowerCase()] ?? status;
}

// ---------------------------------------------------------------------------
// Untrusted data wrapping — anti-prompt-injection
// ---------------------------------------------------------------------------

/**
 * Wrap stored data (product titles, order notes, tags) in <untrusted_data> tags
 * to prevent prompt injection from user-controlled fields.
 */
export function wrapUntrustedData(data: string, maxLength = 500): string {
  if (!data) return '';
  // Strip control characters except newlines
  const cleaned = data.replace(/[\x00-\x09\x0B\x0C\x0E-\x1F\x7F]/g, '');
  // Truncate
  const truncated = cleaned.length > maxLength ? cleaned.slice(0, maxLength) + '…' : cleaned;
  return `<untrusted_data>${truncated}</untrusted_data>`;
}
