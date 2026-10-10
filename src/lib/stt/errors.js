// Error thrown by the speech-to-text layer. `status` is the HTTP status the endpoint responds with.
// `headers` optionally carries provider response headers (used for Retry-After on rate limits).
export class SttError extends Error {
  constructor(code, message, status, headers = null) {
    super(message)
    this.name = 'SttError'
    this.code = code
    this.status = status
    this.headers = headers
  }
}
