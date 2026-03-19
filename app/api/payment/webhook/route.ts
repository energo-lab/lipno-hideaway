// app/api/payment/webhook/route.ts  ← HARDENED VERSION
// Maximálně zabezpečený Comgate webhook handler

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  validateComgateSecret,
  validateComgateIp,
  isWebhookDuplicate,
  checkRateLimit,
  rateLimitResponse,
  getClientIp,
  logSecurityEvent,
  addSecurityHeaders,
} from '@/lib/security'
import { sendPaymentConfirmation, sendAdminNotification } from '@/lib/email'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

export async function POST(req: NextRequest) {
  const ip = getClientIp(req)
  const startTime = Date.now()

  // 1. Rate limit
  const rl = checkRateLimit(ip, 'payment.webhook')
  if (!rl.allowed) return addSecurityHeaders(rateLimitResponse(rl.retryAfter!, rl.resetAt))

  // 2. Content-Type
  const ct = req.headers.get('content-type') ?? ''
  if (!ct.includes('application/x-www-form-urlencoded')) {
    logSecurityEvent('SUSPICIOUS_INPUT', { ip, reason: 'wrong_content_type', ct })
    return addSecurityHeaders(new NextResponse('Bad Request', { status: 400 }))
  }

  // 3. IP whitelist
  if (!validateComgateIp(ip)) {
    if (process.env.NODE_ENV === 'production' && process.env.COMGATE_TEST !== 'true') {
      return addSecurityHeaders(new NextResponse('Forbidden', { status: 403 }))
    }
  }

  // 4. Parse body
  let formData: FormData
  try { formData = await req.formData() }
  catch {
    logSecurityEvent('SUSPICIOUS_INPUT', { ip, reason: 'malformed_form_data' })
    return addSecurityHeaders(new NextResponse('Bad Request', { status: 400 }))
  }

  const data: Record<string, string> = {}
  formData.forEach((v, k) => { data[k] = String(v).slice(0, 500) })
  const { merchant, transId, secret: receivedSecret, status, refId, price } = data

  // 5. Povinné parametry
  if (!transId || !receivedSecret || !status || !refId || !merchant) {
    logSecurityEvent('WEBHOOK_INVALID_SECRET', { ip, reason: 'missing_params' })
    return addSecurityHeaders(new NextResponse('Bad Request', { status: 400 }))
  }

  // 6. Merchant ID
  if (merchant !== process.env.COMGATE_MERCHANT_ID) {
    logSecurityEvent('WEBHOOK_INVALID_SECRET', { ip, reason: 'wrong_merchant' })
    return addSecurityHeaders(new NextResponse('Forbidden', { status: 403 }))
  }

  // 7. Timing-safe ověření secretu
  if (!validateComgateSecret(receivedSecret)) {
    logSecurityEvent('WEBHOOK_INVALID_SECRET', { ip, transId })
    // Vrátíme 200 – Comgate nesmí vědět, že secret je špatný (oracle attack)
    return addSecurityHeaders(new NextResponse('OK', { status: 200 }))
  }

  // 8. Idempotency / replay protection
  if (isWebhookDuplicate(`${transId}:${status}`)) {
    logSecurityEvent('PAYMENT_REPLAY_ATTACK', { ip, transId, status })
    return addSecurityHeaders(new NextResponse('OK', { status: 200 }))
  }

  // 9. Validace status hodnoty
  const VALID_STATUSES = ['PENDING','PAID','CANCELLED','AUTHORIZED','ERROR']
  const comgateStatus = status.toUpperCase()
  if (!VALID_STATUSES.includes(comgateStatus)) {
    logSecurityEvent('SUSPICIOUS_INPUT', { ip, transId, status })
    return addSecurityHeaders(new NextResponse('Bad Request', { status: 400 }))
  }

  // 10. UUID format check (path injection protection)
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!UUID_RE.test(refId)) {
    logSecurityEvent('SUSPICIOUS_INPUT', { ip, transId, refId, reason: 'invalid_uuid' })
    return addSecurityHeaders(new NextResponse('Bad Request', { status: 400 }))
  }

  try {
    const { data: payment } = await supabase
      .from('payments').select('*, reservations(*)').eq('id', refId).single()

    if (!payment) {
      console.warn('[webhook] Payment not found', { refId, transId })
      return addSecurityHeaders(new NextResponse('OK', { status: 200 }))
    }

    // 11. Ověř správnost částky
    if (price) {
      const received = parseFloat(price) / 100
      if (Math.abs(received - payment.amount) > 1) {
        logSecurityEvent('PAYMENT_AMOUNT_MISMATCH', { ip, transId, received, expected: payment.amount })
        await supabase.from('payments').update({
          status: 'error', raw_response: { ...data, security_flag: 'amount_mismatch' }
        }).eq('id', refId)
        return addSecurityHeaders(new NextResponse('OK', { status: 200 }))
      }
    }

    // 12. Aktualizuj – POUZE pending (optimistic lock)
    const mappedStatus = mapStatus(comgateStatus)
    await supabase.from('payments').update({
      status: mappedStatus,
      comgate_trans_id: transId,
      paid_at: mappedStatus === 'paid' ? new Date().toISOString() : null,
      raw_response: data,
    }).eq('id', refId).eq('status', 'pending')

    // 13. Po úspěšné platbě
    if (mappedStatus === 'paid') {
      const reservation = payment.reservations
      const amount = price ? parseFloat(price) / 100 : payment.amount
      const { data: allPaid } = await supabase.from('payments').select('amount')
        .eq('reservation_id', reservation.id).eq('status', 'paid')
      const totalPaid = ((allPaid ?? []) as {amount:number}[]).reduce((s,p) => s+p.amount, 0) + amount

      await supabase.from('reservations').update({
        status: totalPaid >= reservation.total_price ? 'paid' : 'confirmed',
        payment_method: 'card',
      }).eq('id', reservation.id)

      Promise.allSettled([
        sendPaymentConfirmation(reservation, amount),
        sendAdminNotification(reservation, `💳 Platba – ${reservation.guest_name}`,
          `Přijata ${amount.toLocaleString()} Kč. TransID: ${transId}`),
      ]).catch(err => console.error('[webhook] Email error', err))
    }

    console.log(`[webhook] ${transId} (${comgateStatus}) OK in ${Date.now()-startTime}ms`)
    return addSecurityHeaders(new NextResponse('OK', { status: 200 }))

  } catch (err) {
    console.error('[webhook] Unexpected error', err)
    return addSecurityHeaders(new NextResponse('OK', { status: 200 }))
  }
}

export async function GET()    { return new NextResponse(null, { status: 405 }) }
export async function PUT()    { return new NextResponse(null, { status: 405 }) }
export async function DELETE() { return new NextResponse(null, { status: 405 }) }

function mapStatus(s: string): string {
  return { PAID:'paid', CANCELLED:'cancelled', AUTHORIZED:'authorized', PENDING:'pending', ERROR:'error' }[s] ?? 'error'
}
