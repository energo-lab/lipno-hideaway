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

        <!-- Header -->
        <tr>
          <td style="background:#1B2B22;padding:40px 48px;text-align:center;">
            <div style="font-size:11px;letter-spacing:4px;text-transform:uppercase;color:#A8B8AB;margin-bottom:8px;">Lipno nad Vltavou · Slupečná</div>
            <div style="font-size:28px;color:#ffffff;font-weight:300;letter-spacing:1px;">Lipno Hideaway</div>
            <div style="font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#C4654A;margin-top:4px;">lipno20.cz</div>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:48px 48px 32px;">
            <p style="font-size:22px;color:#1B2B22;margin:0 0 8px 0;font-weight:300;">Děkujeme za vaši poptávku, ${reservation.guest_name}!</p>
            <p style="font-size:15px;color:#6B6560;line-height:1.7;margin:0 0 32px 0;">
              Vaši žádost o rezervaci jsme přijali. Níže naleznete souhrn poptávaného termínu a předběžné náklady pobytu.
            </p>

            <!-- Dates -->
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

            <!-- Price breakdown -->
            <div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#A8A09A;margin-bottom:16px;">Přehled nákladů</div>
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
              <tr>
                <td style="padding:10px 0;border-bottom:1px solid #EDE7DC;font-size:14px;color:#3D4F42;">
                  Ubytování (${nights} nocí × ${formatPrice(accommodationPrice / nights)})
                </td>
                <td style="padding:10px 0;border-bottom:1px solid #EDE7DC;font-size:14px;color:#1B2B22;font-weight:600;text-align:right;">
                  ${formatPrice(accommodationPrice)}
                </td>
              </tr>
              <tr>
                <td style="padding:10px 0;border-bottom:1px solid #EDE7DC;font-size:14px;color:#3D4F42;">
                  Úklid po odjezdu
                </td>
                <td style="padding:10px 0;border-bottom:1px solid #EDE7DC;font-size:14px;color:#1B2B22;font-weight:600;text-align:right;">
                  ${formatPrice(CLEANING_FEE)}
                </td>
              </tr>
              <tr>
                <td style="padding:10px 0;border-bottom:1px solid #EDE7DC;font-size:14px;color:#3D4F42;">
                  Místní poplatek (${adults} os. × ${nights} nocí × ${CITY_TAX_PER_ADULT_PER_NIGHT} Kč)
                </td>
                <td style="padding:10px 0;border-bottom:1px solid #EDE7DC;font-size:14px;color:#1B2B22;font-weight:600;text-align:right;">
                  ${formatPrice(cityTax)}
                </td>
              </tr>
              <tr>
                <td style="padding:16px 0 4px;font-size:16px;color:#1B2B22;font-weight:600;">Celkem k úhradě</td>
                <td style="padding:16px 0 4px;font-size:20px;color:#C4654A;font-weight:700;text-align:right;">${formatPrice(totalWithFees)}</td>
              </tr>
            </table>

            <!-- Payment notice -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#FDF3EE;border-left:3px solid #C4654A;border-radius:0 8px 8px 0;margin-bottom:28px;">
              <tr>
                <td style="padding:20px 24px;">
                  <div style="font-size:13px;font-weight:700;color:#C4654A;margin-bottom:8px;text-transform:uppercase;letter-spacing:1px;">Důležité informace k rezervaci</div>
                  <p style="font-size:14px;color:#3D4F42;line-height:1.7;margin:0 0 10px 0;">
                    Tato zpráva je potvrzením přijetí vaší poptávky. <strong>Rezervace bude závazně potvrzena až po uhrazení platby za ubytování.</strong>
                  </p>
                  <p style="font-size:14px;color:#3D4F42;line-height:1.7;margin:0;">
                    Odkaz na bezpečnou online platbu vám zašleme v <strong>samostatném e-mailu v nejbližších hodinách</strong>. Po přijetí platby obdržíte závazné potvrzení rezervace s dalšími informacemi o pobytu.
                  </p>
                </td>
              </tr>
            </table>

            <!-- Contact -->
            <p style="font-size:13px;color:#A8A09A;line-height:1.7;margin:0 0 8px 0;">
              V případě dotazů nás neváhejte kontaktovat:
            </p>
            <p style="font-size:13px;color:#3D4F42;margin:0;">
              📧 <a href="mailto:info@lipno20.cz" style="color:#1B2B22;text-decoration:none;font-weight:600;">info@lipno20.cz</a>
              &nbsp;&nbsp;·&nbsp;&nbsp;
              📞 <a href="tel:+420724150664" style="color:#1B2B22;text-decoration:none;font-weight:600;">+420 724 150 664</a>
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#F8F4EE;padding:24px 48px;text-align:center;border-top:1px solid #EDE7DC;">
            <div style="font-size:11px;color:#A8A09A;line-height:1.6;">
              Lipno Hideaway · Slupečná 298, 382 78 Lipno nad Vltavou<br>
              <a href="https://www.lipno20.cz" style="color:#A8A09A;text-decoration:none;">www.lipno20.cz</a>
            </div>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`

  return resend.emails.send({
    from: FROM,
    to: reservation.guest_email as string,
    subject: 'Přijali jsme vaši poptávku – Lipno Hideaway',
    html,
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

export async function sendBookingConfirmed(reservation: Record<string, unknown>) {
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
            <p style="font-size:22px;color:#1B2B22;margin:0 0 8px 0;font-weight:300;">Vaše rezervace je potvrzena, ${reservation.guest_name}!</p>
            <p style="font-size:15px;color:#6B6560;line-height:1.7;margin:0 0 32px 0;">
              Těšíme se na vás v Lipno Hideaway. Níže naleznete souhrn vašeho pobytu.
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
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#EEF4EF;border-left:3px solid #3D8B4E;border-radius:0 8px 8px 0;margin-bottom:28px;">
              <tr>
                <td style="padding:20px 24px;">
                  <div style="font-size:13px;font-weight:700;color:#2C6B36;margin-bottom:8px;text-transform:uppercase;letter-spacing:1px;">Rezervace potvrzena</div>
                  <p style="font-size:14px;color:#3D4F42;line-height:1.7;margin:0;">
                    Vaše rezervace je závazně potvrzena. Instrukce a podrobnosti k pobytu vám zašleme v nejbližší době.
                    V případě dotazů nás kontaktujte na <a href="mailto:info@lipno20.cz" style="color:#1B2B22;font-weight:600;">info@lipno20.cz</a> nebo <a href="tel:+420724150664" style="color:#1B2B22;font-weight:600;">+420 724 150 664</a>.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="background:#F8F4EE;padding:24px 48px;text-align:center;border-top:1px solid #EDE7DC;">
            <div style="font-size:11px;color:#A8A09A;line-height:1.6;">
              Lipno Hideaway · Slupečná 298, 382 78 Lipno nad Vltavou<br>
              <a href="https://www.lipno20.cz" style="color:#A8A09A;text-decoration:none;">www.lipno20.cz</a>
            </div>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`

  return resend.emails.send({
    from: FROM,
    to: reservation.guest_email as string,
    subject: 'Rezervace potvrzena – Lipno Hideaway',
    html,
  })
}

