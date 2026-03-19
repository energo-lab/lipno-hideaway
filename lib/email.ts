// lib/email.ts – Email service using Resend
// Install: npm install resend
// Get API key: https://resend.com

import { Resend } from 'resend'
import type { Reservation } from './types'

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM = process.env.EMAIL_FROM ?? 'Lipno Hideaway <rezervace@lipno20.cz>'

// ─── Formatters ───────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'long', year: 'numeric' })
}

function formatPrice(n: number) {
  return n.toLocaleString('cs-CZ') + ' Kč'
}

// ─── Email Templates ──────────────────────────────────────

function bookingConfirmationHtml(r: Reservation): string {
  return `
<!DOCTYPE html>
<html lang="cs">
<head>
<meta charset="UTF-8">
<style>
  body { font-family: Georgia, serif; background:#f5f0eb; margin:0; padding:20px; }
  .card { background:#fff; max-width:600px; margin:0 auto; border-radius:12px; overflow:hidden; box-shadow:0 2px 20px rgba(0,0,0,.1); }
  .header { background:#1a2e1a; padding:40px 32px; text-align:center; }
  .header h1 { color:#d4af6a; font-size:28px; margin:0 0 8px; letter-spacing:1px; }
  .header p { color:#a0b898; margin:0; font-size:14px; }
  .body { padding:32px; }
  .body h2 { color:#1a2e1a; font-size:20px; margin:0 0 20px; }
  table { width:100%; border-collapse:collapse; margin:20px 0; }
  td { padding:10px 0; border-bottom:1px solid #f0e8d8; font-size:15px; color:#444; }
  td:first-child { font-weight:600; color:#1a2e1a; width:45%; }
  .total td { border-bottom:none; font-size:17px; }
  .total td:last-child { color:#d4af6a; font-weight:700; }
  .btn { display:inline-block; background:#1a2e1a; color:#d4af6a!important; text-decoration:none; padding:14px 32px; border-radius:8px; font-size:15px; margin:20px 0; }
  .footer { background:#f9f5f0; padding:24px 32px; text-align:center; font-size:13px; color:#888; }
  .footer a { color:#1a2e1a; }
</style>
</head>
<body>
<div class="card">
  <div class="header">
    <h1>🏡 Lipno Hideaway</h1>
    <p>Vaše rezervace byla přijata</p>
  </div>
  <div class="body">
    <h2>Dobrý den, ${r.guest_name.split(' ')[0]}!</h2>
    <p>Děkujeme za rezervaci. Níže najdete přehled Vašeho pobytu:</p>

    <table>
      <tr><td>Příjezd</td><td>${formatDate(r.check_in)}</td></tr>
      <tr><td>Odjezd</td><td>${formatDate(r.check_out)}</td></tr>
      <tr><td>Počet nocí</td><td>${r.nights}</td></tr>
      <tr><td>Dospělí / děti</td><td>${r.adults} / ${r.children}</td></tr>
      <tr><td>Cena za noc</td><td>${formatPrice(r.price_per_night)}</td></tr>
    </table>

    <table class="total">
      <tr><td>Celkem k úhradě</td><td>${formatPrice(r.total_price)}</td></tr>
    </table>

    ${r.deposit_amount > 0 ? `
    <p>📋 <strong>Záloha:</strong> ${formatPrice(r.deposit_amount)} splatná do 5 dnů. Zbývající částka ${formatPrice(r.total_price - r.deposit_amount)} je splatná při příjezdu.</p>
    ` : ''}

    <p style="margin-top:24px">Pokud máte otázky nebo změny, neváhejte nás kontaktovat:</p>
    <a class="btn" href="mailto:rezervace@lipno20.cz">Kontaktovat nás</a>

    <p style="font-size:13px;color:#888;margin-top:24px">
      Číslo rezervace: <code>${r.id.slice(0,8).toUpperCase()}</code>
    </p>
  </div>
  <div class="footer">
    <p>Lipno Hideaway · <a href="https://www.lipno20.cz">lipno20.cz</a></p>
    <p>📍 Lipno nad Vltavou · 📞 +420 000 000 000</p>
  </div>
</div>
</body>
</html>`
}

