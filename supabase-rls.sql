-- =====================================================
-- Supabase Row Level Security (RLS)
-- Lipno Hideaway – spustit v Supabase SQL Editoru
-- =====================================================

-- 1. ZAPNOUT RLS na tabulkách
ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE blocked_dates ENABLE ROW LEVEL SECURITY;
ALTER TABLE guests        ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 2. RESERVATIONS
-- =====================================================

-- Veřejný web smí POUZE vkládat nové rezervace (POST /api/reservations)
CREATE POLICY "public_insert_reservations"
  ON reservations FOR INSERT
  TO anon
  WITH CHECK (true);

-- Číst smí všichni přihlášení uživatelé (admin) i service_role
CREATE POLICY "admin_read_reservations"
  ON reservations FOR SELECT
  TO authenticated
  USING (true);

-- Aktualizovat a mazat smí pouze přihlášený admin (authenticated)
CREATE POLICY "admin_update_reservations"
  ON reservations FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "admin_delete_reservations"
  ON reservations FOR DELETE
  TO authenticated
  USING (true);

-- =====================================================
-- 3. BLOCKED_DATES
-- =====================================================

-- Číst smí kdokoliv (nutné pro zobrazení kalendáře na webu)
CREATE POLICY "public_read_blocked_dates"
  ON blocked_dates FOR SELECT
  TO anon, authenticated
  USING (true);

-- Vkládat a mazat smí pouze přihlášený admin
CREATE POLICY "admin_insert_blocked_dates"
  ON blocked_dates FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "admin_delete_blocked_dates"
  ON blocked_dates FOR DELETE
  TO authenticated
  USING (true);

-- =====================================================
-- 4. GUESTS
-- =====================================================

-- Vkládat smí anon i (přes server s service_role klíčem)
CREATE POLICY "public_insert_guests"
  ON guests FOR INSERT
  TO anon
  WITH CHECK (true);

-- Číst smí pouze admin
CREATE POLICY "admin_read_guests"
  ON guests FOR SELECT
  TO authenticated
  USING (true);

-- =====================================================
-- POZOR: API endpointy používají SUPABASE_SERVICE_ROLE_KEY,
-- který RLS obchází. RLS chrání přímý přístup přes anon key
-- (např. z prohlížeče). Pro plnou ochranu ponechte
-- SUPABASE_SERVICE_ROLE_KEY POUZE na serveru (v .env).
-- =====================================================
