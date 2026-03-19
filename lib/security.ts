// lib/security.ts
// Centrální bezpečnostní vrstva pro Lipno Hideaway
// Pokrývá: rate limiting, CSRF, validaci vstupů, logování, IP ochranu

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createHmac, timingSafeEqual, randomBytes, createHash } from 'crypto'

// ─────────────────────────────────────────────────────────
// 1. RATE LIMITING (in-memory + Supabase fallback)
// ─────────────────────────────────────────────────────────

interface RateLimitEntry {
  count: number
  resetAt: number
  blocked?: boolean
  blockedUntil?: number
}

const rateLimitStore = new Map<string, RateLimitEntry>()

interface RateLimitConfig {
  windowMs: number   // okno v ms
  max: number        // max pokusů v okně
  blockMs?: number   // jak dlouho blokovat po překročení (default: windowMs)
}

const RATE_LIMITS: Record<string, RateLimitConfig> = {
  // Platby – nejpřísnější
  'payment.create':   { windowMs: 60_000,  max: 3,  blockMs: 300_000  },  // 3/min, blok 5 min
  'payment.webhook':  { windowMs: 10_000,  max: 30, blockMs: 60_000   },  // 30/10s (Comgate batch)
  // Rezervace
  'reservation.post': { windowMs: 60_000,  max: 5,  blockMs: 600_000  },  // 5/min, blok 10 min
  // Chat
  'chat.post':        { windowMs: 60_000,  max: 20, blockMs: 120_000  },  // 20/min
  // Admin
  'admin.login':      { windowMs: 300_000, max: 5,  blockMs: 1800_000 },  // 5/5min, blok 30 min
}

export function checkRateLimit(key: string, configKey: keyof typeof RATE_LIMITS): {
  allowed: boolean
  remaining: number
  resetAt: number
  retryAfter?: number
} {
  const config = RATE_LIMITS[configKey]
  if (!config) return { allowed: true, remaining: 999, resetAt: 0 }

  const now = Date.now()
  const storeKey = `${configKey}:${key}`
  let entry = rateLimitStore.get(storeKey)

  // Zkontroluj block
  if (entry?.blocked && entry.blockedUntil && entry.blockedUntil > now) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: entry.blockedUntil,
      retryAfter: Math.ceil((entry.blockedUntil - now) / 1000),
    }
  }

  // Reset po expiraci okna
  if (!entry || entry.resetAt < now) {
    entry = { count: 0, resetAt: now + config.windowMs }
  }

  entry.count++
  rateLimitStore.set(storeKey, entry)

  if (entry.count > config.max) {
    const blockedUntil = now + (config.blockMs ?? config.windowMs)
    entry.blocked = true
    entry.blockedUntil = blockedUntil
    rateLimitStore.set(storeKey, entry)

    // Loguj útok
    logSecurityEvent('RATE_LIMIT_EXCEEDED', { key, configKey, count: entry.count })

    return {
      allowed: false,
      remaining: 0,
      resetAt: blockedUntil,
      retryAfter: Math.ceil((config.blockMs ?? config.windowMs) / 1000),
    }
  }

  return {
    allowed: true,
    remaining: config.max - entry.count,
    resetAt: entry.resetAt,
  }
}

export function rateLimitResponse(retryAfter: number, resetAt: number): NextResponse {
  return NextResponse.json(
    { error: 'Příliš mnoho požadavků. Zkuste to prosím později.' },
    {
      status: 429,
      headers: {
        'Retry-After': String(retryAfter),
        'X-RateLimit-Reset': String(Math.ceil(resetAt / 1000)),
        'X-RateLimit-Remaining': '0',
      },
    }
  )
}

// ─────────────────────────────────────────────────────────
// 2. IP EXTRACTION (Vercel / Cloudflare aware)
// ─────────────────────────────────────────────────────────