function paymentConfirmationHtml(r: Reservation, amount: number): string {
  return `
<!DOCTYPE html>
<html lang="cs">
<head>
<meta charset="UTF-8">
<style>
  body { font-family: Georgia, serif; background:#f5f0eb; margin:0; padding:20px; }
  .card { background:#fff; max-width:600px; margin:0 auto; border-radius:12px; overflow:hidden; box-shadow:0 2px 20px rgba(0,0,0,.1); }
  .header { background:#2a5c2a; padding:40px 32px; text-align:center; }
  .header h1 { color:#fff; font-size:28px; margin:0 0 8px; }
  .header p { color:#a8d4a8; margin:0; }
  .body { padding:32px; }
  .amount { font-size:36px; font-weight:700; color:#2a5c2a; text-align:center; padding:20px; }
  .footer { background:#f9f5f0; padding:24px 32px; text-align:center; font-size:13px; color:#888; }
</style>
</head>
<body>
<div class="card">
  <div class="header">
    <h1>✅ Platba přijata</h1>
    <p>Vaše platba byla úspěšně zpracována</p>
  </div>
  <div class="body">
    <p>Dobrý den, ${r.guest_name.split(' ')[0]}!</p>
    <p>Potvrzujeme přijetí platby:</p>
    <div class="amount">${formatPrice(amount)}</div>
    <p>za pobyt <strong>${formatDate(r.check_in)} – ${formatDate(r.check_out)}</strong>.</p>
    ${r.total_price - amount > 0 ? `<p>Zbývající doplatek: <strong>${formatPrice(r.total_price - amount)}</strong> – splatný při příjezdu.</p>` : '<p>Celá částka je uhrazena. Těšíme se na Vás! 🎉</p>'}
    <p>Číslo rezervace: <code>${r.id.slice(0,8).toUpperCase()}</code></p>
  </div>
  <div class="footer">
    <p>Lipno Hideaway · <a href="https://www.lipno20.cz">lipno20.cz</a></p>
  </div>
</div>
</body>
</html>`
}

function arrivalReminderHtml(r: Reservation): string {
  return `
<!DOCTYPE html>
<html lang="cs">
<head><meta charset="UTF-8">
<style>
  body { font-family: Georgia, serif; background:#f5f0eb; margin:0; padding:20px; }
  .card { background:#fff; max-width:600px; margin:0 auto; border-radius:12px; overflow:hidden; box-shadow:0 2px 20px rgba(0,0,0,.1); }
  .header { background:#1a2e1a; padding:32px; text-align:center; color:#d4af6a; }
  .body { padding:32px; line-height:1.7; color:#333; }
  .info-box { background:#f9f5f0; border-left:4px solid #d4af6a; padding:16px; border-radius:0 8px 8px 0; margin:20px 0; }
  .footer { background:#f9f5f0; padding:20px 32px; text-align:center; font-size:13px; color:#888; }
</style>
</head>
<body>
<div class="card">
  <div class="header"><h1>🏡 Těšíme se na Vás!</h1></div>
  <div class="body">
    <p>Dobrý den, ${r.guest_name.split(' ')[0]}!</p>
    <p>Za <strong>2 dny</strong> Vás čekáme v Lipno Hideaway. Zde jsou praktické informace pro Váš příjezd:</p>

    <div class="info-box">
      <strong>📅 Datum příjezdu:</strong> ${formatDate(r.check_in)}<br>
      <strong>🕓 Check-in:</strong> 15:00 – 20:00<br>
      <strong>🕓 Check-out:</strong> do 10:00
    </div>

    <div class="info-box">
      <strong>🔑 Přístup do chalupy:</strong><br>
      Klíče najdete v schránce u vchodu. Kód vám zašleme den před příjezdem.
    </div>

    <div class="info-box">
      <strong>📍 Adresa:</strong><br>
      Lipno nad Vltavou<br>
      <a href="https://maps.google.com">Navigovat →</a>
    </div>

    ${r.total_price - r.deposit_amount > 0 ? `
    <div class="info-box" style="border-color:#e07b39">
      <strong>💳 Doplatek při příjezdu:</strong> ${formatPrice(r.total_price - r.deposit_amount)}
    </div>` : ''}

    <p>V případě dotazů nás kontaktujte: <a href="mailto:rezervace@lipno20.cz">rezervace@lipno20.cz</a></p>
  </div>
  <div class="footer">Lipno Hideaway · lipno20.cz</div>
</div>
</body>
</html>`
}

// ─── Send Functions ───────────────────────────────────────

export async function sendBookingConfirmation(reservation: Reservation) {
  return resend.emails.send({
    from: FROM,
    to: reservation.guest_email,
    subject: `✅ Potvrzení rezervace – ${formatDate(reservation.check_in)}`,
    html: bookingConfirmationHtml(reservation),
  })
}

export async function sendPaymentConfirmation(reservation: Reservation, amount: number) {
  return resend.emails.send({
    from: FROM,
    to: reservation.guest_email,
    subject: `💳 Platba přijata – Lipno Hideaway`,
    html: paymentConfirmationHtml(reservation, amount),
  })
}

export async function sendArrivalReminder(reservation: Reservation) {
  return resend.emails.send({
    from: FROM,
    to: reservation.guest_email,
    subject: `🏡 Za 2 dny Vás čekáme! | Lipno Hideaway`,
    html: arrivalReminderHtml(reservation),
  })
}

export async function sendAdminNotification(reservation: Reservation, subject: string, message: string) {
  const adminEmail = process.env.ADMIN_EMAIL ?? 'admin@lipno20.cz'
  return resend.emails.send({
    from: FROM,
    to: adminEmail,
    subject,
    html: `<p>${message}</p><pre>${JSON.stringify(reservation, null, 2)}</pre>`,
  })
}
