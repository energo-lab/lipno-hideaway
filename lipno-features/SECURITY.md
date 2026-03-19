# 🔐 Lipno Hideaway – Security Guide

## Vrstvy zabezpečení

```
Internet
   │
   ▼
[Vercel Edge Network] ← DDoS ochrana, TLS 1.3
   │
   ▼
[middleware.ts] ← CSP, HSTS, rate limit, bot detection, admin auth
   │
   ▼
[API routes] ← rate limit, IP check, input validation, CORS
   │
   ▼
[lib/security.ts] ← sanitizace, SQL injection detection, logging
   │
   ▼
[Supabase DB] ← RLS, triggers (prevent paid downgrade), audit log
```

---

## Co je chráněno a jak

### 1. Comgate webhook (nejkritičtější)
| Hrozba | Ochrana |
|--------|---------|
| Falešný webhook | Timing-safe porovnání COMGATE_SECRET |
| Replay attack | In-memory idempotency cache (5 min okno) |
| IP spoofing | Whitelist Comgate IP rozsahů |
| Špatná částka | Server-side ověření price == payment.amount |
| Status downgrade | DB trigger zabrání změně z 'paid' zpět |
| DDoS | Rate limit 30 req/10s per IP |

### 2. Rezervační formulář
| Hrozba | Ochrana |
|--------|---------|
| SQL injection | Pattern detection + parameterized queries |
| XSS | HTML sanitizace všech vstupů |
| CSRF | Origin header validace |
| Spam | Rate limit 5/min per IP, blok 10 min |
| Cenová manipulace | Cena se VŽDY počítá na serveru |
| Oversized body | Max 8 KB limit |

### 3. Admin sekce
| Hrozba | Ochrana |
|--------|---------|
| Neoprávněný přístup | Supabase Auth session check v middleware |
| Brute force | Rate limit 5 pokusů/5 min, blok 30 min |
| Clickjacking | X-Frame-Options: DENY |
| Session hijacking | HTTPS only (HSTS preload) |

### 4. Celý web
| Hrozba | Ochrana |
|--------|---------|
| XSS | Content-Security-Policy s nonce |
| Clickjacking | frame-ancestors 'none' |
| MIME sniffing | X-Content-Type-Options: nosniff |
| Info leakage | poweredByHeader: false, no source maps |
| Scanner boty | UA pattern blocking (sqlmap, nikto…) |
| Path traversal | Suspicious path detection v middleware |
| DDoS | 200 req/min global + 30 req/min API per IP |

---

## Nastavení ENV proměnných

### Povinné pro bezpečnost:
```bash
# Generujte bezpečný CSRF secret:
openssl rand -base64 32

# Do .env.local:
CSRF_SECRET=<výstup výše>
COMGATE_SECRET=<z portálu Comgate>
COMGATE_MERCHANT_ID=<z portálu Comgate>
SUPABASE_SERVICE_ROLE_KEY=<NIKDY na klienta!>
```

### Vercel ENV (nutné nastavit v Dashboard):
```
Settings → Environment Variables
- Přidejte všechny proměnné z .env.example
- SUPABASE_SERVICE_ROLE_KEY: zaškrtněte POUZE "Server"
- COMGATE_SECRET: zaškrtněte POUZE "Server"
- ANTHROPIC_API_KEY: zaškrtněte POUZE "Server"
- RESEND_API_KEY: zaškrtněte POUZE "Server"
```

---

## Comgate produkční nastavení

1. V portálu Comgate → Nastavení → Notification URL:
   ```
   https://www.lipno20.cz/api/payment/webhook
   ```
2. Povolte pouze HTTPS (HTTP notifikace odmítnout)
3. Nastavte `COMGATE_TEST=false` pro produkci
4. Ověřte IP adresy Comgate v `lib/security.ts` → `COMGATE_IP_RANGES`
   (aktuální seznam na https://apidoc.comgate.cz/)

---

## Supabase produkční nastavení

1. **Database Password**: Nastavte silné heslo (min 24 znaků)
2. **Auth**: Zakažte přihlášení emailem/heslem pro nežádoucí uživatele
3. **RLS**: Zkontrolujte, že jsou policies aktivní:
   ```sql
   SELECT schemaname, tablename, rowsecurity
   FROM pg_tables WHERE schemaname = 'public';
   -- rowsecurity musí být 't' pro všechny tabulky
   ```
4. **API keys**: Anon key je veřejný – service role key NIKDY na klientovi
5. **Point-in-time Recovery**: Zapněte v Settings pro zálohy plateb

---

## Security audit checklist

Před spuštěním do produkce zkontrolujte:

- [ ] `COMGATE_TEST=false`
- [ ] `CSRF_SECRET` nastaven (min 32 znaků, náhodný)
- [ ] `SUPABASE_SERVICE_ROLE_KEY` pouze v Server env na Vercel
- [ ] Comgate Notification URL nastavena na produkční doménu
- [ ] Spuštěn `002_security_hardening.sql` v Supabase
- [ ] HSTS preload: submit na https://hstspreload.org/
- [ ] Otestujte webhook s Comgate sandbox
- [ ] Security headers: zkontrolujte na https://securityheaders.com/
- [ ] SSL rating: zkontrolujte na https://www.ssllabs.com/ssltest/

---

## Monitoring bezpečnostních událostí

Security eventy jsou logovány do:
1. **Vercel Logs** (console.error) – okamžitě dostupné
2. **Admin email** – pro HIGH a CRITICAL severity automaticky
3. **Supabase** `security_audit_log` tabulka (pro budoucí rozšíření)

### Nejdůležitější eventy k monitorování:
| Event | Severity | Akce |
|-------|----------|------|
| WEBHOOK_INVALID_SECRET | CRITICAL | Okamžitě prověřit |
| PAYMENT_AMOUNT_MISMATCH | CRITICAL | Zkontrolovat platbu v Comgate |
| PAYMENT_REPLAY_ATTACK | CRITICAL | Prověřit IP, zvážit ban |
| AUTH_FAILED (opakovaně) | HIGH | Zkontrolovat brute force |
| RATE_LIMIT_EXCEEDED (opakovaně) | MEDIUM | Zvážit trvalý IP ban |

---

## Penetrační testování (checklist)

Otestujte před spuštěním:

### Webhook:
```bash
# Falešný secret
curl -X POST https://www.lipno20.cz/api/payment/webhook \
  -d "merchant=123&transId=TEST&secret=WRONG&status=PAID&refId=test"

# Replay (stejný request 2x)
# Rate limit (>30 req/10s)
# Špatná IP (jiná než Comgate) – testujte s COMGATE_TEST=false
```

### Rezervace:
```bash
# SQL injection
curl -X POST https://www.lipno20.cz/api/reservations \
  -H "Content-Type: application/json" \
  -d '{"guest_name":"test OR 1=1","guest_email":"t@t.cz","check_in":"2025-08-01","check_out":"2025-08-05","adults":2}'

# XSS
# Oversized body (>8 KB)
# Minulé datum
# Rate limit (>5 req/min)
```
