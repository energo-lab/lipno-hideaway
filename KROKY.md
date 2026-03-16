# Lipno Hideaway – Co udělat krok za krokem

Kompletní návod od rozbalení po živý web na lipno20.cz.
Odhadovaný čas: cca 2 hodiny.

---

## FÁZE 1: Ověření lokálně (15 minut)

### 1.1 Nainstalujte Node.js
- Stáhněte z https://nodejs.org (verze 20 LTS)
- Nainstalujte, restartujte počítač

### 1.2 Rozbalte projekt a spusťte
```
Rozbalte lipno-hideaway.zip do složky na počítači
Otevřete terminál (Windows: cmd nebo PowerShell)
cd cesta/k/lipno-hideaway
npm install
npm run dev
```
Otevřete v prohlížeči: http://localhost:5173

### 1.3 Ověřte, že vše funguje
- [ ] Web se zobrazí s demo daty
- [ ] Funguje přepínání jazyků (CZ/EN/DE/NL)
- [ ] Galerie s lightboxem
- [ ] Kalendář rezervací
- [ ] Klikněte "Admin" v navigaci → jakékoliv heslo → dashboard
- [ ] V adminu funguje záložka Galerie (nahrávání fotek)

---

## FÁZE 2: Supabase – databáze a storage (30 minut)

### 2.1 Vytvořte Supabase projekt
1. Jděte na https://supabase.com → Sign Up (zdarma)
2. Klikněte "New Project"
3. Název: `lipno-hideaway`
4. Region: `Central EU (Frankfurt)` ← nejbližší k ČR
5. Zadejte databázové heslo (uložte si ho!)
6. Počkejte 1-2 minuty na vytvoření

### 2.2 Spusťte databázové schéma
1. V Supabase klikněte "SQL Editor" v levém menu
2. Klikněte "New query"
3. Otevřete soubor `supabase/schema.sql` z projektu
4. Zkopírujte CELÝ obsah a vložte do editoru
5. Klikněte "Run" (zelené tlačítko)
6. Mělo by se zobrazit "Success. No rows returned."

### 2.3 Vytvořte admin účet
1. V Supabase klikněte "Authentication" → "Users"
2. Klikněte "Add user" → "Create new user"
3. Vyplňte:
   - Email: váš email (např. info@lipno20.cz)
   - Password: silné heslo
   - Zaškrtněte "Auto Confirm User"
4. Klikněte "Create user"

### 2.4 Zkopírujte API klíče
1. V Supabase klikněte "Settings" (ozubené kolo) → "API"
2. Zkopírujte a uložte si:
   - **Project URL** → vypadá jako: `https://abcdefg.supabase.co`
   - **anon public key** → dlouhý řetězec začínající `eyJ...`

### 2.5 Připojte web k Supabase
1. Ve složce projektu vytvořte soubor `.env` (bez přípony)
2. Vložte do něj:
```
VITE_SUPABASE_URL=https://vase-url.supabase.co
VITE_SUPABASE_ANON_KEY=vas-anon-key
```
3. Restartujte dev server (Ctrl+C, pak znovu `npm run dev`)
4. Web nyní používá reálnou databázi!

### 2.6 Ověřte Supabase propojení
- [ ] V adminu se přihlaste svým emailem a heslem ze Supabase
- [ ] Zkuste nahrát fotku v záložce Galerie
- [ ] Vytvořte testovací rezervaci na webu
- [ ] V adminu se zobrazí v záložce Rezervace

---

## FÁZE 3: Fotky domu (30 minut)

### 3.1 Připravte fotky
- Vyfoťte/shromážděte fotky domu (15-25 fotek)
- Doporučené rozlišení: min. 1920×1280 px
- Zmenšete na webu https://squoosh.app (formát WebP, kvalita 80%)
- Ideální velikost: 200-500 KB na fotku

### 3.2 Rozdělte do kategorií
Připravte si fotky do skupin:
- Exteriér (3-5 fotek) – dům zvenku, příjezd, zahrada
- Interiér (4-6 fotek) – obývák, kuchyně, ložnice, jídelna
- Koupelny (2-3 fotky)
- Terasa (2-3 fotky) – terasa, gril, zahradní nábytek
- Okolí (3-4 fotky) – výhled na jezero, příroda

