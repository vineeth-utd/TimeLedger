import { SttError } from './errors.js'

// The only provider-specific speech-to-text module. Swapping provider/model stays local to this
// file: callers pass an audio Blob and get `{ text }` back. Audio is forwarded from memory only.
const TRANSCRIPTION_URL = 'https://api.groq.com/openai/v1/audio/transcriptions'
const DEFAULT_MODEL = 'whisper-large-v3-turbo'
const REQUEST_TIMEOUT_MS = 25_000

export async function transcribeAudio({ file, extension, mimeType }) {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) {
    console.error('Speech-to-text error: GROQ_API_KEY is not configured')
    throw new SttError('TRANSCRIPTION_UNAVAILABLE', 'Transcription is unavailable right now.', 500)
  }

  // Groq infers the container from the filename extension, so name it from the validated type.
  const form = new FormData()
  form.append('file', new Blob([file], { type: mimeType }), `audio.${extension}`)
  form.append('model', process.env.STT_MODEL?.trim() || DEFAULT_MODEL)
  form.append('temperature', '0')
  form.append('response_format', 'json')

  let response
  try {
    response = await fetch(TRANSCRIPTION_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
  } catch (error) {
    if (error?.name === 'TimeoutError' || error?.name === 'AbortError') {
      throw new SttError('TRANSCRIPTION_TIMEOUT', 'Transcription took too long. Please try again.', 504)
    }
    console.error('Speech-to-text request error:', error)
    throw new SttError('TRANSCRIPTION_FAILED', 'Transcription failed. Please try again.', 502)
  }

  if (!response.ok) throw await providerError(response)

  const body = await response.json().catch(() => null)
  if (typeof body?.text !== 'string') {
    console.error('Speech-to-text error: unexpected provider response')
    throw new SttError('TRANSCRIPTION_FAILED', 'Transcription failed. Please try again.', 502)
  }
  return { text: body.text }
}

async function providerError(response) {
  const detail = await response.text().catch(() => '')
  console.error(`Speech-to-text provider error (${response.status}):`, detail.slice(0, 300))
  if (response.status === 429) {
    return new SttError('RATE_LIMITED', 'Transcription is busy right now. Please try again in a moment.', 429, response.headers)
  }
  if (response.status === 413) {
    return new SttError('AUDIO_TOO_LARGE', 'Recording is too large. Please keep voice commands short.', 413)
  }
  if (response.status === 400 || response.status === 422) {
    return new SttError('INVALID_AUDIO', "That recording couldn't be read. Please try again.", 422)
  }
  return new SttError('TRANSCRIPTION_FAILED', 'Transcription failed. Please try again.', 502)
}
