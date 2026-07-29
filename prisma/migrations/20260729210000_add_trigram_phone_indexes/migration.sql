-- Enable pg_trgm extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Create GIN trigram indexes on phone columns used in contains/endsWith queries
CREATE INDEX IF NOT EXISTS "Customer_phone_trgm_idx" ON "Customer" USING gin ("phone" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "web_store_customers_phone_trgm_idx" ON "web_store_customers" USING gin ("phone" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "web_store_orders_customer_phone_trgm_idx" ON "web_store_orders" USING gin ("customer_phone" gin_trgm_ops);
