import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { addSecurityHeaders } from '../../../lib/security'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

export async function POST(req: NextRequest) {
  const { date_from, date_to, reason } = await req.json()
  const { data, error } = await supabase
    .from('blocked_dates')
    .insert({ date_from, date_to, reason })
    .select().single()
  if (error) return addSecurityHeaders(NextResponse.json({ error: error.message }, { status: 500 }))
  return addSecurityHeaders(NextResponse.json(data, { status: 201 }))
}

export async function DELETE(req: NextRequest) {
  const id = new URL(req.url).searchParams.get('id')
  await supabase.from('blocked_dates').delete().eq('id', id)
  return addSecurityHeaders(NextResponse.json({ success: true }))
}
