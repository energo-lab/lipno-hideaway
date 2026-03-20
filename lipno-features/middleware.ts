// middleware.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'

const CSP = [
  "default-src 'self'",
  "script-src 'self' 'nonce-REPLACE_NONCE' https://vercel.live",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self'",
  "connect-src 'self' https://*.supabase.co https://payments.comgate.cz https://api.resend.com https://api.anthropic.com",
  "frame-src 'none'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "upgrade-insecure-requests",
].join('; ')

function buildSecurityHeaders(nonce: string): Record<string, string> {
  return {
    'Content-Security-Policy':           CSP.replace('REPLACE_NONCE', nonce),
    'X-Frame-Options':                   'DENY',
    'X-Content-Type-Options':            'nosniff',
    'X-DNS-Prefetch-Control':            'off',
    'Referrer-Policy':                   'strict-origin-when-cross-origin',
    'Strict-Transport-Security':         'max-age=31536000; includeSubDomains; preload',
    'Permissions-Policy':                'camera=(), microphone=(), geolocation=(), payment=(self)',
  }
}

const ipHits = new Map<string, { count: number; reset: number }>()

function edgeRateLimit(ip: string, limit: number, windowMs: number): boolean {
  const now = Date.now()
  let entry = ipHits.get(ip)
  if (!entry || entry.reset < now) entry = { count: 0, reset: now + windowMs }
  entry.count++
  ipHits.set(ip, entry)
  return entry.count <= limit
}

const BLOCKED_UA_PATTERNS = [/sqlmap/i, /nikto/i, /nessus/i, /acunetix/i, /masscan/i, /nmap/i]
const SUSPICIOUS_PATHS = [/\.(php|asp|aspx|jsp|cgi)$/i, /wp-(admin|login)/i, /\/etc\/passwd/, /union.*select/i]

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  const nonce = Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString('base64')
  const ip =
    req.headers.get('x-vercel-forwarded-for')?.split(',')[0].trim() ??
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    '0.0.0.0'

  const ua = req.headers.get('user-agent') ?? ''
  if (BLOCKED_UA_PATTERNS.some(p => p.test(ua)))
    return new NextResponse(null, { status: 403 })

  if (SUSPICIOUS_PATHS.some(p => p.test(pathname)))
    return new NextResponse(null, { status: 400 })

  if (!edgeRateLimit(ip, 200, 60_000))
    return new NextResponse(JSON.stringify({ error: 'Too many requests' }), {
      status: 429, headers: { 'Content-Type': 'application/json', 'Retry-After': '60' },
    })

  if (pathname.startsWith('/api/') && !edgeRateLimit(`api:${ip}`, 30, 60_000))
    return new NextResponse(JSON.stringify({ error: 'API rate limit exceeded' }), {
      status: 429, headers: { 'Content-Type': 'application/json', 'Retry-After': '60' },
    })

  if (pathname === '/api/payment/webhook' && req.method !== 'POST')
    return new NextResponse(null, { status: 405 })

  // Admin auth check using @supabase/ssr
  if (pathname.startsWith('/admin')) {
    const response = NextResponse.next()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) { return req.cookies.get(name)?.value },
          set(name: string, value: string, options: CookieOptions) { response.cookies.set({ name, value, ...options }) },
          remove(name: string, options: CookieOptions) { response.cookies.set({ name, value: '', ...options }) },
        },
      }
    )
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      const loginUrl = new URL('/login', req.url)
      loginUrl.searchParams.set('redirect', pathname)
      return NextResponse.redirect(loginUrl)
    }
    return response
  }

  const response = NextResponse.next({
    request: { headers: new Headers({ ...Object.fromEntries(req.headers), 'x-nonce': nonce, 'x-forwarded-ip': ip }) },
  })

  for (const [key, value] of Object.entries(buildSecurityHeaders(nonce)))
    response.headers.set(key, value)

  response.headers.delete('x-powered-by')
  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)'],
}
