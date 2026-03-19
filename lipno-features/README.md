# 🏡 Lipno Hideaway – Implementační průvodce

Tento balík přidává do projektu 4 klíčové funkce:

| # | Funkce | Soubory |
|---|--------|---------|
| 1 | **Správa rezervací** (admin) | `app/admin/reservations/page.tsx` |
| 2 | **Automatické e-maily** | `lib/email.ts`, `supabase/functions/send-reminders/` |
| 3 | **Platba kartou (Comgate)** | `lib/comgate.ts`, `app/api/payment/` |
| 4 | **AI chat na webu** | `components/chat/ChatWidget.tsx`, `app/api/chat/route.ts` |

---

## 1. Databáze (Supabase)

Spusťte v Supabase SQL Editoru:

```sql
-- Zkopírujte obsah souboru:
supabase/migrations/001_reservations.sql
```

Vytvoří tabulky: `guests`, `reservations`, `payments`, `email_logs`

---

## 2. Proměnné prostředí

Zkopírujte `.env.example` do `.env.local` a vyplňte:

```bash
cp .env.example .env.local
```

### Potřebné účty:
- **Supabase** – již máte (projekt lipno-hideaway)
- **Resend** – registrace zdarma na [resend.com](https://resend.com), 3 000 e-mailů/měsíc free
- **Comgate** – registrace na [comgate.cz](https://www.comgate.cz), je potřeba schválení (3-5 dní)
- **Anthropic** – API klíč na [console.anthropic.com](https://console.anthropic.com)

---

## 3. Instalace balíčků

```bash
npm install resend @anthropic-ai/sdk
```

---

## 4. Zkopírujte soubory do projektu

```
lib/types.ts                          → lib/types.ts
lib/email.ts                          → lib/email.ts
lib/comgate.ts                        → lib/comgate.ts
app/api/reservations/route.ts         → app/api/reservations/route.ts
app/api/payment/create/route.ts       → app/api/payment/create/route.ts
app/api/payment/webhook/route.ts      → app/api/payment/webhook/route.ts
app/api/chat/route.ts                 → app/api/chat/route.ts
app/admin/reservations/page.tsx       → app/admin/reservations/page.tsx
components/chat/ChatWidget.tsx        → components/chat/ChatWidget.tsx
```

---

## 5. Přidejte ChatWidget na web

V hlavním layoutu nebo na každé stránce:

```tsx
// app/layout.tsx nebo app/(public)/layout.tsx
import ChatWidget from '@/components/chat/ChatWidget'

export default function Layout({ children }) {
  return (
    <html>
      <body>
        {children}
        <ChatWidget />   {/* ← přidejte toto */}
      </body>
    </html>
  )
}
```

---

## 6. Ochrana admin sekce

Admin stránka musí být chráněna autentifikací. Pokud používáte Supabase Auth:

```tsx
// middleware.ts (projekt root)
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()
  const supabase = createMiddlewareClient({ req, res })
  const { data: { session } } = await supabase.auth.getSession()

  if (req.nextUrl.pathname.startsWith('/admin') && !session) {
    return NextResponse.redirect(new URL('/login', req.url))
  }
  return res
}

export const config = { matcher: ['/admin/:path*'] }
```

---

## 7. Comgate – nastavení

1. Zaregistrujte se na [comgate.cz/cs/platebni-brana](https://www.comgate.cz/cs/platebni-brana)
2. Po schválení dostanete `MERCHANT_ID` a `SECRET`
3. V portálu Comgate nastavte **Notification URL**:
   ```
   https://www.lipno20.cz/api/payment/webhook
   ```
4. Pro testování použijte `COMGATE_TEST=true`

### Jak odeslat platební odkaz hostu:
- V admin dashboardu → klikněte na rezervaci → tlačítko "💳 Zaslat platbu"
- Systém vytvoří platbu v Comgate a odkaz se zobrazí / odešle e-mailem

---

## 8. Automatické připomínky (Edge Function)

```bash
# Deploy edge function
supabase functions deploy send-reminders

# Nastavit cron (Supabase Dashboard > Database > Cron Jobs)
# Name: send-arrival-reminders
# Schedule: 0 9 * * *   (každý den v 9:00)
# Command: SELECT net.http_post(
#   url := 'https://your-project.supabase.co/functions/v1/send-reminders',
#   headers := '{"Authorization": "Bearer YOUR_ANON_KEY"}'::jsonb
# );
```

---

## 9. E-mailové šablony – přehled

| Šablona | Spouštěč | Popis |
|---------|----------|-------|
| `booking_confirmation` | Nová rezervace přes web | Potvrzení s detaily |
| `payment_confirmation` | Comgate webhook PAID | Potvrzení platby |
| `arrival_reminder` | 2 dny před check-in (cron) | Připomínka + kód |

---

## 10. Testování

```bash
# Test Comgate v sandbox módu:
COMGATE_TEST=true

# Test e-mailů (Resend v free tier pošle pouze na váš email):
# Přidejte doménu lipno20.cz v Resend dashboard

# Test webhooků lokálně:
npx stripe listen  # nebo použijte ngrok pro Comgate webhook
ngrok http 3000
# Nastavte v Comgate portálu: https://xxxx.ngrok.io/api/payment/webhook
```

---

## Architektura

```
Zákazník rezervuje na webu
        ↓
POST /api/reservations
        ↓ (vytvoří rezervaci v Supabase + email hostu)
Admin v dashboardu potvrdí
        ↓
POST /api/payment/create → Comgate API
        ↓ (vrátí paymentUrl, zobrazí/odešle hostu)
Host zaplatí kartou na Comgate
        ↓
Comgate → POST /api/payment/webhook
        ↓ (aktualizuje stav + email hostu)
Supabase cron → /functions/v1/send-reminders
        ↓ (2 dny před check-in email s instrukcemi)
```
