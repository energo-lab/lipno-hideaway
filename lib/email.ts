import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM = 'Lipno Hideaway <noreply@lipno20.cz>'

export async function sendBookingConfirmation(reservation: Record<string, unknown>) {
  return resend.emails.send({
    from: FROM,
    to: reservation.guest_email as string,
    subject: 'Potvrzeni rezervace - Lipno Hideaway',
    html: '<h2>Dekujeme, ' + reservation.guest_name + '!</h2>' +
      '<p>Check-in: ' + reservation.check_in + '</p>' +
      '<p>Check-out: ' + reservation.check_out + '</p>' +
      '<p>Cena: ' + reservation.total_price + ' Kc</p>',
  })
}

export async function sendPaymentConfirmation(reservation: Record<string, unknown>, amount: number) {
  return resend.emails.send({
    from: FROM,
    to: reservation.guest_email as string,
    subject: 'Platba prijata - Lipno Hideaway',
    html: '<h2>Platba potvrzena!</h2><p>Prijata ' + amount + ' Kc.</p>',
  })
}

export async function sendAdminNotification(reservation: Record<string, unknown>, subject: string, message: string) {
  return resend.emails.send({
    from: FROM,
    to: process.env.ADMIN_EMAIL ?? 'info@lipno20.cz',
    subject,
    html: '<p>' + message + '</p>',
  })
}
