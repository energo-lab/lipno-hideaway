import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { addSecurityHeaders, validateAdminAuth } from '../../../lib/security'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

export async function POST(req: NextRequest) {
  if (!await validateAdminAuth(req))
    return addSecurityHeaders(NextResponse.json({ error: 'Neautorizováno' }, { status: 401 }))

  const { date_from, date_to, reason } = await req.json()
  const { data, error } = await supabase
    .from('blocked_dates')
    .insert({ date_from, date_to, reason })
    .select().single()
  if (error) return addSecurityHeaders(NextResponse.json({ error: error.message }, { status: 500 }))
  return addSecurityHeaders(NextResponse.json(data, { status: 201 }))
}

export async function DELETE(req: NextRequest) {
  if (!await validateAdminAuth(req))
    return addSecurityHeaders(NextResponse.json({ error: 'Neautorizováno' }, { status: 401 }))

  const id = new URL(req.url).searchParams.get('id')
  if (!id || id === 'undefined' || id === 'null') {
    return addSecurityHeaders(NextResponse.json({ error: 'Missing or invalid id' }, { status: 400 }))
  }
  const { error } = await supabase.from('blocked_dates').delete().eq('id', id)
  if (error) return addSecurityHeaders(NextResponse.json({ error: error.message }, { status: 500 }))
  return addSecurityHeaders(NextResponse.json({ success: true }))
}
