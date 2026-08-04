-- AlterTable
ALTER TABLE "ExchangeRequest" ADD COLUMN IF NOT EXISTS "reverseAwb" TEXT,
ADD COLUMN IF NOT EXISTS "settlementPreference" TEXT NOT NULL DEFAULT 'PREPAID_NOW';

-- AlterTable
ALTER TABLE "ReturnRequest" ADD COLUMN IF NOT EXISTS "reverseAwb" TEXT;
