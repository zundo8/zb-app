-- AlterTable
ALTER TABLE "web_store_orders" ADD COLUMN IF NOT EXISTS "shopify_order_id" TEXT,
ADD COLUMN IF NOT EXISTS "shopify_order_name" TEXT,
ADD COLUMN IF NOT EXISTS "delivery_status" TEXT,
ADD COLUMN IF NOT EXISTS "delivered_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "web_store_orders_shopify_order_id_idx" ON "web_store_orders"("shopify_order_id");
