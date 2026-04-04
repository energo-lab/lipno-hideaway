import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { addSecurityHeaders } from '../../../lib/security'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
      )

      export async function GET() {
        const { data: reservations } = await supabase
            .from('reservations')
                .select('check_in, check_out')
                    .not('status', 'eq', 'cancelled')

                      const { data: blocked } = await supabase
                          .from('blocked_dates')
                              .select('id, date_from, date_to, reason')

                                return addSecurityHeaders(NextResponse.json({
                                    reservations: reservations || [],
                                        blocked: blocked || [],
                                          }))
                                          }