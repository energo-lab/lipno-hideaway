import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM = 'Lipno Hideaway <rezervace@lipno20.cz>'

const CLEANING_FEE = 2300
const CITY_TAX_PER_ADULT_PER_NIGHT = 50

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'long', year: 'numeric' })
}

function formatPrice(n: number) {
  return n.toLocaleString('cs-CZ') + ' Kč'
}

export async function sendBookingConfirmation(reservation: Record<string, unknown>) {
  const checkIn = reservation.check_in as string
  const checkOut = reservation.check_out as string
  const nights = Math.ceil((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86400000)
  const adults = Number(reservation.adults ?? 2)
  const accommodationPrice = reservation.total_price as number
  const cityTax = CITY_TAX_PER_ADULT_PER_NIGHT * adults * nights
  const totalWithFees = accommodationPrice + CLEANING_FEE + cityTax

  const html = `
<!DOCTYPE html>
<html lang="cs">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#F5F0EA;font-family:Georgia,'Times New Roman',serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F5F0EA;padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:#1B2B22;padding:40px 48px;text-align:center;">
            <div style="font-size:11px;letter-spacing:4px;text-transform:uppercase;color:#A8B8AB;margin-bottom:8px;">Lipno nad Vltavou · Slupečná</div>
            <div style="font-size:28px;color:#ffffff;font-weight:300;letter-spacing:1px;">Lipno Hideaway</div>
            <div style="font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#C4654A;margin-top:4px;">lipno20.cz</div>
          </td>
        </tr>
        <tr>
          <td style="padding:48px 48px 32px;">
            <p style="font-size:22px;color:#1B2B22;margin:0 0 8px 0;font-weight:300;">Děkujeme za vaši poptávku, ${reservation.guest_name}!</p>
            <p style="font-size:15px;color:#6B6560;line-height:1.7;margin:0 0 32px 0;">
              Vaši žádost o rezervaci jsme přijali. Níže naleznete souhrn poptávaného termínu a předběžné náklady pobytu.
            </p>
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#F8F4EE;border-radius:12px;margin-bottom:28px;">
              <tr>
                <td style="padding:20px 24px;border-right:1px solid #EDE7DC;" width="50%">
                  <div style="font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#A8A09A;margin-bottom:6px;">Příjezd</div>
                  <div style="font-size:16px;color:#1B2B22;font-weight:600;">${formatDate(checkIn)}</div>
                  <div style="font-size:12px;color:#A8A09A;margin-top:2px;">od 15:00</div>
                </td>
                <td style="padding:20px 24px;" width="50%">
                  <div style="font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#A8A09A;margin-bottom:6px;">Odjezd</div>
                  <div style="font-size:16px;color:#1B2B22;font-weight:600;">${formatDate(checkOut)}</div>
                  <div style="font-size:12px;color:#A8A09A;margin-top:2px;">do 10:00</div>
                </td>
              </tr>
              <tr>
                <td colspan="2" style="padding:4px 24px 20px;">
                  <div style="font-size:13px;color:#6B6560;">${nights} nocí · ${adults} dospělí</div>
                </td>
              </tr>
            </table>
            <div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#A8A09A;margin-bottom:16px;">Přehled nákladů</div>
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
              <tr>
                <td style="padding:10px 0;border-bottom:1px solid #EDE7DC;font-size:14px;color:#3D4F42;">Ubytování (${nights} nocí × ${formatPrice(accommodationPrice / nights)})</td>
                <td style="padding:10px 0;border-bottom:1px solid #EDE7DC;font-size:14px;color:#1B2B22;font-weight:600;text-align:right;">${formatPrice(accommodationPrice)}</td>
              </tr>
              <tr>
                <td style="padding:10px 0;border-bottom:1px solid #EDE7DC;font-size:14px;color:#3D4F42;">Úklid po odjezdu</td>
                <td style="padding:10px 0;border-bottom:1px solid #EDE7DC;font-size:14px;color:#1B2B22;font-weight:600;text-align:right;">${formatPrice(CLEANING_FEE)}</td>
              </tr>
              <tr>
                <td style="padding:10px 0;border-bottom:1px solid #EDE7DC;font-size:14px;color:#3D4F42;">Místní poplatek (${adults} os. × ${nights} nocí × ${CITY_TAX_PER_ADULT_PER_NIGHT} Kč)</td>
                <td style="padding:10px 0;border-bottom:1px solid #EDE7DC;font-size:14px;color:#1B2B22;font-weight:600;text-align:right;">${formatPrice(cityTax)}</td>
              </tr>
              <tr>
                <td style="padding:16px 0 4px;font-size:16px;color:#1B2B22;font-weight:600;">Celkem k úhradě</td>
                <td style="padding:16px 0 4px;font-size:20px;color:#C4654A;font-weight:700;text-align:right;">${formatPrice(totalWithFees)}</td>
              </tr>
            </table>
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#FDF3EE;border-left:3px solid #C4654A;border-radius:0 8px 8px 0;margin-bottom:28px;">
              <tr>
                <td style="padding:20px 24px;">
                  <div style="font-size:13px;font