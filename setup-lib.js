const fs = require('fs');

// ── lib/comgate.ts ──────────────────────────────────────────────────────────
fs.writeFileSync('lib/comgate.ts', `
export async function comgateCreatePayment(params: {
  reservationId: string
  amount: number
  label: string
  email: string
  refId: string
  notifUrl: string
  returnUrl: string
}) {
  const body = new URLSearchParams({
    merchant: process.env.COMGATE_MERCHANT_ID!,
    secret: process.env.COMGATE_SECRET!,
    price: String(params.amount),
    curr: 'CZK',
    label: params.label,
    refId: params.refId,
    email: params.email,
    returnUrl: params.returnUrl,
    notifUrl: params.notifUrl,
    method: 'ALL',
    prepareOnly: 'true',
  })
  const res = await fetch('https://payments.comgate.cz/v1.0/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  const text = await res.text()
  return Object.fromEntries(new URLSearchParams(text))
}
`.trimStart());

// ── lib/security.ts ─────────────────────────────────────────────────────────
fs.writeFileSync('lib/security.ts', `
import { NextResponse } from 'next/server'

const seen = new Set<string>()
const rlMap = new Map<string, { count: number; resetAt: Date }>()

export function getClientIp(req: { headers: { get: (k: string) => string | null } }): string {
  const f = req.headers.get('x-forwarded-for')
  return f ? f.split(',')[0].trim() : 'unknown'
}

export function validateComgateSecret(secret: string): boolean {
  return secret === process.env.COMGATE_SECRET
}

export function validateComgateIp(ip: string): boolean {
  return ['18.184.153.186','18.185.91.208','52.28.68.109','127.0.0.1','::1'].includes(ip)
}

export function isWebhookDuplicate(key: string): boolean {
  if (seen.has(key)) return true
  seen.add(key)
  setTimeout(() => seen.delete(key), 86400000)
  return false
}

export function checkRateLimit(ip: string, action: string): { allowed: boolean; retryAfter?: number; resetAt?: Date } {
  const key = ip + ':' + action
  const now = new Date()
  const entry = rlMap.get(key)
  if (!entry || entry.resetAt < now) {
    rlMap.set(key, { count: 1, resetAt: new Date(now.getTime() + 60000) })
    return { allowed: true }
  }
  if (entry.count >= 20) {
    return { allowed: false, retryAfter: Math.ceil((entry.resetAt.getTime() - now.getTime()) / 1000), resetAt: entry.resetAt }
  }
  entry.count++
  return { allowed: true }
}

export function rateLimitResponse(retryAfter: number, resetAt?: Date): NextResponse {
  return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: { 'Retry-After': String(retryAfter) } })
}

export function logSecurityEvent(event: string, data: Record<string, unknown>): void {
  console.warn('[SECURITY]', event, JSON.stringify(data))
}

export function addSecurityHeaders(res: NextResponse | Response): NextResponse {
  const r = res instanceof NextResponse ? res : new NextResponse((res as Response).body, res)
  r.headers.set('X-Content-Type-Options', 'nosniff')
  r.headers.set('X-Frame-Options', 'DENY')
  return r
}

export function sanitizeBookingInput(body: Record<string, unknown>): { safe: Record<string, unknown>; errors: string[] } {
  const errors: string[] = []
  const safe: Record<string, unknown> = {}
  for (const f of ['guest_name','guest_email','check_in','check_out','adults']) {
    if (!body[f]) errors.push('Chybi pole: ' + f)
    else safe[f] = String(body[f]).slice(0, 500)
  }
  for (const f of ['children','message','guest_phone']) {
    if (body[f] !== undefined) safe[f] = String(body[f]).slice(0, 500)
  }
  if (safe.guest_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(safe.guest_email as string))
    errors.push('Neplatny email')
  return { safe, errors }
}

export function scanRequestForAttacks(body: Record<string, unknown>): boolean {
  const s = JSON.stringify(body).toLowerCase()
  return ['<script','javascript:','onload=','drop table','../','etc/passwd'].some(p => s.includes(p))
}
`.trimStart());

// ── lib/email.ts ─────────────────────────────────────────────────────────────
fs.writeFileSync('lib/email.ts', `
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM = 'Lipno Hideaway <rezervace@lipno20.cz>'

export async function sendBookingConfirmation(reservation: Record<string, unknown>) {
  return resend.emails.send({
    from: FROM,
    to: reservation.guest_email as string,
    subject: 'Potvrzeni rezervace - Lipno Hideaway',
    html: '<h2>Dekujeme, ' + reservation.guest_name + '!</h2>' +
      '<p>Check-in: ' + reservation.check_in + '</p>' +
      '<p>Check-out: ' + reservation.check_out + '</p>' +
      '<p>Cena: ' + reservation.total_price + ' Kc</p>',
  })
}

export async function sendPaymentConfirmation(reservation: Record<string, unknown>, amount: number) {
  return resend.emails.send({
    from: FROM,
    to: reservation.guest_email as string,
    subject: 'Platba prijata - Lipno Hideaway',
    html: '<h2>Platba potvrzena!</h2><p>Prijata ' + amount + ' Kc.</p>',
  })
}

export async function sendAdminNotification(reservation: Record<string, unknown>, subject: string, message: string) {
  return resend.emails.send({
    from: FROM,
    to: process.env.ADMIN_EMAIL ?? 'info@lipno20.cz',
    subject,
    html: '<p>' + message + '</p>',
  })
}
`.trimStart());

console.log('✅ Vsechny lib soubory vytvoreny!');
