import { isValidTimeZone } from '@/lib/timezone'

// Trusted, server-side execution context for AI tools.
// Built from the authenticated session and request metadata — never from LLM output,
// and never part of any tool's input schema.
export function createToolContext({ userId, timezone, now = new Date() }) {
  if (!userId || typeof userId !== 'string') {
    throw new Error('Tool context requires an authenticated userId')
  }
  if (!isValidTimeZone(timezone)) {
    throw new Error('Tool context requires a valid IANA timezone')
  }
  return Object.freeze({ userId, timezone, now })
}
