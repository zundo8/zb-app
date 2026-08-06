-- Add refund ID column to Order table
-- This is a forward-only, purely additive migration (nullable new column).
-- No existing rows are modified.
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "refund_id" TEXT UNIQUE;

-- Create refund ID sequence (first refund ID = ZBRF81000)
CREATE SEQUENCE IF NOT EXISTS zb_refund_seq START WITH 81000;
