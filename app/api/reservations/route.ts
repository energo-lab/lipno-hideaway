// app/api/reservations/route.ts  ← HARDENED VERSION
// Bezpečné přijímání rezervací z veřejného webu

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
import {
  checkRateLimit, rateLimitResponse, getClientIp,
  sanitizeBookingInput, scanRequestForAttacks,
  logSecurityEvent, addSecurityHeaders, validateAdminAuth,
} from '../../../lib/security'
import { sendBookingConfirmation, sendAdminNotification, sendBookingConfirmed, sendBookingCancelled } from '../../../lib/email'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

const DEPOSIT_PERCENT = Number(process.env.DEPOSIT_PERCENT ?? 30)

// Season pricing — must stay in sync with SEASONS in src/App.jsx
const SEASONS = [
  { months: [7, 8],         price: 7900 }, // TOP LÉTO
  { months: [2],            price: 7900 }, // TOP ZIMA
  { months: [1],            price: 6900 }, // ZIMA
  { months: [6, 9],         price: 6500 }, // JARO / PODZIM
  { months: [5, 10],        price: 6000 }, // VEDLEJŠÍ
  { months: [4, 11, 12],    price: 5500 }, // MIMO SEZÓNU
]
const FALLBACK_PRICE = Number(process.env.PRICE_PER_NIGHT ?? 5500)

function getSeasonPrice(date: Date): number {
  const month = date.getMonth() + 1 // 1–12
  const season = SEASONS.find(s => s.months.includes(month))
  return season?.price ?? FALLBACK_PRICE
}

function corsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': process.env.NEXT_PUBLIC_URL ?? 'https://www.lipno20.cz',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() })
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req)

  // 1. Rate limit
  const rl = checkRateLimit(ip, 'reservation.post')
  if (!rl.allowed) return addSecurityHeaders(rateLimitResponse(rl.retryAfter!, rl.resetAt))

  // 2. Content-Type check
  const ct = req.headers.get('content-type') ?? ''
  if (!ct.includes('application/json'))
    return addSecurityHeaders(NextResponse.json({ error: 'Neplatný formát' }, { status: 400 }))

  // 3. Max body size (8 KB)
  const cl = req.headers.get('content-length')
  if (cl && parseInt(cl) > 8192) {
    logSecurityEvent('SUSPICIOUS_INPUT', { ip, reason: 'body_too_large' })
    return addSecurityHeaders(NextResponse.json({ error: 'Příliš velký požadavek' }, { status: 413 }))
  }

  // 4. Parse JSON
  let rawBody: Record<string, unknown>
  try { rawBody = await req.json() }
  catch { return addSecurityHeaders(NextResponse.json({ error: 'Neplatný JSON' }, { status: 400 })) }

  // 5. Cloudflare Turnstile ověření
  const ttSecret = process.env.TURNSTILE_SECRET_KEY
  if (ttSecret) {
    const ttToken = String(rawBody.tt ?? '')
    if (!ttToken) {
      logSecurityEvent('TURNSTILE_MISSING', { ip })
      return addSecurityHeaders(NextResponse.json({ error: 'Chybí ověření' }, { status: 403 }))
    }
    try {
      const ttRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `secret=${ttSecret}&response=${ttToken}&remoteip=${ip}`,
      })
      const ttData = await ttRes.json() as { success: boolean }
      if (!ttData.success) {
        logSecurityEvent('TURNSTILE_FAIL', { ip })
        return addSecurityHeaders(NextResponse.json({ error: 'Ověření selhalo, zkuste znovu' }, { status: 403 }))
      }
    } catch (e) {
      logSecurityEvent('TURNSTILE_ERROR', { ip, error: String(e) })
      // Pokud Turnstile API selže, propustit (fail open) — nechceme blokovat legitimní uživatele
    }
  }

  // 5b. Detekce útoků
  if (scanRequestForAttacks(rawBody))
    return addSecurityHeaders(NextResponse.json({ error: 'Neplatný požadavek' }, { status: 400 }))

  // 6. Sanitizace + validace
  const { safe, errors } = sanitizeBookingInput(rawBody)
  if (errors.length > 0)
    return addSecurityHeaders(NextResponse.json({ error: errors[0], errors }, { status: 422 }))

  // 7. Origin / CSRF
  const origin = req.headers.get('origin')
  const allowed = process.env.NEXT_PUBLIC_URL ?? 'https://www.lipno20.cz'
  if (origin && origin !== allowed && !origin.endsWith(".vercel.app") && origin !== "http://localhost:3000") {
    logSecurityEvent('CSRF_INVALID', { ip, origin })
    return addSecurityHeaders(NextResponse.json({ error: 'Zakázaný požadavek' }, { status: 403 }))
  }

  const { guest_name, guest_email, check_in, check_out, adults, children, message, guest_phone } =
    safe as Record<string, unknown>

  try {
    const inDate = new Date(check_in as string)
    const outDate = new Date(check_out as string)
    if (inDate >= outDate)
      return addSecurityHeaders(NextResponse.json({ error: 'Neplatné datum' }, { status: 422 }))

    const nights = Math.ceil((outDate.getTime() - inDate.getTime()) / 86400000)
    if (nights < 1 || nights > 30)
      return addSecurityHeaders(NextResponse.json({ error: 'Délka pobytu 1–30 nocí' }, { status: 422 }))

    // Kontrola dostupnosti
    const { data: conflict } = await supabase
      .from('reservations').select('id')
      .not('status', 'eq', 'cancelled')
      .lt('check_in', check_out as string)
      .gt('check_out', check_in as string)
      .limit(1)

    if (conflict?.length)
      return addSecurityHeaders(NextResponse.json({ error: 'Termín je obsazen' }, { status: 409 }))

    // Cena se počítá výhradně na serveru podle sezóny
    const price_per_night = getSeasonPrice(inDate)
    const total_price = nights * price_per_night
    const deposit_amount = Math.round(total_price * DEPOSIT_PERCENT / 100)

    // Host
    const { data: existingGuest } = await supabase
      .from('guests').select('id').eq('email', guest_email as string).single()
    let guestId = existingGuest?.id
    if (!guestId) {
      const { data: ng } = await supabase
        .from('guests').insert({ name: guest_name, email: guest_email, phone: guest_phone ?? null })
        .select('id').single()
      guestId = ng?.id
    }

    // Rezervace
    const { data: reservation, error: resErr } = await supabase
      .from('reservations').insert({
        guest_id: guestId ?? null, guest_name, guest_email,
        guest_phone: guest_phone ?? null, check_in, check_out,
        adults: Number(adults), children: Number(children ?? 0),
        price_per_night, total_price, deposit_amount,
        status: 'pending', source: 'website', internal_notes: message ?? null,
      }).select().single()

    if (resErr || !reservation)
      return addSecurityHeaders(NextResponse.json({ error: 'Chyba při vytváření rezervace' }, { status: 500 }))

    // Emaily async
    const adultsNum = Number(adults)
    const cleaningFee = 2300
    const cityTax = 50 * adultsNum * nights
    const totalWithFees = total_price + cleaningFee + cityTax
    const adminMsg =
      `${guest_name} | ${check_in} → ${check_out} | ${nights} nocí | ${adultsNum} os.\n` +
      `Ubytování: ${total_price.toLocaleString()} Kč\n` +
      `Závěrečný úklid: ${cleaningFee.toLocaleString()} Kč\n` +
      `City tax: ${cityTax.toLocaleString()} Kč\n` +
      `<strong>CELKEM: ${totalWithFees.toLocaleString()} Kč</strong>`
    const emailResults = await Promise.allSettled([
  sendBookingConfirmation(reservation),
  sendAdminNotification(reservation, `Rezervace - ${guest_name}`, adminMsg.replace(/\n/g, '<br>')),
]);
console.error('[reservations] email results', JSON.stringify(emailResults));

    return addSecurityHeaders(NextResponse.json(
      { success: true, reservationId: reservation.id, totalPrice: total_price, depositAmount: deposit_amount, nights },
      { status: 201, headers: corsHeaders() }
    ))

  } catch (err) {
    console.error('[reservations] error', err)
    return addSecurityHeaders(NextResponse.json({ error: 'Interní chyba' }, { status: 500 }))
  }
}