export async function sendBookingCancelled(reservation: Record<string, unknown>) {
  const checkIn = reservation.check_in as string
  const checkOut = reservation.check_out as string

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
            <p style="font-size:22px;color:#1B2B22;margin:0 0 8px 0;font-weight:300;">Vážený/á ${reservation.guest_name},</p>
            <p style="font-size:15px;color:#6B6560;line-height:1.7;margin:0 0 24px 0;">
              s lítostí vás informujeme, že váš požadavek na rezervaci termínu <strong>${formatDate(checkIn)} – ${formatDate(checkOut)}</strong> bohužel nemůžeme potvrdit.
            </p>
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#FDF3EE;border-left:3px solid #C4654A;border-radius:0 8px 8px 0;margin-bottom:28px;">
              <tr>
                <td style="padding:20px 24px;">
                  <p style="font-size:14px;color:#3D4F42;line-height:1.7;margin:0;">
                    Pro více informací nebo rezervaci jiného termínu nás prosím kontaktujte na
                    <a href="mailto:info@lipno20.cz" style="color:#1B2B22;font-weight:600;">info@lipno20.cz</a>
                    nebo <a href="tel:+420724150664" style="color:#1B2B22;font-weight:600;">+420 724 150 664</a>.
                    Rádi vám pomůžeme najít vhodný termín.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="background:#F8F4EE;padding:24px 48px;text-align:center;border-top:1px solid #EDE7DC;">
            <div style="font-size:11px;color:#A8A09A;line-height:1.6;">
              Lipno Hideaway · Slupečná 298, 382 78 Lipno nad Vltavou<br>
              <a href="https://www.lipno20.cz" style="color:#A8A09A;text-decoration:none;">www.lipno20.cz</a>
            </div>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`

  return resend.emails.send({
    from: FROM,
    to: reservation.guest_email as string,
    subject: 'Informace k va\u0161í popt\u00e1vce \u2013 Lipno Hideaway',
    html,
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