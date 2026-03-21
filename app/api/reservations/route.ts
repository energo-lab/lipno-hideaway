// app/api/reservations/route.ts  ← HARDENED VERSION
// Bezpečné přijímání rezervací z veřejného webu

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  checkRateLimit, rateLimitResponse, getClientIp,
  sanitizeBookingInput, scanRequestForAttacks,
  logSecurityEvent, addSecurityHeaders,
} from '../../../lib/security'
import { sendBookingConfirmation, sendAdminNotification } from '../../../lib/email'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

const PRICE_PER_NIGHT = Number(process.env.PRICE_PER_NIGHT ?? 4500)
const DEPOSIT_PERCENT = Number(process.env.DEPOSIT_PERCENT ?? 30)

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

  // 5. Detekce útoků
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

    // Cena se počítá výhradně na serveru
    const total_price = nights * PRICE_PER_NIGHT
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
        price_per_night: PRICE_PER_NIGHT, total_price, deposit_amount,
        status: 'pending', source: 'website', internal_notes: message ?? null,
      }).select().single()

    if (resErr || !reservation)
      return addSecurityHeaders(NextResponse.json({ error: 'Chyba při vytváření rezervace' }, { status: 500 }))

    // Emaily async
    const emailResults = await Promise.allSettled([
      sendBookingConfirmation(reservation),
sendAdminNotification(reservation, `Rezervace - ${guest_name}`,
  `${guest_name} | ${check_in} - ${check_out} | ${total_price.toLocaleString()} Kč`),
]));
console.error('[reservations] email results', JSON.stringify(emailResults))

    return addSecurityHeaders(NextResponse.json(
      { success: true, reservationId: reservation.id, totalPrice: total_price, depositAmount: deposit_amount, nights },
      { status: 201, headers: corsHeaders() }
    ))

  } catch (err) {
    console.error('[reservations] error', err)
    return addSecurityHeaders(NextResponse.json({ error: 'Interní chyba' }, { status: 500 }))
  }
}

export async function GET()    { return new NextResponse(null, { status: 405 }) }
export async function PUT()    { return new NextResponse(null, { status: 405 }) }
export async function DELETE() { return new NextResponse(null, { status: 405 }) }
