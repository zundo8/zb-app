-- Zica Bella Web Store - Database Schema setup script (Pass 1)
-- Target: Supabase / PostgreSQL database connected to app.zicabella.com

-- Enable UUID extension if not already present
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ────────────────────────────────────────────────────────────────
-- 1. SEQUENCES & HELPER FUNCTIONS
-- ────────────────────────────────────────────────────────────────

-- Order Number Generator Sequence
CREATE SEQUENCE IF NOT EXISTS web_store_order_number_seq START WITH 40001;

-- Automatic updated_at timestamp update function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger function to auto-generate sequential order numbers in format #ZB40001
CREATE OR REPLACE FUNCTION generate_web_order_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.order_number IS NULL OR NEW.order_number = '' OR NEW.order_number LIKE 'ZB-WEB-%' THEN
        NEW.order_number := '#ZB' || nextval('web_store_order_number_seq')::text;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ────────────────────────────────────────────────────────────────
-- 2. TABLES DEFINITIONS
-- ────────────────────────────────────────────────────────────────

-- Customers Table
CREATE TABLE IF NOT EXISTS web_store_customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    addresses JSONB NOT NULL DEFAULT '[]'::jsonb,
    default_address_index INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Orders Table
CREATE TABLE IF NOT EXISTS web_store_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number TEXT UNIQUE NOT NULL,
    customer_name TEXT NOT NULL,
    customer_email TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    shipping_address JSONB NOT NULL,
    items JSONB NOT NULL, -- Array format: [{ product_id, variant_id, title, image_url, quantity, price }]
    subtotal NUMERIC(10, 2) NOT NULL,
    shipping_charge NUMERIC(10, 2) NOT NULL,
    discount_code TEXT,
    discount_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    total_amount NUMERIC(10, 2) NOT NULL,
    payment_status TEXT NOT NULL CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded')),
    payment_method TEXT NOT NULL CHECK (payment_method IN ('razorpay', 'cod')),
    razorpay_order_id TEXT,
    razorpay_payment_id TEXT,
    fulfillment_status TEXT NOT NULL DEFAULT 'unfulfilled' CHECK (fulfillment_status IN ('unfulfilled', 'processing', 'shipped', 'delivered', 'returned')),
    tracking_number TEXT,
    tracking_url TEXT,
    notes TEXT,
    source TEXT NOT NULL DEFAULT 'web',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Wishlists Table
CREATE TABLE IF NOT EXISTS web_store_wishlists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES web_store_customers(id) ON DELETE CASCADE,
    product_id TEXT NOT NULL,
    variant_id TEXT NOT NULL,
    added_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Coupons Table
CREATE TABLE IF NOT EXISTS web_store_coupons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,
    discount_type TEXT NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
    discount_value NUMERIC(10, 2) NOT NULL,
    min_order_value NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    usage_limit INT,
    used_count INT NOT NULL DEFAULT 0,
    valid_from TIMESTAMP WITH TIME ZONE NOT NULL,
    valid_until TIMESTAMP WITH TIME ZONE NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Banners Table
CREATE TABLE IF NOT EXISTS web_store_banners (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    subtitle TEXT,
    image_url TEXT NOT NULL,
    mobile_image_url TEXT,
    cta_label TEXT,
    cta_link TEXT,
    position INT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────────
-- 3. INDEXES FOR PERFORMANCE
-- ────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_web_store_orders_search 
ON web_store_orders (payment_status, fulfillment_status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_web_store_customers_email 
ON web_store_customers (email);

CREATE UNIQUE INDEX IF NOT EXISTS idx_web_store_wishlists_unique 
ON web_store_wishlists (customer_id, product_id, variant_id);

CREATE INDEX IF NOT EXISTS idx_web_store_coupons_lookup 
ON web_store_coupons (code, is_active);

CREATE INDEX IF NOT EXISTS idx_web_store_banners_ordering 
ON web_store_banners (position) WHERE is_active = TRUE;

-- ────────────────────────────────────────────────────────────────
-- 4. TRIGGERS REGISTRATION
-- ────────────────────────────────────────────────────────────────

-- Generate Sequential Web Order Numbers on Insert
CREATE OR REPLACE TRIGGER trg_generate_web_order_number
BEFORE INSERT ON web_store_orders
FOR EACH ROW
EXECUTE FUNCTION generate_web_order_number();

-- Update timestamps automatically on edit
CREATE OR REPLACE TRIGGER trg_update_customers_timestamp
BEFORE UPDATE ON web_store_customers
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER trg_update_orders_timestamp
BEFORE UPDATE ON web_store_orders
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