export function getClientIp(req: NextRequest): string {
  // Pořadí důvěryhodnosti: Vercel → Cloudflare → X-Forwarded-For → socket
  return (
    req.headers.get('x-vercel-forwarded-for')?.split(',')[0].trim() ??
    req.headers.get('cf-connecting-ip') ??
    req.headers.get('x-real-ip') ??
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    '0.0.0.0'
  )
}

// ─────────────────────────────────────────────────────────
// 3. CSRF PROTECTION
// ─────────────────────────────────────────────────────────

const CSRF_SECRET = process.env.CSRF_SECRET ?? 'change-me-in-production-min-32-chars'

export function generateCsrfToken(sessionId: string): string {
  const nonce = randomBytes(16).toString('hex')
  const timestamp = Date.now().toString(36)
  const payload = `${sessionId}:${nonce}:${timestamp}`
  const sig = createHmac('sha256', CSRF_SECRET).update(payload).digest('hex')
  return Buffer.from(`${payload}:${sig}`).toString('base64url')
}

export function validateCsrfToken(token: string, sessionId: string): boolean {
  try {
    const decoded = Buffer.from(token, 'base64url').toString()
    const parts = decoded.split(':')
    if (parts.length !== 4) return false
    const [storedSession, nonce, timestamp, sig] = parts

    // Zkontroluj session
    if (storedSession !== sessionId) return false

    // Zkontroluj stáří tokenu (max 2 hodiny)
    const ts = parseInt(timestamp, 36)
    if (Date.now() - ts > 7_200_000) return false

    // Ověř podpis timing-safe
    const payload = `${storedSession}:${nonce}:${timestamp}`
    const expectedSig = createHmac('sha256', CSRF_SECRET).update(payload).digest('hex')
    const sigBuf = Buffer.from(sig)
    const expBuf = Buffer.from(expectedSig)
    return sigBuf.length === expBuf.length && timingSafeEqual(sigBuf, expBuf)
  } catch {
    return false
  }
}

// ─────────────────────────────────────────────────────────
// 4. COMGATE WEBHOOK SIGNATURE VALIDATION
// ─────────────────────────────────────────────────────────

/**
 * Timing-safe porovnání Comgate secretu
 * Chrání před timing attacks
 */
export function validateComgateSecret(receivedSecret: string): boolean {
  const expected = process.env.COMGATE_SECRET
  if (!expected || !receivedSecret) return false
  try {
    const a = Buffer.from(receivedSecret)
    const b = Buffer.from(expected)
    if (a.length !== b.length) {
      // Timing-safe i při různé délce (vždy porovnáme hashe)
      const ha = createHash('sha256').update(a).digest()
      const hb = createHash('sha256').update(b).digest()
      return timingSafeEqual(ha, hb)
    }
    return timingSafeEqual(a, b)
  } catch {
    return false
  }
}

/**
 * Ověří, že webhook přišel z Comgate IP rozsahů
 * Comgate dokumentace: https://apidoc.comgate.cz/
 */
const COMGATE_IP_RANGES = [
  '89.24.247.',    // Comgate primary
  '89.24.246.',
  '194.182.80.',
  '127.0.0.1',     // lokální dev
  '::1',
]

export function validateComgateIp(ip: string): boolean {
  // V produkci vždy loguj, i když povolíme
  const allowed = COMGATE_IP_RANGES.some(range => ip.startsWith(range))
  if (!allowed) {
    logSecurityEvent('WEBHOOK_INVALID_IP', { ip, service: 'comgate' })
  }
  return allowed
}

// ─────────────────────────────────────────────────────────
// 5. IDEMPOTENCY (zabrání duplicitním platbám)
// ─────────────────────────────────────────────────────────

const processedWebhooks = new Map<string, number>()

export function isWebhookDuplicate(transId: string, windowMs = 300_000): boolean {
  const now = Date.now()
  const processed = processedWebhooks.get(transId)

  // Čisti staré záznamy
  for (const [k, ts] of processedWebhooks) {
    if (now - ts > windowMs) processedWebhooks.delete(k)
  }

  if (processed && now - processed < windowMs) return true

  processedWebhooks.set(transId, now)
  return false
}

