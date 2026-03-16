import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const FROM = "Lipno Hideaway <noreply@lipno20.cz>";
const ADMIN = "info@lipno20.cz";

const tpl = {
  cs: (r) => ({ subject: `Nová rezervace #${r.id} – Lipno Hideaway`, html: `<h2>Děkujeme za rezervaci!</h2><p><b>Příjezd:</b> ${r.check_in}<br><b>Odjezd:</b> ${r.check_out}<br><b>Osob:</b> ${r.num_guests}<br><b>Cena:</b> ${r.total_price?.toLocaleString("cs")} Kč</p><h3>Platba převodem</h3><p><b>Účet:</b> XXXX/XXXX<br><b>VS:</b> ${r.id}<br><b>Částka:</b> ${r.total_price?.toLocaleString("cs")} Kč</p>` }),
  en: (r) => ({ subject: `New booking #${r.id} – Lipno Hideaway`, html: `<h2>Thank you for your booking!</h2><p><b>Check-in:</b> ${r.check_in}<br><b>Check-out:</b> ${r.check_out}<br><b>Guests:</b> ${r.num_guests}<br><b>Total:</b> ${r.total_price?.toLocaleString("cs")} CZK</p><h3>Bank transfer</h3><p><b>Account:</b> XXXX/XXXX<br><b>Ref:</b> ${r.id}<br><b>Amount:</b> ${r.total_price?.toLocaleString("cs")} CZK</p>` }),
  de: (r) => ({ subject: `Neue Buchung #${r.id} – Lipno Hideaway`, html: `<h2>Vielen Dank für Ihre Buchung!</h2><p><b>Anreise:</b> ${r.check_in}<br><b>Abreise:</b> ${r.check_out}<br><b>Gäste:</b> ${r.num_guests}<br><b>Preis:</b> ${r.total_price?.toLocaleString("cs")} CZK</p><h3>Überweisung</h3><p><b>Konto:</b> XXXX/XXXX<br><b>VS:</b> ${r.id}<br><b>Betrag:</b> ${r.total_price?.toLocaleString("cs")} CZK</p>` }),
  nl: (r) => ({ subject: `Nieuwe reservering #${r.id} – Lipno Hideaway`, html: `<h2>Bedankt voor uw reservering!</h2><p><b>Aankomst:</b> ${r.check_in}<br><b>Vertrek:</b> ${r.check_out}<br><b>Gasten:</b> ${r.num_guests}<br><b>Totaal:</b> ${r.total_price?.toLocaleString("cs")} CZK</p><h3>Overschrijving</h3><p><b>Rekening:</b> XXXX/XXXX<br><b>Ref:</b> ${r.id}<br><b>Bedrag:</b> ${r.total_price?.toLocaleString("cs")} CZK</p>` }),
};

async function send(to, subject, html) {
  return fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_API_KEY}` },
    body: JSON.stringify({ from: FROM, to, subject, html }),
  });
}

serve(async (req) => {
  try {
    const { type, reservation } = await req.json();
    if (type === "new_reservation" && reservation) {
      const t = (tpl[reservation.language] || tpl.cs)(reservation);
      await send(reservation.guest_email, t.subject, t.html);
      await send(ADMIN, `[ADMIN] ${t.subject}`, t.html);
      return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } });
    }
    return new Response(JSON.stringify({ error: "Unknown type" }), { status: 400 });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
});
