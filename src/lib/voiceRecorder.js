// Browser-side helpers for voice recording (native MediaRecorder). Pure functions so they can be
// checked without a browser; the recording state machine lives in useVoiceRecorder.

export const MAX_RECORDING_SECONDS = 60
// Shorter recordings are discarded locally instead of being sent (and billed) for transcription.
export const MIN_RECORDING_MS = 500
export const MIN_RECORDING_BYTES = 1000

// Preferred containers in order: webm/opus (Chrome, Edge, Android, Firefox, Safari 18.4+), then
// mp4/AAC (older Safari/iOS), then ogg/opus. All are accepted by /api/assistant/transcribe.
const CANDIDATE_MIME_TYPES = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm', 'audio/ogg;codecs=opus']

const EXTENSIONS = { 'audio/webm': 'webm', 'video/webm': 'webm', 'audio/ogg': 'ogg', 'audio/mp4': 'mp4', 'video/mp4': 'mp4' }

export function isVoiceSupported(env = globalThis) {
  return typeof env.MediaRecorder !== 'undefined' && typeof env.navigator?.mediaDevices?.getUserMedia === 'function'
}

// Returns the first supported candidate, or '' to let the browser pick its default container.
export function pickRecordingMimeType(MediaRecorderImpl = globalThis.MediaRecorder) {
  if (typeof MediaRecorderImpl?.isTypeSupported !== 'function') return ''
  return CANDIDATE_MIME_TYPES.find((type) => MediaRecorderImpl.isTypeSupported(type)) ?? ''
}

export function baseMimeType(type) {
  return String(type ?? '').split(';')[0].trim().toLowerCase()
}

export function extensionForMime(type) {
  return EXTENSIONS[baseMimeType(type)] ?? 'webm'
}

export function formatElapsed(seconds) {
  const whole = Math.max(0, Math.floor(seconds))
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`
}

export function describeMicrophoneError(error) {
  switch (error?.name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return 'Microphone access is blocked. Allow it in your browser or site settings, then try again.'
    case 'NotFoundError':
    case 'OverconstrainedError':
      return 'No microphone was found.'
    case 'NotReadableError':
    case 'AbortError':
      return 'The microphone is unavailable. It may be in use by another app.'
    default:
      return "Couldn't start recording. Please try again."
  }
}

// Merges a transcription into an existing draft without losing what the user already typed.
export function appendToDraft(draft, text, maxLength = 4000) {
  const base = draft.trimEnd()
  return (base ? `${base} ${text}` : text).slice(0, maxLength)
}
