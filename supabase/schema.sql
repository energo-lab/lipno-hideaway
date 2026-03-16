-- ═══════════════════════════════════════════════════════════════
-- Lipno Hideaway – Database Schema (Updated with Gallery)
-- Run this in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════

-- ── Reservations ──
CREATE TABLE IF NOT EXISTS reservations (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  guest_name TEXT NOT NULL,
  guest_email TEXT NOT NULL,
  guest_phone TEXT,
  check_in DATE NOT NULL,
  check_out DATE NOT NULL,
  num_guests INTEGER NOT NULL DEFAULT 1 CHECK (num_guests >= 1 AND num_guests <= 9),
  total_price INTEGER NOT NULL CHECK (total_price >= 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled')),
  notes TEXT,
  language TEXT NOT NULL DEFAULT 'cs' CHECK (language IN ('cs', 'en', 'de', 'nl')),
  payment_variable_symbol TEXT,
  CONSTRAINT valid_dates CHECK (check_out > check_in)
);

-- ── Seasonal Prices ──
CREATE TABLE IF NOT EXISTS seasonal_prices (
  id BIGSERIAL PRIMARY KEY,
  season_name TEXT NOT NULL,
  date_from DATE NOT NULL,
  date_to DATE NOT NULL,
  price_per_night INTEGER NOT NULL CHECK (price_per_night >= 0),
  min_nights INTEGER NOT NULL DEFAULT 1 CHECK (min_nights >= 1),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT valid_season_dates CHECK (date_to >= date_from)
);

-- ── Blocked Dates ──
CREATE TABLE IF NOT EXISTS blocked_dates (
  id BIGSERIAL PRIMARY KEY,
  date_from DATE NOT NULL,
  date_to DATE NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT valid_blocked_dates CHECK (date_to >= date_from)
);

-- ── Reviews ──
CREATE TABLE IF NOT EXISTS reviews (
  id BIGSERIAL PRIMARY KEY,
  reservation_id BIGINT REFERENCES reservations(id),
  guest_name TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review_text TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT 'cs' CHECK (language IN ('cs', 'en', 'de', 'nl')),
  approved BOOLEAN DEFAULT FALSE,
  admin_reply TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ══════════════════════════════════════════════════════════════
-- GALLERY IMAGES (NEW)
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS gallery_images (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  -- File info
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,          -- path in Supabase Storage: 'gallery/abc123.webp'
  file_size INTEGER,                -- bytes
  -- Display info
  category TEXT NOT NULL DEFAULT 'interior'
    CHECK (category IN ('exterior', 'interior', 'bathroom', 'terrace', 'surroundings')),
  alt_text TEXT,                    -- accessibility alt text
  sort_order INTEGER DEFAULT 0,    -- for drag & drop reordering
  -- Flags
  is_hero BOOLEAN DEFAULT FALSE,   -- used as hero background image
  is_visible BOOLEAN DEFAULT TRUE  -- hide without deleting
);

-- ── Settings (key-value store) ──
CREATE TABLE IF NOT EXISTS settings (
  id BIGSERIAL PRIMARY KEY,
  key TEXT UNIQUE NOT NULL,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════
-- INDEXES
-- ═══════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_reservations_dates ON reservations (check_in, check_out);
CREATE INDEX IF NOT EXISTS idx_reservations_status ON reservations (status);
CREATE INDEX IF NOT EXISTS idx_seasonal_prices_dates ON seasonal_prices (date_from, date_to);
CREATE INDEX IF NOT EXISTS idx_blocked_dates_dates ON blocked_dates (date_from, date_to);
CREATE INDEX IF NOT EXISTS idx_reviews_approved ON reviews (approved);
CREATE INDEX IF NOT EXISTS idx_gallery_category ON gallery_images (category, sort_order);
CREATE INDEX IF NOT EXISTS idx_gallery_visible ON gallery_images (is_visible, sort_order);

-- ═══════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY (RLS)
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE seasonal_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE blocked_dates ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE gallery_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- Public read
CREATE POLICY "Public read seasonal_prices" ON seasonal_prices FOR SELECT TO anon USING (true);
CREATE POLICY "Public read blocked_dates" ON blocked_dates FOR SELECT TO anon USING (true);
CREATE POLICY "Public read approved reviews" ON reviews FOR SELECT TO anon USING (approved = true);
CREATE POLICY "Public read visible gallery" ON gallery_images FOR SELECT TO anon USING (is_visible = true);
CREATE POLICY "Public read settings" ON settings FOR SELECT TO anon USING (true);

-- Public write
CREATE POLICY "Public create reservations" ON reservations FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Public create reviews" ON reviews FOR INSERT TO anon WITH CHECK (true);

-- Admin (authenticated): full access
CREATE POLICY "Admin all reservations" ON reservations FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Admin all seasonal_prices" ON seasonal_prices FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Admin all blocked_dates" ON blocked_dates FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Admin all reviews" ON reviews FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Admin all gallery_images" ON gallery_images FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Admin all settings" ON settings FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ═══════════════════════════════════════════════════════════════
-- SUPABASE STORAGE BUCKET
-- ═══════════════════════════════════════════════════════════════

-- Create storage bucket for gallery images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'gallery',
  'gallery',
  true,                                          -- public bucket (images accessible via URL)
  10485760,                                      -- 10 MB max per file
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/avif']
) ON CONFLICT (id) DO NOTHING;

-- Storage policies: public read, authenticated write/delete
CREATE POLICY "Public read gallery files"
  ON storage.objects FOR SELECT
  TO anon
  USING (bucket_id = 'gallery');

CREATE POLICY "Authenticated upload gallery files"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'gallery');

CREATE POLICY "Authenticated update gallery files"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'gallery');

