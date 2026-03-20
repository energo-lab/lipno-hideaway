// middleware.ts
import { NextRequest, NextResponse } from 'next/server'

const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://vercel.live",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self'",
  "connect-src 'self' https://*.supabase.co https://payments.comgate.cz https://api.resend.com https://api.anthropic.com",
  "frame-src 'none'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ')

const ipHits = new Map<string, { count: number; reset: number }>()

function edgeRateLimit(ip: string, limit: number, windowMs: number): boolean {
  const now = Date.now()
  let entry = ipHits.get(ip)
  if (!entry || entry.reset < now) entry = { count: 0, reset: now + windowMs }
  entry.count++
  ipHits.set(ip, entry)
  return entry.count <= limit
}

const BLOCKED_UA = [/sqlmap/i, /nikto/i, /nessus/i, /acunetix/i, /masscan/i, /nmap/i]
const SUSPICIOUS = [/\.(php|asp|aspx|jsp|cgi)$/i, /wp-(admin|login)/i, /\/etc\/passwd/, /union.*select/i]

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  const ip =
    req.headers.get('x-vercel-forwarded-for')?.split(',')[0].trim() ??
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    '0.0.0.0'

  const ua = req.headers.get('user-agent') ?? ''
  if (BLOCKED_UA.some(p => p.test(ua)))
    return new NextResponse(null, { status: 403 })

  if (SUSPICIOUS.some(p => p.test(pathname)))
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

  if (pathname.startsWith('/admin')) {
    const token = req.cookies.get('sb-access-token')?.value
    if (!token) {
      const loginUrl = new URL('/login', req.url)
      loginUrl.searchParams.set('redirect', pathname)
      return NextResponse.redirect(loginUrl)
    }
  }

  const response = NextResponse.next()
  response.headers.set('Content-Security-Policy', CSP)
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  response.headers.delete('x-powered-by')
  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)'],
}
