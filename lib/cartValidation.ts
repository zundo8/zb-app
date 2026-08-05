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
  const validPaidStatuses = ["paid", "cod_upfront_paid", "partially_paid", "refunded", "partially_refunded", "success", "captured", "authorized", "approved"];
  if (validPaidStatuses.includes(paymentStatus)) {
    return true;
  }

  // Active / Confirmed order statuses
  const validOrderStatuses = ["approved", "open", "active", "fulfilled", "delivered", "shipped", "completed", "processing", "processed", "confirmed", "placed", "synced", "closed"];
  const isCod = paymentMethod.includes("cod") || paymentMethod.includes("cash") || paymentStatus === "cod" || paymentStatus === "cod_upfront_paid";
  if (validOrderStatuses.includes(status) || (isCod && validOrderStatuses.includes(status))) {
    return true;
  }

  return false;
}
