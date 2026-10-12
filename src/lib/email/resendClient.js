import { EMAIL_ERROR, EmailDeliveryError } from '@/lib/email/emailErrors'

const RESEND_API_URL = 'https://api.resend.com/emails'
const DEFAULT_TIMEOUT_MS = 20_000

export async function sendResendEmail({
  to,
  subject,
  html,
  text,
  apiKey = process.env.RESEND_API_KEY,
  from = process.env.EMAIL_FROM,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  fetchFn = fetch,
} = {}) {
  if (!apiKey || typeof apiKey !== 'string' || !apiKey.trim()) {
    throw new EmailDeliveryError(EMAIL_ERROR.CONFIG_MISSING, 'RESEND_API_KEY is not configured')
  }
  if (!from || typeof from !== 'string' || !from.trim()) {
    throw new EmailDeliveryError(EMAIL_ERROR.CONFIG_MISSING, 'EMAIL_FROM is not configured')
  }
  if (!to || typeof to !== 'string' || !to.includes('@')) {
    throw new EmailDeliveryError(EMAIL_ERROR.INVALID_RECIPIENT, 'Valid recipient email address is required')
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  let response
  try {
    response = await fetchFn(RESEND_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey.trim()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: from.trim(),
        to: [to.trim()],
        subject,
        html,
        text,
      }),
      signal: controller.signal,
    })
  } catch (error) {
    if (error?.name === 'AbortError') {
      // Ambiguous outcome: request may have been received by provider before the client timed out
      throw new EmailDeliveryError(EMAIL_ERROR.UNKNOWN_OUTCOME, 'Provider request timed out with unknown outcome')
    }
    throw new EmailDeliveryError(EMAIL_ERROR.PROVIDER_UNAVAILABLE, error?.message ?? 'Network error connecting to email provider')
  } finally {
    clearTimeout(timer)
  }

  if (response.status === 429) {
    throw new EmailDeliveryError(EMAIL_ERROR.RATE_LIMITED, 'Email provider rate limited')
  }

  if (response.status === 401 || response.status === 403) {
    throw new EmailDeliveryError(EMAIL_ERROR.CONFIG_MISSING, 'Email provider authentication or authorization failed')
  }

  if (response.status >= 400 && response.status < 500) {
    const errorBody = await response.json().catch(() => null)
    throw new EmailDeliveryError(
      EMAIL_ERROR.INVALID_RECIPIENT,
      errorBody?.message ?? `Invalid request to email provider (${response.status})`
    )
  }

  if (response.status >= 500) {
    throw new EmailDeliveryError(EMAIL_ERROR.PROVIDER_UNAVAILABLE, `Email provider returned ${response.status}`)
  }

  const data = await response.json().catch(() => ({}))
  return { success: true, messageId: data?.id ?? null }
}

