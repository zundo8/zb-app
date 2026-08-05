-- Migration: add_phone_last_10_indexes
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "phoneLast10" TEXT;
CREATE INDEX IF NOT EXISTS "Customer_phoneLast10_idx" ON "Customer"("phoneLast10");

ALTER TABLE "cart_sessions" ADD COLUMN IF NOT EXISTS "phone_last_10" TEXT;
CREATE INDEX IF NOT EXISTS "cart_sessions_phone_last_10_idx" ON "cart_sessions"("phone_last_10");

ALTER TABLE "Address" ADD COLUMN IF NOT EXISTS "phoneLast10" TEXT;
CREATE INDEX IF NOT EXISTS "Address_phoneLast10_idx" ON "Address"("phoneLast10");

ALTER TABLE "web_store_orders" ADD COLUMN IF NOT EXISTS "phone_last_10" TEXT;
CREATE INDEX IF NOT EXISTS "web_store_orders_phone_last_10_idx" ON "web_store_orders"("phone_last_10");

ALTER TABLE "web_store_customers" ADD COLUMN IF NOT EXISTS "phone_last_10" TEXT;
CREATE INDEX IF NOT EXISTS "web_store_customers_phone_last_10_idx" ON "web_store_customers"("phone_last_10");
