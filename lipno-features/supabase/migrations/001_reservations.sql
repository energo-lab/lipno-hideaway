-- ============================================================
-- LIPNO HIDEAWAY – Reservations schema
-- Run in Supabase SQL Editor
-- ============================================================

-- Guests table
CREATE TABLE IF NOT EXISTS guests (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,
  email        TEXT NOT NULL,
  phone        TEXT,
  country      TEXT DEFAULT 'CZ',
  notes        TEXT,
  created_at   TIMESTAMPTZ DEFAULT now()
);

-- Reservations table
CREATE TABLE IF NOT EXISTS reservations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_id        UUID REFERENCES guests(id) ON DELETE SET NULL,
  -- Denormalized for easy display even if guest deleted:
  guest_name      TEXT NOT NULL,
  guest_email     TEXT NOT NULL,
  guest_phone     TEXT,
  check_in        DATE NOT NULL,
  check_out       DATE NOT NULL,
  nights          INT GENERATED ALWAYS AS (check_out - check_in) STORED,
  adults          INT NOT NULL DEFAULT 2,
  children        INT NOT NULL DEFAULT 0,
  price_per_night NUMERIC(10,2) NOT NULL,
  total_price     NUMERIC(10,2) NOT NULL,
  deposit_amount  NUMERIC(10,2) DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','confirmed','paid','cancelled','completed')),
  payment_method  TEXT CHECK (payment_method IN ('card','transfer','cash')),
  source          TEXT DEFAULT 'website' CHECK (source IN ('website','airbnb','booking','phone','email')),
  internal_notes  TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- Payments table
CREATE TABLE IF NOT EXISTS payments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id  UUID NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
  comgate_trans_id TEXT,
  amount          NUMERIC(10,2) NOT NULL,
  currency        TEXT DEFAULT 'CZK',
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','paid','cancelled','authorized','error')),
  payment_url     TEXT,
  paid_at         TIMESTAMPTZ,
  raw_response    JSONB,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- Email log
CREATE TABLE IF NOT EXISTS email_logs (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id UUID REFERENCES reservations(id) ON DELETE SET NULL,
  email_to       TEXT NOT NULL,
  template       TEXT NOT NULL,
  status         TEXT DEFAULT 'sent',
  provider_id    TEXT,
  created_at     TIMESTAMPTZ DEFAULT now()
);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS reservations_updated_at ON reservations;
CREATE TRIGGER reservations_updated_at
  BEFORE UPDATE ON reservations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS policies
ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE guests ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;

-- Only authenticated (admin) users can read/write
CREATE POLICY "admin_all" ON reservations FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "admin_all" ON guests FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "admin_all" ON payments FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "admin_all" ON email_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Service role (API routes) bypasses RLS – no policy needed for service_role

-- Sample data (remove in production)
INSERT INTO guests (name, email, phone) VALUES
  ('Jan Novák', 'jan.novak@example.cz', '+420 777 123 456'),
  ('Marie Svobodová', 'marie@example.cz', '+420 602 987 654');
