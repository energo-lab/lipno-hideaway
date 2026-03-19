import crypto from 'crypto'

export function verifyComgateWebhook(params: Record<string, string>): boolean {
  const secret = process.env.COMGATE_SECRET!
  const { hmac, ...rest } = params
  const message = Object.keys(rest).sort().map(k => `${k}=${rest[k]}`).join('&')
  const expected = crypto.createHmac('sha256', secret).update(message).digest('hex')
  return hmac === expected
}