CREATE POLICY "Authenticated delete gallery files"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'gallery');

-- ═══════════════════════════════════════════════════════════════
-- HELPER FUNCTION: Get public URL for a storage file
-- ═══════════════════════════════════════════════════════════════

-- Usage in app: `${SUPABASE_URL}/storage/v1/object/public/gallery/${file_path}`
-- Or use supabase.storage.from('gallery').getPublicUrl(file_path)

-- ═══════════════════════════════════════════════════════════════
-- SEED DATA
-- ═══════════════════════════════════════════════════════════════

INSERT INTO seasonal_prices (season_name, date_from, date_to, price_per_night, min_nights) VALUES
  ('TOP LÉTO',      '2026-07-01', '2026-08-31', 12900, 7),
  ('TOP ZIMA',      '2026-02-01', '2026-03-15', 10900, 7),
  ('ZIMA',          '2026-01-01', '2026-01-31',  7900, 3),
  ('JARO/PODZIM',   '2026-06-01', '2026-06-30',  7900, 3),
  ('JARO/PODZIM',   '2026-09-01', '2026-09-30',  7900, 3),
  ('VEDLEJŠÍ',      '2026-05-01', '2026-05-31',  6500, 2),
  ('VEDLEJŠÍ',      '2026-10-01', '2026-10-31',  6500, 2),
  ('MIMO SEZÓNU',   '2026-04-01', '2026-04-30',  5500, 2),
  ('MIMO SEZÓNU',   '2026-11-01', '2026-11-30',  5500, 2),
  ('MIMO SEZÓNU',   '2026-12-01', '2026-12-19',  5500, 2);

INSERT INTO settings (key, value) VALUES
  ('cleaning_fee', '2500'),
  ('tourist_tax_per_person', '50'),
  ('deposit_min', '5000'),
  ('deposit_max', '10000'),
  ('bank_account', 'XXXX/XXXX'),
  ('contact_email', 'info@lipno20.cz'),
  ('contact_phone', '+420 XXX XXX XXX');
