-- Universal Order Numbering Migration
-- Creates Postgres sequences for gapless order numbering and removes old triggers.

-- 1. Create universal successful-order sequence (first new successful order = ZB81000)
CREATE SEQUENCE IF NOT EXISTS zb_universal_order_seq START WITH 81000;

-- 2. Create shared failed-order sequence (ZBPF81000, ZBPP81001, etc.)
CREATE SEQUENCE IF NOT EXISTS zb_failed_order_seq START WITH 81000;

-- 3. Add previousOrderNumbers column to Order (traceability for promoted failed→success orders)
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "previous_order_numbers" TEXT;

-- 4. Remove the old web store order number trigger
--    New WebStoreOrders get their number from application code (lib/orderNumber.ts)
--    Existing #ZB4xxxx numbers are preserved; only the trigger is removed.
DROP TRIGGER IF EXISTS trg_generate_web_order_number ON web_store_orders;

-- 5. Remove the old Order internal_order_number trigger
--    New Orders get their number from application code (lib/orderNumber.ts)
--    Existing ZB-YYMM-NNNNN numbers are preserved; only the trigger is removed.
DROP TRIGGER IF EXISTS trg_generate_internal_order_number ON "Order";
