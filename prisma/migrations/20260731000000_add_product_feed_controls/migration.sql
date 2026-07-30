-- AlterTable Product
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "includeInFeed" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable Shop
ALTER TABLE "Shop" ADD COLUMN IF NOT EXISTS "feedExcludedCollections" TEXT DEFAULT '[]';
