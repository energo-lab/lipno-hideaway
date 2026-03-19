// middleware.ts  (umístěte do ROOTU projektu)
// Spouští se před každým requestem – bezpečnostní brána

import { NextRequest, NextResponse } from 'next/server'
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'

// ─── Content Security Policy ────────────────────────────
// Striktní CSP – povoluje pouze naše zdroje
const CSP = [
  "default-src 'self'",
  // Skripty pouze self + Vercel Analytics (pokud používáte)
  "script-src 'self' 'nonce-REPLACE_NONCE' https://vercel.live",
  // Styly self + inline (potřebné pro Next.js)
  "style-src 'self' 'unsafe-inline'",
  // Obrázky self + data URIs
  "img-src 'self' data: blob: https:",
  // Fonty pouze self
  "font-src 'self'",
  // Připojení: self + Supabase + Comgate + Resend + Anthropic
  "connect-src 'self' https://*.supabase.co https://payments.comgate.cz https://api.resend.com https://api.anthropic.com",
  // Žádné framy
  "frame-src 'none'",
  "frame-ancestors 'none'",
  // Žádné pluginy
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  // Vynutí HTTPS
  "upgrade-insecure-requests",
].join('; ')

// ─── Security Headers ───────────────────────────────────
function buildSecurityHeaders(nonce: string): Record<string, string> {
  const csp = CSP.replace('REPLACE_NONCE', nonce)
  return {
    'Content-Security-Policy':           csp,
    'X-Frame-Options':                   'DENY',
    'X-Content-Type-Options':            'nosniff',
    'X-DNS-Prefetch-Control':            'off',
    'X-Download-Options':                'noopen',
    'X-Permitted-Cross-Domain-Policies': 'none',
    'Referrer-Policy':                   'strict-origin-when-cross-origin',
    'Strict-Transport-Security':         'max-age=31536000; includeSubDomains; preload',
    'Permissions-Policy':                'camera=(), microphone=(), geolocation=(), payment=(self)',
    'Cross-Origin-Embedder-Policy':      'require-corp',
    'Cross-Origin-Opener-Policy':        'same-origin',
    'Cross-Origin-Resource-Policy':      'same-origin',
  }
}

// ─── IP Rate Limiting (simple in-edge store) ────────────
const ipHits = new Map<string, { count: number; reset: number }>()

function edgeRateLimit(ip: string, limit: number, windowMs: number): boolean {
  const now = Date.now()
  let entry = ipHits.get(ip)
  if (!entry || entry.reset < now) {
    entry = { count: 0, reset: now + windowMs }
  }
  entry.count++
  ipHits.set(ip, entry)
  return entry.count <= limit
}

// ─── Bot / Scanner Detection ────────────────────────────
const BLOCKED_UA_PATTERNS = [
  /sqlmap/i, /nikto/i, /nessus/i, /acunetix/i,
  /masscan/i, /nmap/i, /zgrab/i, /dirbuster/i,
  /havij/i, /openvas/i, /w3af/i, /burpsuite/i,
]

const SUSPICIOUS_PATHS = [
  /\.(php|asp|aspx|jsp|cgi)$/i,
  /wp-(admin|login|content|includes)/i,
  /\/etc\/passwd/,
  /\/proc\//,
  /\.\.\//,
  /union.*select/i,
  /<script/i,
]

// ─── Main Middleware ─────────────────────────────────────
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // 1. Generuj nonce pro CSP
  const nonce = Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString('base64')

  // 2. Extrahuj IP
  const ip =
    req.headers.get('x-vercel-forwarded-for')?.split(',')[0].trim() ??
    req.headers.get('cf-connecting-ip') ??
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    '0.0.0.0'

  // 3. Detekce scannerů a botů
  const ua = req.headers.get('user-agent') ?? ''
  if (BLOCKED_UA_PATTERNS.some(p => p.test(ua))) {
    console.error('[SECURITY] Blocked scanner UA', { ip, ua: ua.slice(0, 100), path: pathname })
    return new NextResponse(null, { status: 403 })
  }

  // 4. Detekce podezřelých URL
  if (SUSPICIOUS_PATHS.some(p => p.test(pathname))) {
    console.error('[SECURITY] Suspicious path', { ip, path: pathname })
    return new NextResponse(null, { status: 400 })
  }

  // 5. Global rate limit (per IP, všechny requesty)
  const globalAllowed = edgeRateLimit(ip, 200, 60_000) // 200/min per IP
  if (!globalAllowed) {
    console.error('[SECURITY] Global rate limit', { ip })
    return new NextResponse(JSON.stringify({ error: 'Too many requests' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json', 'Retry-After': '60' },
    })
  }

  // 6. Přísnější limit pro API endpointy
  if (pathname.startsWith('/api/')) {
    const apiAllowed = edgeRateLimit(`api:${ip}`, 30, 60_000) // 30/min per IP na API
    if (!apiAllowed) {
      return new NextResponse(JSON.stringify({ error: 'API rate limit exceeded' }), {
        status: 429,
        headers: { 'Content-Type': 'application/json', 'Retry-After': '60' },
      })
    }
  }

  // 7. Webhook endpoint – pouze POST, specifická cesta
  if (pathname === '/api/payment/webhook' && req.method !== 'POST') {
    return new NextResponse(null, { status: 405 })
  }

  // 8. Admin ochrana – Supabase autentifikace
  if (pathname.startsWith('/admin')) {
    const res = NextResponse.next()
    const supabase = createMiddlewareClient({ req, res })
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      const loginUrl = new URL('/login', req.url)
      loginUrl.searchParams.set('redirect', pathname)
      return NextResponse.redirect(loginUrl)
    }
  }

  // 9. Přidej security headers
  const response = NextResponse.next({
    request: {
      headers: new Headers({
        ...Object.fromEntries(req.headers),
        'x-nonce': nonce,
        'x-forwarded-ip': ip,
      }),
    },
  })

  // Nastav security headers
  const secHeaders = buildSecurityHeaders(nonce)
  for (const [key, value] of Object.entries(secHeaders)) {
    response.headers.set(key, value)
  }

  // Odstraň informace o serveru
  response.headers.delete('x-powered-by')
  response.headers.delete('server')

  return response
}

export const config = {
  matcher: [
    // Všechny cesty kromě statických souborů a Next.js internals
    '/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)',
  ],
}
