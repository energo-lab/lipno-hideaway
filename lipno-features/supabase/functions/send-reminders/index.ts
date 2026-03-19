// supabase/functions/send-reminders/index.ts
// Scheduled daily via Supabase Cron: sends arrival reminders 2 days before check-in
// Setup: Supabase Dashboard > Edge Functions > Deploy
// Cron: every day at 9:00: "0 9 * * *"

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { Resend } from 'https://esm.sh/resend@3'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

const resend = new Resend(Deno.env.get('RESEND_API_KEY'))
const FROM = 'Lipno Hideaway <rezervace@lipno20.cz>'

Deno.serve(async () => {
  // Find reservations with check-in in 2 days
  const targetDate = new Date()
  targetDate.setDate(targetDate.getDate() + 2)
  const dateStr = targetDate.toISOString().split('T')[0]

  const { data: reservations, error } = await supabase
    .from('reservations')
    .select('*')
    .eq('check_in', dateStr)
    .in('status', ['confirmed', 'paid'])

  if (error) {
    return new Response(JSON.stringify({ error }), { status: 500 })
  }

  const results = []

  for (const r of reservations ?? []) {
    // Check if reminder already sent
    const { data: existing } = await supabase
      .from('email_logs')
      .select('id')
      .eq('reservation_id', r.id)
      .eq('template', 'arrival_reminder')
      .limit(1)

    if (existing && existing.length > 0) {
      results.push({ id: r.id, skipped: true })
      continue
    }

    // Send reminder
    const checkIn = new Date(r.check_in).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'long' })

    try {
      await resend.emails.send({
        from: FROM,
        to: r.guest_email,
        subject: `🏡 Za 2 dny Vás čekáme! | Lipno Hideaway`,
        html: buildReminderHtml(r),
      })

      await supabase.from('email_logs').insert({
        reservation_id: r.id,
        email_to: r.guest_email,
        template: 'arrival_reminder',
        status: 'sent',
      })

      results.push({ id: r.id, email: r.guest_email, sent: true })
    } catch (err) {
      results.push({ id: r.id, error: String(err) })
    }
  }

  return new Response(JSON.stringify({ date: dateStr, results }), {
    headers: { 'Content-Type': 'application/json' },
  })
})

function buildReminderHtml(r: { guest_name: string; check_in: string; check_out: string; total_price: number; deposit_amount: number }) {
  const checkIn = new Date(r.check_in).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'long', year: 'numeric' })
  const checkOut = new Date(r.check_out).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'long', year: 'numeric' })
  const name = r.guest_name.split(' ')[0]
  const remaining = r.total_price - r.deposit_amount

  return `
<html><body style="font-family:Georgia,serif;background:#f5f0eb;padding:20px">
<div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden">
  <div style="background:#1a2e1a;padding:32px;text-align:center">
    <h1 style="color:#d4af6a;margin:0">🏡 Těšíme se na Vás!</h1>
  </div>
  <div style="padding:32px">
    <p>Dobrý den, ${name}!</p>
    <p>Za <strong>2 dny</strong> přijíždíte do Lipno Hideaway. Připomínáme Vám důležité informace:</p>
    <table style="width:100%;border-collapse:collapse;margin:20px 0">
      <tr><td style="padding:8px 0;border-bottom:1px solid #f0e8d8;font-weight:600;width:40%">Příjezd</td><td style="padding:8px 0;border-bottom:1px solid #f0e8d8">${checkIn}</td></tr>
      <tr><td style="padding:8px 0;border-bottom:1px solid #f0e8d8;font-weight:600">Odjezd</td><td style="padding:8px 0;border-bottom:1px solid #f0e8d8">${checkOut}</td></tr>
      <tr><td style="padding:8px 0;border-bottom:1px solid #f0e8d8;font-weight:600">Check-in</td><td style="padding:8px 0;border-bottom:1px solid #f0e8d8">15:00 – 20:00</td></tr>
      <tr><td style="padding:8px 0;font-weight:600">Check-out</td><td style="padding:8px 0">do 10:00</td></tr>
    </table>
    ${remaining > 0 ? `<p style="background:#fff8e8;border-left:4px solid #d4af6a;padding:12px;border-radius:0 8px 8px 0">💳 <strong>Doplatek při příjezdu:</strong> ${remaining.toLocaleString('cs-CZ')} Kč</p>` : '<p style="background:#e8f5e9;border-left:4px solid #4caf50;padding:12px;border-radius:0 8px 8px 0">✅ Vše je zaplaceno. Těšíme se!</p>'}
    <p>Kód ke klíčům Vám zašleme zítra ráno.</p>
    <p>Dotazy: <a href="mailto:rezervace@lipno20.cz">rezervace@lipno20.cz</a></p>
  </div>
  <div style="background:#f9f5f0;padding:20px;text-align:center;font-size:13px;color:#888">
    Lipno Hideaway · <a href="https://www.lipno20.cz">lipno20.cz</a>
  </div>
</div>
</body></html>`
}
