import { getGroqApiKey, getModelName, getOpenAiCompatibleConfig, resolveProvider } from '../providers.js'
import { SttError } from './errors.js'

// The only provider-specific speech-to-text module. Swapping provider/model stays local to this
// file: callers pass an audio Blob and get `{ text }` back. Audio is forwarded from memory only.
// Both providers expose the OpenAI-compatible `/audio/transcriptions` endpoint (STT_PROVIDER).
const GROQ_TRANSCRIPTION_URL = 'https://api.groq.com/openai/v1/audio/transcriptions'
const REQUEST_TIMEOUT_MS = 25_000

// Endpoint, key and model for the selected provider. Throws a configuration error (message only,
// never values) when the provider or its credentials are not configured.
function getTranscriptionConfig() {
  const provider = resolveProvider('STT_PROVIDER')
  const model = getModelName(provider, 'stt')
  if (provider === 'openai-compatible') {
    const { baseURL, apiKey } = getOpenAiCompatibleConfig()
    return { url: `${baseURL}/audio/transcriptions`, apiKey, model }
  }
  return { url: GROQ_TRANSCRIPTION_URL, apiKey: getGroqApiKey(), model }
}

export async function transcribeAudio({ file, extension, mimeType }) {
  let config
  try {
    config = getTranscriptionConfig()
  } catch (error) {
    console.error(`Speech-to-text error: ${error.message}`)
    throw new SttError('TRANSCRIPTION_UNAVAILABLE', 'Transcription is unavailable right now.', 500)
  }
  const { url, apiKey, model } = config

  // The provider infers the container from the filename extension, so name it from the validated type.
  const form = new FormData()
  form.append('file', new Blob([file], { type: mimeType }), `audio.${extension}`)
  form.append('model', model)
  form.append('temperature', '0')
  form.append('response_format', 'json')

  let response
  try {
    response = await fetch(url, {
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
