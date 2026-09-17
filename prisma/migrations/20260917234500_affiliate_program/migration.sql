-- CreateEnum
CREATE TYPE "AffiliateStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "AffiliateReferralStatus" AS ENUM ('PENDING', 'CONFIRMED', 'REVERSED', 'PAID');

-- CreateEnum
CREATE TYPE "AffiliateWithdrawalStatus" AS ENUM ('REQUESTED', 'APPROVED', 'PROCESSING', 'PAID', 'REJECTED', 'FAILED');

-- CreateEnum
CREATE TYPE "AffiliateLedgerType" AS ENUM ('CREDIT', 'DEBIT', 'REVERSAL', 'HOLD', 'RELEASE');

-- CreateEnum
CREATE TYPE "AffiliatePayoutMethod" AS ENUM ('BANK', 'UPI');

-- AlterEnum
ALTER TYPE "Module" ADD VALUE 'AFFILIATES';

-- CreateTable
CREATE TABLE "affiliates" (
    "id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "display_name" TEXT,
    "status" "AffiliateStatus" NOT NULL DEFAULT 'PENDING',
    "commission_rate" DOUBLE PRECISION NOT NULL DEFAULT 0.10,
    "applied_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approved_at" TIMESTAMP(3),
    "approved_by_user_id" TEXT,
    "rejected_reason" TEXT,
    "notes" TEXT,
    "total_clicks" INTEGER NOT NULL DEFAULT 0,
    "total_conversions" INTEGER NOT NULL DEFAULT 0,
    "total_revenue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "pending_earnings" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "available_balance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lifetime_earnings" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "paid_out" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "first_withdrawal_done" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "affiliates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "affiliate_links" (
    "id" TEXT NOT NULL,
    "affiliate_id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "label" TEXT,
    "target_type" TEXT NOT NULL DEFAULT 'STORE',
    "target_value" TEXT,
    "destination" TEXT NOT NULL,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "conversions" INTEGER NOT NULL DEFAULT 0,
    "revenue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "affiliate_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "affiliate_clicks" (
    "id" TEXT NOT NULL,
    "affiliate_id" TEXT NOT NULL,
    "link_id" TEXT,
    "anonymous_id" TEXT,
    "session_id" TEXT,
    "ip_hash" TEXT,
    "user_agent" TEXT,
    "referrer" TEXT,
    "landing_url" TEXT,
    "country_code" TEXT,
    "city" TEXT,
    "device_type" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "affiliate_clicks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "affiliate_referrals" (
    "id" TEXT NOT NULL,
    "affiliate_id" TEXT NOT NULL,
    "link_id" TEXT,
    "order_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "click_id" TEXT,
    "order_total" DOUBLE PRECISION NOT NULL,
    "eligible_amount" DOUBLE PRECISION NOT NULL,
    "commission_rate" DOUBLE PRECISION NOT NULL,
    "commission_amount" DOUBLE PRECISION NOT NULL,
    "status" "AffiliateReferralStatus" NOT NULL DEFAULT 'PENDING',
    "confirmed_at" TIMESTAMP(3),
    "reversed_at" TIMESTAMP(3),
    "reversed_reason" TEXT,
    "hold_until" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "affiliate_referrals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "affiliate_payout_accounts" (
    "id" TEXT NOT NULL,
    "affiliate_id" TEXT NOT NULL,
    "method" "AffiliatePayoutMethod" NOT NULL DEFAULT 'BANK',
    "account_holder_name" TEXT NOT NULL,
    "account_number_enc" TEXT,
    "ifsc_enc" TEXT,
    "bank_name" TEXT,
    "upi_id_enc" TEXT,
    "last4" TEXT,
    "is_default" BOOLEAN NOT NULL DEFAULT true,
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "affiliate_payout_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "affiliate_withdrawals" (
    "id" TEXT NOT NULL,
    "affiliate_id" TEXT NOT NULL,
    "payout_account_id" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "status" "AffiliateWithdrawalStatus" NOT NULL DEFAULT 'REQUESTED',
    "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewed_by_user_id" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "rejection_reason" TEXT,
    "payout_provider" TEXT,
    "payout_ref" TEXT,
    "paid_at" TIMESTAMP(3),
    "idempotency_key" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "affiliate_withdrawals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "affiliate_ledger_entries" (
    "id" TEXT NOT NULL,
    "affiliate_id" TEXT NOT NULL,
    "type" "AffiliateLedgerType" NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "balance_after" DOUBLE PRECISION NOT NULL,
    "referral_id" TEXT,
    "withdrawal_id" TEXT,
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "affiliate_ledger_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "affiliates_customer_id_key" ON "affiliates"("customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "affiliates_code_key" ON "affiliates"("code");

-- CreateIndex
CREATE INDEX "affiliates_status_created_at_idx" ON "affiliates"("status", "created_at");

-- CreateIndex
CREATE INDEX "affiliates_code_idx" ON "affiliates"("code");

-- CreateIndex
CREATE UNIQUE INDEX "affiliate_links_slug_key" ON "affiliate_links"("slug");

-- CreateIndex
CREATE INDEX "affiliate_links_affiliate_id_created_at_idx" ON "affiliate_links"("affiliate_id", "created_at");

-- CreateIndex
CREATE INDEX "affiliate_links_slug_idx" ON "affiliate_links"("slug");

-- CreateIndex
CREATE INDEX "affiliate_clicks_affiliate_id_created_at_idx" ON "affiliate_clicks"("affiliate_id", "created_at");

-- CreateIndex
CREATE INDEX "affiliate_clicks_link_id_created_at_idx" ON "affiliate_clicks"("link_id", "created_at");

-- CreateIndex
CREATE INDEX "affiliate_clicks_anonymous_id_affiliate_id_created_at_idx" ON "affiliate_clicks"("anonymous_id", "affiliate_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "affiliate_referrals_order_id_key" ON "affiliate_referrals"("order_id");

-- CreateIndex
CREATE INDEX "affiliate_referrals_affiliate_id_status_created_at_idx" ON "affiliate_referrals"("affiliate_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "affiliate_referrals_status_hold_until_idx" ON "affiliate_referrals"("status", "hold_until");

-- CreateIndex
CREATE INDEX "affiliate_referrals_customer_id_idx" ON "affiliate_referrals"("customer_id");

-- CreateIndex
CREATE INDEX "affiliate_payout_accounts_affiliate_id_idx" ON "affiliate_payout_accounts"("affiliate_id");

-- CreateIndex
CREATE UNIQUE INDEX "affiliate_withdrawals_idempotency_key_key" ON "affiliate_withdrawals"("idempotency_key");

-- CreateIndex
CREATE INDEX "affiliate_withdrawals_affiliate_id_status_requested_at_idx" ON "affiliate_withdrawals"("affiliate_id", "status", "requested_at");

-- CreateIndex
CREATE INDEX "affiliate_withdrawals_status_requested_at_idx" ON "affiliate_withdrawals"("status", "requested_at");

-- CreateIndex
CREATE INDEX "affiliate_ledger_entries_affiliate_id_created_at_idx" ON "affiliate_ledger_entries"("affiliate_id", "created_at");

-- AddForeignKey
ALTER TABLE "affiliates" ADD CONSTRAINT "affiliates_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliate_links" ADD CONSTRAINT "affiliate_links_affiliate_id_fkey" FOREIGN KEY ("affiliate_id") REFERENCES "affiliates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliate_clicks" ADD CONSTRAINT "affiliate_clicks_affiliate_id_fkey" FOREIGN KEY ("affiliate_id") REFERENCES "affiliates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliate_referrals" ADD CONSTRAINT "affiliate_referrals_affiliate_id_fkey" FOREIGN KEY ("affiliate_id") REFERENCES "affiliates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliate_referrals" ADD CONSTRAINT "affiliate_referrals_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliate_payout_accounts" ADD CONSTRAINT "affiliate_payout_accounts_affiliate_id_fkey" FOREIGN KEY ("affiliate_id") REFERENCES "affiliates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliate_withdrawals" ADD CONSTRAINT "affiliate_withdrawals_affiliate_id_fkey" FOREIGN KEY ("affiliate_id") REFERENCES "affiliates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliate_ledger_entries" ADD CONSTRAINT "affiliate_ledger_entries_affiliate_id_fkey" FOREIGN KEY ("affiliate_id") REFERENCES "affiliates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
