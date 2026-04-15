# Lipno Hideaway — Progress & Session Notes

Tento soubor slouží jako paměť mezi seseními. Při každém novém startu si ho přečti a víš přesně kde jsme.

---

## Security Audit (duben 2026)

### ✅ Hotovo

| Datum | Položka |
|---|---|
| Apr 2026 | **Supabase RLS** — smazány 4 nebezpečné `{public}` policies: `allow_all_reservations`, `allow_all_payments`, `allow_all_blocked_dates`, `allow_all_guests` |
| Apr 2026 | **002_security_hardening.sql** — spuštěno v Supabase. Vše OK, chyběla jen `check_availability` funkce (ostatní objekty existovaly). Vytvořeno. |
| Apr 2026 | **CSRF_SECRET** — vygenerován (`openssl rand -base64 32`) a přidán do Vercel env variables. Redeployováno (deployment `Gjuv6tHRE6xcJFBoKEGiVHJpxAkw`, Ready za 56s). |
| Apr 2026 | **COMGATE_TEST** — není nastavena = produkční režim Comgate ✅ |
| Apr 2026 | **Security headers** — zkontrolováno na securityheaders.com → skóre **A** |
| Apr 2026 | **next.config.js** — přidány `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `frame-ancestors 'none'` do CSP. Commit `e0d4217` připraven. |

---

### ⏳ Zbývá udělat (ruční kroky)

1. **`git push`** — připraveny commity k push (spusť ve Windows terminálu v adresáři projektu):
   ```bash
   git push
   ```
   - `e0d4217` X-Frame-Options + X-Content-Type-Options
   - `419e5c4` PROGRESS.md
   - `96dddb6` HSTS includeSubDomains + preload
   - `bb48932` bare domain redirect přes Next.js (fix pro HSTS preload)

2. **Vercel Dashboard → Domains**: po deployi ověřit, že `lipno20.cz` (bez www) je přidána
   jako doména projektu (ne jen externí přesměrování). Jinak `redirects()` v next.config.js
   nebude mít odkud zachytit provoz.
   → Vercel Dashboard → Project → Settings → Domains → přidat `lipno20.cz`

3. **Comgate Notification URL** — v portálu Comgate → Nastavení → Notification URL:
   ```
   https://www.lipno20.cz/api/payment/webhook
   ```

4. **HSTS preload** — ⚠️ Known limitation (Vercel Hobby):
   - `lipno20.cz` musí být redirect (Hobby neumí 2 domény na environment)
   - Vercel's 308 redirect přidává HSTS bez `includeSubDomains; preload`
   - hstspreload.org proto odmítá submit
   - Řešení: Vercel Pro upgrade ($20/mo), nebo akceptovat (www HSTS funguje)
   - HSTS preloading není kritická zranitelnost, jen nice-to-have

5. **Otestovat webhook** s Comgate sandboxem (viz SECURITY.md → Penetrační testování)

---

### Poznámky

- SSL Labs nedokáže otestovat Vercel CDN (blokuje scanner) — není to chyba SSL, Vercel garantuje TLS 1.3 automaticky
- `SUPABASE_SERVICE_ROLE_KEY` je bezpečně server-only i přes "All Environments" — v Next.js se proměnné bez `NEXT_PUBLIC_` prefixu nikdy neposílají na klienta
- `VITE_SUPABASE_*` klíče jsou duplikáty z původní Vite verze, v Next.js se nepoužívají (ale neškodí)

---

## Architektura (rychlý přehled)

- **Frontend**: Next.js 14 App Router, hostováno na Vercel
- **Databáze**: Supabase (PostgreSQL + RLS)
- **Platby**: Comgate webhook → `/api/payment/webhook`
- **Email**: Resend API
- **AI**: Anthropic (admin funkce)
- **Doména**: www.lipno20.cz

## Klíčové soubory

| Soubor | Účel |
|---|---|
| `middleware.ts` | Admin auth (ochrana `/admin/reservations`) |
| `next.config.js` | Security headers (CSP, HSTS, X-Frame-Options…) |
| `lib/security.ts` | Input sanitizace, rate limit, COMGATE_IP_RANGES |
| `app/api/payment/webhook/route.ts` | Comgate webhook handler |
| `supabase/migrations/002_security_hardening.sql` | RLS, triggers, check_availability |
| `lipno-features/SECURITY.md` | Kompletní security guide a checklist |
