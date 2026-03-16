# 🏡 Lipno Hideaway – lipno20.cz

Kompletní web pro pronájem rekreačního domu na Lipně. Funguje **ihned po spuštění** v demo režimu. Po připojení Supabase přepne na ostré data.

## ⚡ Rychlý start (5 minut)

```bash
# 1. Rozbalte a nainstalujte
cd lipno-hideaway
npm install

# 2. Spusťte lokálně
npm run dev
# → otevřete http://localhost:5173
```

**To je vše!** Web funguje okamžitě s demo daty. Admin dashboard: klikněte "Admin" v navigaci → jakékoliv heslo.

---

## 🚀 Nasazení na ostro (30 minut)

### Krok 1: Supabase (databáze + fotky)

1. Zaregistrujte se na **[supabase.com](https://supabase.com)** (zdarma)
2. Vytvořte nový projekt (region: Frankfurt/EU)
3. Otevřete **SQL Editor** a vložte celý obsah `supabase/schema.sql` → klikněte Run
4. Přejděte do **Settings → API** a zkopírujte:
   - `Project URL` → to je váš `VITE_SUPABASE_URL`
   - `anon public key` → to je váš `VITE_SUPABASE_ANON_KEY`

### Krok 2: Admin účet

V Supabase → **Authentication → Users → Add user**:
- Email: `admin@lipno20.cz` (nebo váš email)
- Password: vaše heslo
- ☑️ Auto Confirm

### Krok 3: GitHub (hosting)

1. Vytvořte nový repozitář na github.com
2. Nahrajte projekt:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/VAS-USERNAME/lipno-hideaway.git
   git push -u origin main
   ```
3. V repozitáři: **Settings → Secrets → Actions** → přidejte:
   - `VITE_SUPABASE_URL` = vaše Supabase URL
   - `VITE_SUPABASE_ANON_KEY` = váš anon key
4. **Settings → Pages → Source**: zvolte "GitHub Actions"
5. Push spustí automatický deploy

### Krok 4: Vlastní doména lipno20.cz

1. V GitHub: **Settings → Pages → Custom domain** → zadejte `www.lipno20.cz`
2. U registrátora domény nastavte DNS:
   ```
   www    CNAME    vas-username.github.io
   @      A        185.199.108.153
   @      A        185.199.109.153
   @      A        185.199.110.153
   @      A        185.199.111.153
   ```
3. Počkejte 5-10 minut, GitHub automaticky zapne HTTPS

### Krok 5: E-mailové notifikace (volitelné)

1. Zaregistrujte se na **[resend.com](https://resend.com)** (zdarma 100 emailů/den)
2. Ověřte doménu lipno20.cz
3. V Supabase CLI:
   ```bash
   supabase secrets set RESEND_API_KEY=re_xxxxx
   supabase functions deploy send-email
   ```

---

## 📋 Co web obsahuje

### Veřejná část (pro hosty)
- **Hero** s fullscreen fotkou a CTA
- **Galerie** s lightboxem a kategoriemi
- **Online rezervace** — kalendář, výpočet ceny, formulář
- **Ceník** dle sezóny s ALL INCLUSIVE info
- **Aktivity** v okolí (léto/zima)
- **Recenze** hostů s hodnocením
- **Kontakt** s mapou
- **4 jazyky** — CZ, EN, DE, NL

### Admin dashboard (pro vás)
- **Přehled** — statistiky, čekající rezervace
- **Správa rezervací** — tabulka, filtry, změna stavu
- **Správa galerie** — drag & drop nahrávání, kategorie, hero fotka, skrytí/smazání
- **Statistiky** — grafy obsazenosti a tržeb

---

## 📁 Struktura

```
lipno-hideaway/
├── src/
│   ├── App.jsx          ← Celá aplikace (frontend + admin)
│   ├── lib/
│   │   ├── supabase.js  ← Supabase klient
│   │   └── db.js        ← Data vrstva (Supabase nebo demo)
│   ├── main.jsx         ← Entry point
│   └── index.css        ← Tailwind + globální styly
├── supabase/
│   ├── schema.sql       ← Databáze + storage + RLS + seed data
│   └── functions/       ← Edge Functions (emaily)
├── public/favicon.svg
├── .github/workflows/deploy.yml  ← CI/CD
├── .env.example
└── package.json
```

## 🎨 Design

- **Organic Luxury** — lesní zelená + krém + terakota
- **Fonty** — Cormorant Garamond (nadpisy) + DM Sans (text)
- **Responzivní** — mobile-first, optimalizováno pro všechna zařízení

## 💡 Jak to funguje

```
BEZ Supabase (demo):     → Web běží s ukázkovými daty, vše funkční
SE Supabase:              → Web používá reálná data z databáze

Fotky:                    → Supabase Storage (1 GB zdarma)
Rezervace:                → Supabase PostgreSQL
E-maily:                  → Supabase Edge Functions + Resend
Hosting:                  → GitHub Pages (zdarma, HTTPS)
```

---

© 2026 Lipno Hideaway · lipno20.cz
