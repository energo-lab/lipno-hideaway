export async function comgateCreatePayment(params: {
  reservationId: string
  amount: number
  label: string
  email: string
  refId: string
  notifUrl: string
  returnUrl: string
}) {
  const body = new URLSearchParams({
    merchant: process.env.COMGATE_MERCHANT_ID!,
    secret: process.env.COMGATE_SECRET!,
    price: String(params.amount),
    curr: 'CZK',
    label: params.label,
    refId: params.refId,
    email: params.email,
    returnUrl: params.returnUrl,
    notifUrl: params.notifUrl,
    method: 'ALL',
    prepareOnly: 'true',
  })
  const res = await fetch('https://payments.comgate.cz/v1.0/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  const text = await res.text()
  return Object.fromEntries(new URLSearchParams(text))
}
