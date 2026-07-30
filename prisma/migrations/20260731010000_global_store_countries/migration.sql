-- Phase 2: Global Multi-Country Storefront data model
-- Adds GlobalStoreCountry config table, GlobalStoreSettings singleton,
-- displayCountry on Order, currencyCode on Payment

-- 1. Add displayCountry to Order
ALTER TABLE "Order" ADD COLUMN "display_country" TEXT;

-- 2. Add currencyCode to Payment
ALTER TABLE "Payment" ADD COLUMN "currency_code" TEXT DEFAULT 'INR';

-- 3. Create GlobalStoreCountry table
CREATE TABLE "global_store_countries" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "currency_code" TEXT NOT NULL,
    "currency_symbol" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'en-IN',
    "isBase" BOOLEAN NOT NULL DEFAULT false,
    "multiplier" DECIMAL(10,4) NOT NULL DEFAULT 1.0,
    "exchangeRate" DECIMAL(12,6) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "global_store_countries_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "global_store_countries_code_key" ON "global_store_countries"("code");

-- 4. Create GlobalStoreSettings singleton table
CREATE TABLE "global_store_settings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "global_store_enabled" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "global_store_settings_pkey" PRIMARY KEY ("id")
);

-- 5. Seed all 8 countries
-- Exchange rates are approximate as of mid-2026 (admin-editable)
-- Formula: finalPrice = basePriceINR * multiplier * exchangeRate
-- For India: multiplier=1.0, exchangeRate=1.0 → price unchanged
-- For others: multiplier=2.5, exchangeRate converts INR to local currency

INSERT INTO "global_store_countries" ("id", "code", "name", "currency_code", "currency_symbol", "locale", "isBase", "multiplier", "exchangeRate", "isActive", "sortOrder", "updatedAt")
VALUES
  -- India (base market): multiplier=1.0, exchangeRate=1.0 → raw INR price
  ('gsc_india',   'IN', 'India',                'INR', '₹',    'en-IN', true,  1.0000, 1.000000, true, 0, NOW()),
  -- United States: 2.5x INR, converted at ~0.0119 INR→USD
  ('gsc_us',      'US', 'United States',        'USD', '$',    'en-US', false, 2.5000, 0.011900, true, 1, NOW()),
  -- United Kingdom: 2.5x INR, converted at ~0.0094 INR→GBP
  ('gsc_gb',      'GB', 'United Kingdom',       'GBP', '£',    'en-GB', false, 2.5000, 0.009400, true, 2, NOW()),
  -- Canada: 2.5x INR, converted at ~0.0163 INR→CAD
  ('gsc_ca',      'CA', 'Canada',               'CAD', '$',    'en-CA', false, 2.5000, 0.016300, true, 3, NOW()),
  -- Australia: 2.5x INR, converted at ~0.0183 INR→AUD
  ('gsc_au',      'AU', 'Australia',            'AUD', '$',    'en-AU', false, 2.5000, 0.018300, true, 4, NOW()),
  -- UAE: 2.5x INR, converted at ~0.0437 INR→AED
  ('gsc_ae',      'AE', 'United Arab Emirates', 'AED', 'د.إ',  'en-AE', false, 2.5000, 0.043700, true, 5, NOW()),
  -- Germany: 2.5x INR, converted at ~0.0110 INR→EUR
  ('gsc_de',      'DE', 'Germany',              'EUR', '€',    'de-DE', false, 2.5000, 0.011000, true, 6, NOW()),
  -- Spain: 2.5x INR, converted at ~0.0110 INR→EUR
  ('gsc_es',      'ES', 'Spain',                'EUR', '€',    'es-ES', false, 2.5000, 0.011000, true, 7, NOW());

-- 6. Seed the singleton settings row (feature disabled by default)
INSERT INTO "global_store_settings" ("id", "global_store_enabled", "updatedAt")
VALUES ('singleton', false, NOW());
