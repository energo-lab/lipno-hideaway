// app/api/payment/create/route.ts
// Creates a Comgate payment and returns the redirect URL

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { comgateCreatePayment } from '../../../../lib/comgate'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const { reservationId, payFullAmount } = await req.json()

    if (!reservationId) {
      return NextResponse.json({ error: 'Missing reservationId' }, { status: 400 })
    }

    // Load reservation
    const { data: reservation, error } = await supabase
      .from('reservations')
      .select('*')
      .eq('id', reservationId)
      .single()

    if (error || !reservation) {
      return NextResponse.json({ error: 'Reservation not found' }, { status: 404 })
    }

    // Determine amount to charge
    const alreadyPaid = await getAlreadyPaidAmount(reservationId)
    const remaining = reservation.total_price - alreadyPaid

    if (remaining <= 0) {
      return NextResponse.json({ error: 'Already fully paid' }, { status: 400 })
    }

    // If deposit-only mode, charge deposit; otherwise full remaining
    const chargeAmount = payFullAmount
      ? remaining
      : (reservation.deposit_amount > 0 && alreadyPaid === 0
          ? reservation.deposit_amount
          : remaining)

    const amountInCents = Math.round(chargeAmount * 100)

    // Create payment record
    const { data: payment, error: payErr } = await supabase
      .from('payments')
      .insert({
        reservation_id: reservationId,
        amount: chargeAmount,
        currency: 'CZK',
        status: 'pending',
      })
      .select()
      .single()

    if (payErr || !payment) {
      return NextResponse.json({ error: 'Failed to create payment record' }, { status: 500 })
    }

    // Call Comgate
    const result = await comgateCreatePayment({
      reservationId,
      amount: amountInCents,
      label: `Lipno Hideaway – pobyt ${reservation.check_in}`,
      email: reservation.guest_email,
      refId: payment.id,       // use payment ID as ref
      notifUrl: `${process.env.NEXT_PUBLIC_URL}/api/payment/webhook`,
      returnUrl: `${process.env.NEXT_PUBLIC_URL}/rezervace/dekujeme?id=${reservationId}`,
    })

    if (result.code !== '0') {
      await supabase.from('payments').update({ status: 'error', raw_response: result }).eq('id', payment.id)
      return NextResponse.json({ error: result.message }, { status: 502 })
    }

    // Store transId & payment URL
    await supabase.from('payments').update({
      comgate_trans_id: result.transId,
      payment_url: result.redirect,
      raw_response: result,
    }).eq('id', payment.id)

    return NextResponse.json({ paymentUrl: result.redirect, transId: result.transId })

  } catch (err) {
    console.error('[payment/create]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

async function getAlreadyPaidAmount(reservationId: string): Promise<number> {
  const { data } = await supabase
    .from('payments')
    .select('amount')
    .eq('reservation_id', reservationId)
    .eq('status', 'paid')
  return (data ?? []).reduce((sum, p) => sum + p.amount, 0)
}
