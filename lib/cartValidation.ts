export function isOrderValidConverted(order: any): boolean {
  if (!order) return false;

  const status = (order.status || "").toLowerCase();
  const paymentStatus = (order.paymentStatus || "").toLowerCase();
  const paymentMethod = (order.paymentMethod || "").toLowerCase();

  // Invalid order statuses (failed, pending payment, cancelled, draft, voided)
  const invalidStatuses = ["failed", "payment_failed", "payment_pending", "cancelled", "draft", "voided"];
  if (invalidStatuses.includes(status)) {
    return false;
  }

  // Invalid payment statuses
  const invalidPaymentStatuses = ["failed", "payment_failed", "payment_pending", "cancelled", "voided"];
  if (invalidPaymentStatuses.includes(paymentStatus)) {
    return false;
  }

  // Paid payment statuses that guarantee conversion
  const validPaidStatuses = ["paid", "cod_upfront_paid", "partially_paid", "refunded", "partially_refunded", "success", "captured"];
  if (validPaidStatuses.includes(paymentStatus)) {
    return true;
  }

  // COD orders: must be COD payment method (or status) AND have an active/completed order status
  const isCod = paymentMethod.includes("cod") || paymentMethod.includes("cash") || paymentStatus === "cod" || paymentStatus === "cod_upfront_paid";
  const validCodOrderStatuses = ["approved", "open", "fulfilled", "delivered", "shipped", "completed", "processing", "processed", "confirmed", "placed"];
  if (isCod && validCodOrderStatuses.includes(status)) {
    return true;
  }

  return false;
}
