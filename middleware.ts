// middleware.ts — Serverová ochrana admin routy
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const ADMIN_PATHS = ['/admin/reservations']

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Chraň pouze /admin/reservations a podobné sub-stránky (ne /admin samotný = login)
  if (!ADMIN_PATHS.some(p => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  // Zkus ověřit Supabase session z cookies
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

  const cookieHeader = req.headers.get('cookie') ?? ''
  // Supabase ukládá access token do cookie sb-*-auth-token
  const accessTokenMatch = cookieHeader.match(/sb-[^-]+-auth-token=([^;]+)/)

  if (accessTokenMatch) {
    try {
      const tokenData = JSON.parse(decodeURIComponent(accessTokenMatch[1]))
      const accessToken = Array.isArray(tokenData) ? tokenData[0] : tokenData?.access_token

      if (accessToken) {
        const supabase = createClient(supabaseUrl, supabaseKey)
        const { data: { user } } = await supabase.auth.getUser(accessToken)
        if (user) return NextResponse.next()
      }
    } catch {
      // Pokračuj na redirect
    }
  }

  // Neověřeno — přesměruj na přihlašovací stránku
  return NextResponse.redirect(new URL('/admin', req.url))
}

export const config = {
  matcher: ['/admin/reservations/:path*'],
}
