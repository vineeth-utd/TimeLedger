import { getAuthenticatedUser } from '@/lib/auth'
import { MAX_AUDIO_BYTES, validateAudio } from '@/lib/stt/audio'
import { SttError } from '@/lib/stt/errors'
import { transcribeAudio } from '@/lib/stt/groq'
import { sttErrorResponse } from '@/lib/stt/http'

export const runtime = 'nodejs'
export const maxDuration = 30

// Allowance for multipart framing on top of the audio itself.
const MULTIPART_OVERHEAD_BYTES = 64 * 1024

// Speech-to-text only: authenticated audio in, text out. No assistant tools, no database,
// no persistence; the audio lives in memory for the duration of this request.
export async function POST(request) {
  try {
    const user = await getAuthenticatedUser()
    if (!user) {
      return Response.json({ success: false, message: 'Unauthorized' }, { status: 401 })
    }

    if (!request.headers.get('content-type')?.toLowerCase().startsWith('multipart/form-data')) {
      throw new SttError('INVALID_AUDIO', 'Expected multipart/form-data with an "audio" file.', 400)
    }
    const contentLength = Number(request.headers.get('content-length'))
    if (contentLength > MAX_AUDIO_BYTES + MULTIPART_OVERHEAD_BYTES) {
      throw new SttError('AUDIO_TOO_LARGE', 'Recording is too large. Please keep voice commands short.', 413)
    }

    let form
    try {
      form = await request.formData()
    } catch {
      throw new SttError('INVALID_AUDIO', 'Invalid multipart request.', 400)
    }
    const file = form.get('audio')
    if (!(file instanceof Blob)) {
      throw new SttError('INVALID_AUDIO', 'An "audio" file is required.', 400)
    }

    const { extension, mimeType } = await validateAudio(file)
    const { text } = await transcribeAudio({ file, extension, mimeType })

    const transcript = text.trim()
    if (!transcript) {
      throw new SttError('NO_SPEECH', "We couldn't hear any speech. Please try again.", 422)
    }
    return Response.json({ success: true, data: { text: transcript } })
  } catch (error) {
    return sttErrorResponse(error, 'POST /api/assistant/transcribe')
  }
}
