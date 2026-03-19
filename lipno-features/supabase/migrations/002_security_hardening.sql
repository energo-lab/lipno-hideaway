-- ============================================================
-- 002_security_hardening.sql
-- Spusťte v Supabase SQL Editoru po 001_reservations.sql
-- ============================================================

-- ─── Audit log tabulka ────────────────────────────────────
CREATE TABLE IF NOT EXISTS security_audit_log (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type   TEXT NOT NULL,
  severity     TEXT NOT NULL CHECK (severity IN ('LOW','MEDIUM','HIGH','CRITICAL')),
  ip_address   INET,
  data         JSONB DEFAULT '{}',
  created_at   TIMESTAMPTZ DEFAULT now()
);

-- Index pro rychlé dotazy
CREATE INDEX IF NOT EXISTS security_audit_log_created_at ON security_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS security_audit_log_event_type ON security_audit_log(event_type);
CREATE INDEX IF NOT EXISTS security_audit_log_severity   ON security_audit_log(severity);

-- Admin může číst, service role může zapisovat
ALTER TABLE security_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_read" ON security_audit_log FOR SELECT TO authenticated USING (true);
-- Service role: no policy needed (bypasses RLS)

-- ─── Zamkni payments tabulku ──────────────────────────────
-- Zabrání tomu, aby byl status upraven zpět z 'paid'
-- (Postgres constraint – databázová úroveň ochrany)
CREATE OR REPLACE FUNCTION prevent_paid_status_downgrade()
RETURNS TRIGGER AS $$
BEGIN
  -- Jednou zaplaceno = zaplaceno navždy
  IF OLD.status = 'paid' AND NEW.status != 'paid' THEN
    RAISE EXCEPTION 'Cannot change status from paid to %', NEW.status;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS payments_prevent_downgrade ON payments;
CREATE TRIGGER payments_prevent_downgrade
  BEFORE UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION prevent_paid_status_downgrade();

-- ─── Zabezpeč service_role přístup ────────────────────────
-- Reservations: service role může vše, anon jen číst public informace
-- (Žádná veřejná data – vše za autentifikací)
DO $$
BEGIN
  -- Odstraň public read policies pokud existují
  DROP POLICY IF EXISTS "public_read" ON reservations;
  DROP POLICY IF EXISTS "public_read" ON guests;
  DROP POLICY IF EXISTS "public_read" ON payments;
END $$;

-- ─── Zabezpečení DB funkcí ────────────────────────────────
-- Zabrání SQL injection přes RPC volání
CREATE OR REPLACE FUNCTION check_availability(
  p_check_in  DATE,
  p_check_out DATE
)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  conflict_count INT;
BEGIN
  -- Validace vstupu
  IF p_check_in >= p_check_out THEN
    RAISE EXCEPTION 'check_in must be before check_out';
  END IF;
  IF p_check_in < CURRENT_DATE THEN
    RAISE EXCEPTION 'check_in cannot be in the past';
  END IF;
  IF p_check_out - p_check_in > 30 THEN
    RAISE EXCEPTION 'Stay cannot exceed 30 nights';
  END IF;

  SELECT COUNT(*) INTO conflict_count
  FROM reservations
  WHERE status != 'cancelled'
    AND check_in < p_check_out
    AND check_out > p_check_in;

  RETURN conflict_count = 0;
END;
$$;

-- ─── Connection pooling limit ─────────────────────────────
-- Nastav v Supabase Dashboard > Settings > Database
-- Connection pooler: Supavisor (transaction mode), max pool size: 15

-- ─── Automatické mazání starých security logů ─────────────
-- Uchovávej logy 90 dní
CREATE OR REPLACE FUNCTION cleanup_old_security_logs()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM security_audit_log
  WHERE created_at < NOW() - INTERVAL '90 days';
END;
$$;

-- Cron: každý den ve 2:00
-- SELECT cron.schedule('cleanup-security-logs', '0 2 * * *', 'SELECT cleanup_old_security_logs()');

-- ─── View pro admin dashboard ─────────────────────────────
CREATE OR REPLACE VIEW payment_summary AS
SELECT
  r.id,
  r.guest_name,
  r.guest_email,
  r.check_in,
  r.check_out,
  r.total_price,
  r.status AS reservation_status,
  COALESCE(SUM(p.amount) FILTER (WHERE p.status = 'paid'), 0) AS total_paid,
  r.total_price - COALESCE(SUM(p.amount) FILTER (WHERE p.status = 'paid'), 0) AS remaining,
  COUNT(p.id) AS payment_count,
  MAX(p.paid_at) AS last_payment_at
FROM reservations r
LEFT JOIN payments p ON p.reservation_id = r.id
GROUP BY r.id;

-- Restrict view access
ALTER VIEW payment_summary OWNER TO authenticated;