### 3.3 Nahrajte přes admin dashboard
1. Přihlaste se do adminu
2. Záložka "Galerie"
3. Přetáhněte fotky do upload zóny (nebo klikněte)
4. U každé fotky vyberte správnou kategorii z dropdownu
5. Označte nejlepší fotku výhledu jako "HERO" (hvězdička) – bude na úvodní stránce

### 3.4 Zkontrolujte
- [ ] Fotky se zobrazují v galerii na webu
- [ ] Hero fotka je na úvodní stránce jako pozadí
- [ ] Lightbox funguje při kliknutí na fotku

---

## FÁZE 4: GitHub a nasazení (30 minut)

### 4.1 Vytvořte GitHub účet
1. Pokud nemáte: https://github.com → Sign Up
2. Stáhněte GitHub Desktop: https://desktop.github.com (jednodušší než terminál)

### 4.2 Vytvořte repozitář
1. Na github.com klikněte "+" → "New repository"
2. Název: `lipno-hideaway`
3. Viditelnost: Public (nutné pro GitHub Pages zdarma)
4. NEVYBÍREJTE žádné šablony, nechte prázdný
5. Klikněte "Create repository"

### 4.3 Nahrajte kód
**Varianta A – GitHub Desktop (jednodušší):**
1. Otevřete GitHub Desktop
2. File → Add Local Repository → vyberte složku lipno-hideaway
3. Napište commit message: "Initial commit"
4. Klikněte "Commit to main"
5. Klikněte "Publish repository"

**Varianta B – Terminál:**
```
cd cesta/k/lipno-hideaway
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/VAS-USERNAME/lipno-hideaway.git
git push -u origin main
```

### 4.4 Přidejte Supabase klíče do GitHub Secrets
1. Na github.com otevřete váš repozitář
2. Settings → Secrets and variables → Actions
3. Klikněte "New repository secret" a přidejte:
   - Name: `VITE_SUPABASE_URL` → Value: vaše Supabase URL
   - Name: `VITE_SUPABASE_ANON_KEY` → Value: váš anon key

### 4.5 Zapněte GitHub Pages
1. V repozitáři: Settings → Pages
2. Source: vyberte "GitHub Actions"
3. Uložte

### 4.6 Spusťte první deploy
1. Přejděte do záložky "Actions" v repozitáři
2. Měl by se automaticky spustit workflow "Deploy to GitHub Pages"
3. Počkejte 2-3 minuty (zelená fajfka = úspěch)
4. Web bude dostupný na: `https://vas-username.github.io/lipno-hideaway`

### 4.7 Ověřte deploy
- [ ] Web se načte na github.io adrese
- [ ] Fotky se zobrazují (ze Supabase)
- [ ] Admin přihlášení funguje
- [ ] Rezervace se ukládají

---

## FÁZE 5: Vlastní doména lipno20.cz (15 minut)

### 5.1 Nastavte doménu v GitHub
1. V repozitáři: Settings → Pages → Custom domain
2. Zadejte: `www.lipno20.cz`
3. Zaškrtněte "Enforce HTTPS"

### 5.2 Nastavte DNS u registrátora domény
Přihlaste se k vašemu registrátorovi domény (např. Wedos, Forpsi, Active24) a nastavte:

**Pro www.lipno20.cz:**
```
Typ: CNAME
Název: www
Hodnota: vas-username.github.io
```

**Pro lipno20.cz (bez www):**
```
Typ: A    Hodnota: 185.199.108.153
Typ: A    Hodnota: 185.199.109.153
Typ: A    Hodnota: 185.199.110.153
Typ: A    Hodnota: 185.199.111.153
```

### 5.3 Počkejte na propagaci
- DNS změny se projeví za 5-30 minut (někdy až 24h)
- GitHub automaticky vytvoří HTTPS certifikát
- Zkontrolujte: https://www.lipno20.cz

### 5.4 Vytvořte CNAME soubor
V projektu ve složce `public/` vytvořte soubor `CNAME` (bez přípony) s obsahem:
```
www.lipno20.cz
```
Pushněte změnu na GitHub.

---

## FÁZE 6: Sociální sítě (20 minut)

### 6.1 Vytvořte profily (pokud nemáte)
- [ ] Instagram – profil @lipno_hideaway (nebo podobný)
- [ ] Facebook stránka – "Lipno Hideaway"
- [ ] Google Business Profile – https://business.google.com → přidejte firmu
- [ ] Booking.com – zaregistrujte nemovitost
- [ ] TripAdvisor – přidejte ubytování