export async function GET(req: NextRequest) {
  if (!await validateAdminAuth(req))
    return addSecurityHeaders(NextResponse.json({ error: 'Neautorizováno' }, { status: 401 }))

  const { data, error } = await supabase
    .from('reservations')
    .select('*')
    .order('check_in', { ascending: false })
  if (error) return addSecurityHeaders(NextResponse.json({ error: error.message }, { status: 500 }))
  return addSecurityHeaders(NextResponse.json(data))
}

export async function PATCH(req: NextRequest) {
  if (!await validateAdminAuth(req))
    return addSecurityHeaders(NextResponse.json({ error: 'Neautorizováno' }, { status: 401 }))

  let body: { id?: string; status?: string }
  try { body = await req.json() } catch { return addSecurityHeaders(NextResponse.json({ error: 'Neplatný JSON' }, { status: 400 })) }

  const { id, status } = body
  if (!id || !['confirmed', 'cancelled'].includes(status ?? ''))
    return addSecurityHeaders(NextResponse.json({ error: 'Neplatné parametry' }, { status: 400 }))

  const { data: reservation, error } = await supabase
    .from('reservations')
    .update({ status })
    .eq('id', id)
    .select()
    .single()

  if (error || !reservation)
    return addSecurityHeaders(NextResponse.json({ error: error?.message ?? 'Chyba' }, { status: 500 }))

  // Notifikační email hostovi
  if (status === 'confirmed') {
    await sendBookingConfirmed(reservation).catch(e => console.error('[email confirmed]', e))
  } else if (status === 'cancelled') {
    await sendBookingCancelled(reservation).catch(e => console.error('[email cancelled]', e))
  }

  return addSecurityHeaders(NextResponse.json({ success: true, reservation }))
}

export async function PUT() { return new NextResponse(null, { status: 405 }) }

export async function DELETE(req: NextRequest) {
  if (!await validateAdminAuth(req))
    return addSecurityHeaders(NextResponse.json({ error: 'Neautorizováno' }, { status: 401 }))

  const id = new URL(req.url).searchParams.get('id')
  if (!id) return addSecurityHeaders(NextResponse.json({ error: 'Missing id' }, { status: 400 }))
  const { error } = await supabase.from('reservations').delete().eq('id', id)
  if (error) return addSecurityHeaders(NextResponse.json({ error: error.message }, { status: 500 }))
  return addSecurityHeaders(NextResponse.json({ success: true }))
}