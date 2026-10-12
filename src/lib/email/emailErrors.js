export const EMAIL_ERROR = Object.freeze({
  CONFIG_MISSING: 'EMAIL_CONFIG_MISSING',
  RECIPIENT_MISSING: 'EMAIL_RECIPIENT_MISSING',
  INVALID_RECIPIENT: 'EMAIL_INVALID_RECIPIENT',
  RATE_LIMITED: 'EMAIL_RATE_LIMITED',
  PROVIDER_UNAVAILABLE: 'EMAIL_PROVIDER_UNAVAILABLE',
  UNKNOWN_OUTCOME: 'EMAIL_UNKNOWN_OUTCOME',
  ATTEMPTS_EXCEEDED: 'EMAIL_ATTEMPTS_EXCEEDED',
  INTERNAL: 'EMAIL_INTERNAL',
})

export class EmailDeliveryError extends Error {
  constructor(code, detail) {
    super(detail ?? code)
    this.name = 'EmailDeliveryError'
    this.code = code
  }
}

// Determines if an error code is safe for automatic scheduled retry.
// Ambiguous timeouts/unknown outcomes MUST NOT be retried automatically to prevent duplicate emails.
export function isRetryableEmailError(code) {
  return [EMAIL_ERROR.RATE_LIMITED, EMAIL_ERROR.PROVIDER_UNAVAILABLE].includes(code)
}

