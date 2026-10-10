import { retryAfterSeconds } from '@/lib/ai/http'
import { SttError } from '@/lib/stt/errors'

// Maps an error from the transcription endpoint to a JSON response.
export function sttErrorResponse(error, label) {
  if (error instanceof SttError) {
    if (error.status === 429) {
      const retryAfter = retryAfterSeconds(error)
      return Response.json(
        {
          success: false,
          code: error.code,
          message: error.message,
          ...(retryAfter && { data: { retryAfterSeconds: retryAfter } }),
        },
        { status: 429, ...(retryAfter && { headers: { 'Retry-After': String(retryAfter) } }) }
      )
    }
    return Response.json({ success: false, code: error.code, message: error.message }, { status: error.status })
  }
  console.error(`${label} error:`, error)
  return Response.json(
    { success: false, code: 'TRANSCRIPTION_FAILED', message: 'Transcription failed. Please try again.' },
    { status: 500 }
  )
}
