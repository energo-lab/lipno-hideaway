import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function sendReservationConfirmation(params: { to: string; guestName: string; checkIn: string; checkOut: string; totalPrice: number }) {
  return resend.emails.send({ from: 'Lipno Hideaway <rezervace@lipno20.cz>', to: params.to, subject: 'Potvrzeni rezervace', html: `<h2>Dekujeme, ${params.guestName}!</h2><p>Check-in: ${params.checkIn}</p><p>Check-out: ${params.checkOut}</p><p>Cena: ${params.totalPrice} Kc</p>` })
}

export async function sendPaymentConfirmation(params: { to: string; guestName: string; amount: number; transId: string }) {
  return resend.emails.send({ from: 'Lipno Hideaway <rezervace@lipno20.cz>', to: params.to, subject: 'Platba prijata', html: `<h2>Platba potvrzena!</h2><p>Castka: ${params.amount} Kc (ID: ${params.transId})</p>` })
}
