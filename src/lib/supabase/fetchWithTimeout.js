export const AUTH_REQUEST_TIMEOUT_MS = 15_000

export function fetchWithTimeout(url, init) {
  return fetch(url, { ...init, signal: AbortSignal.timeout(AUTH_REQUEST_TIMEOUT_MS) })
}
