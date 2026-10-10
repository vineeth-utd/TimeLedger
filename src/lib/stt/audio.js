import { SttError } from './errors.js'

// Server-enforced cap for a single voice command (~2+ minutes of any browser MediaRecorder codec).
export const MAX_AUDIO_BYTES = 2 * 1024 * 1024
const MIN_AUDIO_BYTES = 100

// Container kinds browsers' MediaRecorder realistically produce (Chrome/Edge/Android: webm,
// Firefox: ogg/webm, Safari/iOS: mp4) plus other formats the provider accepts.
const KIND_BY_MIME = {
  'audio/webm': 'webm',
  'video/webm': 'webm',
  'audio/ogg': 'ogg',
  'audio/mp4': 'mp4',
  'video/mp4': 'mp4',
  'audio/x-m4a': 'mp4',
  'audio/m4a': 'mp4',
  'audio/mpeg': 'mp3',
  'audio/mp3': 'mp3',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/wave': 'wav',
  'audio/flac': 'flac',
  'audio/x-flac': 'flac',
}

const MIME_BY_KIND = {
  webm: 'audio/webm',
  ogg: 'audio/ogg',
  mp4: 'audio/mp4',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  flac: 'audio/flac',
}

const ascii = (bytes, start, length) => String.fromCharCode(...bytes.slice(start, start + length))

// Lightweight container-signature check. It only rejects obviously mislabeled or garbage uploads;
// it does not prove the file contains decodable audio (that is the speech provider's job).
export function hasSignature(kind, bytes) {
  switch (kind) {
    case 'webm':
      return bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3
    case 'ogg':
      return ascii(bytes, 0, 4) === 'OggS'
    case 'mp4':
      return ascii(bytes, 4, 4) === 'ftyp'
    case 'wav':
      return ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 4) === 'WAVE'
    case 'mp3':
      return ascii(bytes, 0, 3) === 'ID3' || (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0)
    case 'flac':
      return ascii(bytes, 0, 4) === 'fLaC'
    default:
      return false
  }
}

// Base MIME type without parameters, e.g. "audio/webm;codecs=opus" -> "audio/webm".
function baseMimeType(type) {
  return String(type ?? '').split(';')[0].trim().toLowerCase()
}

// Validates an uploaded audio Blob/File and returns the normalized `{ extension, mimeType }`
// to use when forwarding it to the provider. Throws SttError on failure.
export async function validateAudio(file) {
  if (file.size > MAX_AUDIO_BYTES) {
    throw new SttError('AUDIO_TOO_LARGE', 'Recording is too large. Please keep voice commands short.', 413)
  }
  if (file.size < MIN_AUDIO_BYTES) {
    throw new SttError('INVALID_AUDIO', 'The recording is empty. Please try again.', 400)
  }
  const kind = KIND_BY_MIME[baseMimeType(file.type)]
  if (!kind) {
    throw new SttError('UNSUPPORTED_AUDIO_FORMAT', 'Unsupported audio format.', 415)
  }
  const header = new Uint8Array(await file.slice(0, 12).arrayBuffer())
  if (!hasSignature(kind, header)) {
    throw new SttError('UNSUPPORTED_AUDIO_FORMAT', 'Unsupported audio format.', 415)
  }
  return { extension: kind, mimeType: MIME_BY_KIND[kind] }
}