// ─────────────────────────────────────────────────────────
// 6. INPUT SANITIZATION & VALIDATION
// ─────────────────────────────────────────────────────────

/** Odstraní nebezpečné HTML znaky */
export function sanitizeString(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
    .trim()
    .slice(0, 1000) // max délka
}

/** Validace a normalizace e-mailu */
export function validateEmail(email: string): { valid: boolean; normalized: string } {
  const normalized = email.toLowerCase().trim()
  const re = /^[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}$/
  return { valid: re.test(normalized) && normalized.length <= 254, normalized }
}

/** Validace datumu (ISO string, nesmí být v minulosti) */
export function validateFutureDate(dateStr: string): boolean {
  const date = new Date(dateStr)
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  return !isNaN(date.getTime()) && date >= now
}

/** Sanitizace celého booking objektu */
export function sanitizeBookingInput(data: Record<string, unknown>): {
  safe: Record<string, unknown>
  errors: string[]
} {
  const errors: string[] = []
  const safe: Record<string, unknown> = {}

  // guest_name
  if (typeof data.guest_name !== 'string' || data.guest_name.trim().length < 2) {
    errors.push('Jméno musí mít alespoň 2 znaky')
  } else {
    safe.guest_name = sanitizeString(data.guest_name).slice(0, 100)
  }

  // guest_email
  const emailResult = validateEmail(String(data.guest_email ?? ''))
  if (!emailResult.valid) {
    errors.push('Neplatný e-mail')
  } else {
    safe.guest_email = emailResult.normalized
  }

  // guest_phone (optional)
  if (data.guest_phone) {
    const phone = String(data.guest_phone).replace(/[^\d\s\+\-\(\)]/g, '').slice(0, 20)
    safe.guest_phone = phone
  }

  // check_in / check_out
  if (!validateFutureDate(String(data.check_in ?? ''))) {
    errors.push('Datum příjezdu musí být v budoucnosti')
  } else {
    safe.check_in = String(data.check_in).slice(0, 10)
  }

  const checkOut = String(data.check_out ?? '')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(checkOut)) {
    errors.push('Neplatné datum odjezdu')
  } else {
    safe.check_out = checkOut.slice(0, 10)
  }

  // adults
  const adults = parseInt(String(data.adults), 10)
  if (isNaN(adults) || adults < 1 || adults > 10) {
    errors.push('Počet dospělých: 1–10')
  } else {
    safe.adults = adults
  }

  // children
  const children = parseInt(String(data.children ?? '0'), 10)
  safe.children = isNaN(children) ? 0 : Math.min(Math.max(children, 0), 10)

  // message (optional)
  if (data.message) {
    safe.message = sanitizeString(String(data.message)).slice(0, 500)
  }

  return { safe, errors }
}

// ─────────────────────────────────────────────────────────
// 7. SECURITY EVENT LOGGING
// ─────────────────────────────────────────────────────────

type SecurityEventType =
  | 'RATE_LIMIT_EXCEEDED'
  | 'WEBHOOK_INVALID_SECRET'
  | 'WEBHOOK_INVALID_IP'
  | 'WEBHOOK_DUPLICATE'
  | 'CSRF_INVALID'
  | 'VALIDATION_FAILED'
  | 'SQL_INJECTION_ATTEMPT'
  | 'SUSPICIOUS_INPUT'
  | 'AUTH_FAILED'
  | 'PAYMENT_AMOUNT_MISMATCH'
  | 'PAYMENT_REPLAY_ATTACK'

interface SecurityEvent {
  type: SecurityEventType
  timestamp: string
  data: Record<string, unknown>
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
}

