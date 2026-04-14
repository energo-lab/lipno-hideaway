import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'

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

export async function validateAdminAuth(req: NextRequest): Promise<boolean> {
  const auth = req.headers.get('authorization')
  if (!auth || !auth.startsWith('Bearer ')) return false
  const token = auth.slice(7)
  try {
    const supabaseAuth = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    const { data: { user }, error } = await supabaseAuth.auth.getUser(token)
    return !!user && !error
  } catch {
    return false
  }
}
