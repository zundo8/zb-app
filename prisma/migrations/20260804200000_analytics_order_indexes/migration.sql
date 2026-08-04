-- CreateIndex
CREATE INDEX IF NOT EXISTS "Order_createdAt_idx" ON "Order"("createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Order_status_createdAt_idx" ON "Order"("status", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Order_paymentStatus_createdAt_idx" ON "Order"("paymentStatus", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Order_orderType_createdAt_idx" ON "Order"("orderType", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Order_customerId_createdAt_idx" ON "Order"("customerId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Order_refund_status_idx" ON "Order"("refund_status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "cart_sessions_created_at_idx" ON "cart_sessions"("created_at");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "cart_sessions_abandoned_at_idx" ON "cart_sessions"("abandoned_at");
