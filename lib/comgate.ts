// lib/comgate.ts – Comgate payment gateway integration
// Docs: https://apidoc.comgate.cz/

const COMGATE_API = 'https://payments.comgate.cz/v1.0'

export interface ComgateCreateParams {
  reservationId: string
  amount: number        // in CENTS (e.g. 150000 = 1500 CZK)
  currency?: string     // CZK default
  label: string         // description shown to customer
  email: string         // customer email
  refId: string         // your internal reference (reservation ID)
  method?: string       // 'ALL' = let customer choose
  prepareOnly?: boolean
  returnUrl?: string
  notifUrl?: string
}

export interface ComgateCreateResult {
  code: string          // '0' = success
  message: string
  transId?: string
  redirect?: string
}

export interface ComgateStatusResult {
  code: string
  message: string
  merchant: string
  test: string
  price: string
  curr: string
  label: string
  refId: string
  payerId: string
  method: string
  email: string
  name: string
  transId: string
  secret: string
  status: 'PENDING' | 'PAID' | 'CANCELLED' | 'AUTHORIZED' | 'ERROR'
  fee: string
  vs: string
}

function formEncode(data: Record<string, string>): string {
  return new URLSearchParams(data).toString()
}

export async function comgateCreatePayment(params: ComgateCreateParams): Promise<ComgateCreateResult> {
  const merchant = process.env.COMGATE_MERCHANT_ID!
  const secret = process.env.COMGATE_SECRET!
  const isTest = process.env.COMGATE_TEST === 'true'

  const body = formEncode({
    merchant,
    test: isTest ? 'true' : 'false',
    country: 'CZ',
    price: String(params.amount),   // in cents
    curr: params.currency ?? 'CZK',
    label: params.label,
    refId: params.refId,
    email: params.email,
    method: params.method ?? 'ALL',
    prepareOnly: 'true',
    secret,
    returnUrl: params.returnUrl ?? `${process.env.NEXT_PUBLIC_URL}/rezervace/dekujeme`,
    notifUrl: params.notifUrl ?? `${process.env.NEXT_PUBLIC_URL}/api/payment/webhook`,
  })

  const res = await fetch(`${COMGATE_API}/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })

  if (!res.ok) {
    throw new Error(`Comgate HTTP error: ${res.status}`)
  }

  const text = await res.text()
  const result = Object.fromEntries(new URLSearchParams(text))

  return {
    code: result.code,
    message: result.message,
    transId: result.transId,
    redirect: result.redirect,
  }
}

export async function comgateCheckStatus(transId: string): Promise<ComgateStatusResult> {
  const merchant = process.env.COMGATE_MERCHANT_ID!
  const secret = process.env.COMGATE_SECRET!

  const body = formEncode({ merchant, transId, secret })

  const res = await fetch(`${COMGATE_API}/status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })

  const text = await res.text()
  return Object.fromEntries(new URLSearchParams(text)) as unknown as ComgateStatusResult
}

/** Parse Comgate webhook POST body */
export function parseComgateWebhook(formData: FormData): Partial<ComgateStatusResult> {
  const result: Record<string, string> = {}
  formData.forEach((value, key) => { result[key] = String(value) })
  return result as unknown as Partial<ComgateStatusResult>
}

/** Validate webhook secret matches */
export function validateComgateWebhook(data: Partial<ComgateStatusResult>): boolean {
  return data.secret === process.env.COMGATE_SECRET
}