const SEVERITY_MAP: Record<SecurityEventType, SecurityEvent['severity']> = {
  RATE_LIMIT_EXCEEDED:    'MEDIUM',
  WEBHOOK_INVALID_SECRET: 'CRITICAL',
  WEBHOOK_INVALID_IP:     'HIGH',
  WEBHOOK_DUPLICATE:      'HIGH',
  CSRF_INVALID:           'HIGH',
  VALIDATION_FAILED:      'LOW',
  SQL_INJECTION_ATTEMPT:  'CRITICAL',
  SUSPICIOUS_INPUT:       'MEDIUM',
  AUTH_FAILED:            'HIGH',
  PAYMENT_AMOUNT_MISMATCH:'CRITICAL',
  PAYMENT_REPLAY_ATTACK:  'CRITICAL',
}

export function logSecurityEvent(type: SecurityEventType, data: Record<string, unknown> = {}): void {
  const event: SecurityEvent = {
    type,
    timestamp: new Date().toISOString(),
    data,
    severity: SEVERITY_MAP[type],
  }

  // Vždy loguj do konzole (Vercel logs)
  const prefix = event.severity === 'CRITICAL' ? '🚨' : event.severity === 'HIGH' ? '⚠️' : 'ℹ️'
  console.error(`${prefix} [SECURITY] ${type}`, JSON.stringify(event))

  // Pro CRITICAL – async notify admina (neblokuj request)
  if (event.severity === 'CRITICAL' || event.severity === 'HIGH') {
    notifyAdminAsync(event).catch(() => {/* never throw */})
  }
}

async function notifyAdminAsync(event: SecurityEvent): Promise<void> {
  const adminEmail = process.env.ADMIN_EMAIL
  const resendKey = process.env.RESEND_API_KEY
  if (!adminEmail || !resendKey) return

  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: `Lipno Security <security@lipno20.cz>`,
        to: adminEmail,
        subject: `🚨 [${event.severity}] Bezpečnostní událost: ${event.type}`,
        html: `<pre>${JSON.stringify(event, null, 2)}</pre>`,
      }),
    })
  } catch { /* ignore */ }
}

// ─────────────────────────────────────────────────────────
// 8. SQL INJECTION DETECTION
// ─────────────────────────────────────────────────────────

const SQL_PATTERNS = [
  /(\bOR\b|\bAND\b)\s+\d+\s*=\s*\d+/i,
  /union\s+select/i,
  /drop\s+table/i,
  /insert\s+into/i,
  /delete\s+from/i,
  /exec\s*\(/i,
  /<script[\s>]/i,
  /javascript:/i,
  /on\w+\s*=/i,  // onclick=, onload= etc.
]

export function detectSqlInjection(input: string): boolean {
  return SQL_PATTERNS.some(p => p.test(input))
}

export function scanRequestForAttacks(data: Record<string, unknown>): boolean {
  const values = JSON.stringify(data)
  if (detectSqlInjection(values)) {
    logSecurityEvent('SQL_INJECTION_ATTEMPT', { snippet: values.slice(0, 200) })
    return true
  }
  return false
}

// ─────────────────────────────────────────────────────────
// 9. SECURITY RESPONSE HEADERS
// ─────────────────────────────────────────────────────────

export function addSecurityHeaders(response: NextResponse): NextResponse {
  const h = response.headers
  // Brání načtení ve frame (clickjacking)
  h.set('X-Frame-Options', 'DENY')
  // Brání sniffování MIME typu
  h.set('X-Content-Type-Options', 'nosniff')
  // Referrer policy
  h.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  // Permissions policy – zakáže kamerku, mikrofon, geolokaci
  h.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  // HSTS (min 1 rok, includeSubDomains)
  h.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload')
  // Skryje informace o serveru
  h.set('X-Powered-By', '')
  // Cross-origin resource policy
  h.set('Cross-Origin-Resource-Policy', 'same-origin')
  h.set('Cross-Origin-Opener-Policy', 'same-origin')
  return response
}
