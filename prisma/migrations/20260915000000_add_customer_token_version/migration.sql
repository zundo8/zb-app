-- AddColumn: tokenVersion to Customer for JWT token rotation support
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "tokenVersion" INTEGER NOT NULL DEFAULT 0;

-- AddIndex: email and name on Customer for faster lookups
CREATE INDEX IF NOT EXISTS "Customer_email_idx" ON "Customer" ("email");
CREATE INDEX IF NOT EXISTS "Customer_name_idx" ON "Customer" ("name");
