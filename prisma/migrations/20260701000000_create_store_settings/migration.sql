-- Create store_settings table
CREATE TABLE IF NOT EXISTS store_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_key TEXT NOT NULL UNIQUE,
  home_page_title TEXT,
  meta_description TEXT,
  social_image_url TEXT,
  social_image_alt TEXT,
  twitter_card_type TEXT DEFAULT 'summary_large_image',
  updated_by TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed row for homepage
INSERT INTO store_settings (page_key, home_page_title, meta_description)
VALUES ('homepage', 'Zica Bella | Luxury Indian Streetwear for Modern Men', 
  'Zica Bella crafts luxury Indian streetwear for modern men, oversized heavyweight tees, acid-wash finishes, cargos and modern denim designed for bold everyday style.')
ON CONFLICT (page_key) DO NOTHING;

-- Create storage bucket if not exists (public: true makes all objects publicly readable)
INSERT INTO storage.buckets (id, name, public)
VALUES ('store-assets', 'store-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Enable RLS on store_settings
ALTER TABLE store_settings ENABLE ROW LEVEL SECURITY;

-- Policies for store_settings
DROP POLICY IF EXISTS "Allow public read access to store_settings" ON store_settings;
CREATE POLICY "Allow public read access to store_settings"
  ON store_settings FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Allow admin write access to store_settings" ON store_settings;
CREATE POLICY "Allow admin write access to store_settings"
  ON store_settings FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