### 6.2 Aktualizujte odkazy na webu
V souboru `src/App.jsx` najděte blok `SOCIAL_LINKS` a nahraďte ukázkové URL:
```js
const SOCIAL_LINKS = {
  instagram: "https://instagram.com/VAS_PROFIL",
  facebook: "https://facebook.com/VASE_STRANKA",
  google: "https://g.page/r/VAS_GOOGLE_ID/review",
  booking: "https://booking.com/hotel/VAS_ID",
  airbnb: "https://airbnb.com/rooms/VAS_ID",
  tripadvisor: "https://tripadvisor.com/VAS_ID",
};
```

### 6.3 Google Reviews odkaz
1. Přejděte na https://business.google.com
2. Vyberte svou firmu
3. Klikněte "Získat více recenzí" (nebo "Ask for reviews")
4. Zkopírujte odkaz → vložte jako `google:` v SOCIAL_LINKS

### 6.4 Pushněte změny
```
git add .
git commit -m "Updated social links"
git push
```
GitHub automaticky přenasadí web.

---

## FÁZE 7: E-mailové notifikace (volitelné, 15 minut)

### 7.1 Resend.com
1. Zaregistrujte se na https://resend.com (zdarma 100 emailů/den)
2. Přidejte doménu lipno20.cz a ověřte (DNS záznamy)
3. Vytvořte API klíč

### 7.2 Nastavte v Supabase
1. Nainstalujte Supabase CLI: `npm install -g supabase`
2. Přihlaste se: `supabase login`
3. Propojte projekt: `supabase link --project-ref VAS_PROJECT_REF`
4. Přidejte secret: `supabase secrets set RESEND_API_KEY=re_xxxxx`
5. Deploy funkce: `supabase functions deploy send-email`

Po tomto kroku budou hosté dostávat automatické e-maily po vytvoření rezervace.

---

## FÁZE 8: Osobní údaje na webu (10 minut)

### 8.1 Aktualizujte kontaktní údaje
V `src/App.jsx` najděte a nahraďte:
- `+420 XXX XXX XXX` → váš telefon
- `info@lipno20.cz` → váš email (pokud jiný)

### 8.2 Aktualizujte platební údaje
V `supabase/functions/send-email/index.ts` nahraďte:
- `XXXX/XXXX` → vaše číslo účtu pro platby

### 8.3 Aktualizujte ceník
Pokud chcete změnit ceny, upravte:
- V `src/App.jsx` → pole `SEASONS` (pro zobrazení na webu)
- V Supabase SQL Editoru → tabulka `seasonal_prices` (pro výpočet cen)

### 8.4 Finální push
```
git add .
git commit -m "Personal details updated"
git push
```

---

## KONTROLNÍ SEZNAM – vše hotovo?

### Technické
- [ ] Web běží na https://www.lipno20.cz
- [ ] HTTPS certifikát aktivní (zámek v prohlížeči)
- [ ] Supabase propojeno (ne demo data)
- [ ] Admin přihlášení funguje

### Obsah
- [ ] Nahrány reálné fotky domu (15-25 ks)
- [ ] Nastaven hero obrázek (výhled na jezero)
- [ ] Kontaktní údaje aktualizovány (telefon, email)
- [ ] Platební údaje v e-mailových šablonách
- [ ] Ceník odpovídá realitě

### Sociální sítě
- [ ] Instagram profil vytvořen a propojen
- [ ] Facebook stránka vytvořena a propojena
- [ ] Google Business Profile vytvořen
- [ ] Google Reviews odkaz funguje
- [ ] Booking.com / Airbnb profily propojeny

### Testování
- [ ] Otevřete web na mobilu – vše čitelné a klikatelné
- [ ] Otestujte v angličtině, němčině, holandštině
- [ ] Vytvořte testovací rezervaci – dorazí email?
- [ ] Požádejte 2-3 lidi o otestování (dají vám zpětnou vazbu)

---

## Hotovo! 🎉

Web je živý na lipno20.cz. Nyní:
1. Sdílejte odkaz na sociálních sítích
2. Přidejte URL na Booking.com a Airbnb profily
3. První hosté mohou začít rezervovat
