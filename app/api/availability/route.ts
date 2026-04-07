import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { addSecurityHeaders } from '../../../lib/security'
import { unstable_noStore as noStore } from 'next/cache'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

export async function GET(_req: NextRequest) {
  noStore()

  const { data: reservations } = await supabase
    .from('reservations')
    .select('check_in, check_out')
    .not('status', 'eq', 'cancelled')

  const { data: blocked } = await supabase
    .from('blocked_dates')
    .select('id, date_from, date_to, reason')

  const res = NextResponse.json({
    reservations: reservations || [],
    blocked: blocked || [],
  })
  res.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
  res.headers.set('Surrogate-Control', 'no-store')
  res.headers.set('CDN-Cache-Control', 'no-store')
  return addSecurityHeaders(res)
}