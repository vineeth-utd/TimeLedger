// Deterministic, no-network checks for the speech-to-text validation layer.
//
//   node scripts/stt-check.mjs
import assert from 'node:assert/strict'
import { MAX_AUDIO_BYTES, validateAudio } from '../src/lib/stt/audio.js'
import { SttError } from '../src/lib/stt/errors.js'

const bytes = (size, header) => {
  const data = new Uint8Array(size)
  data.set(header)
  return data
}
const ascii = (text) => [...text].map((c) => c.charCodeAt(0))
const SIGNATURES = {
  webm: [0x1a, 0x45, 0xdf, 0xa3],
  ogg: ascii('OggS'),
  mp4: [0, 0, 0, 0x20, ...ascii('ftypM4A ')],
  wav: [...ascii('RIFF'), 0, 0, 0, 0, ...ascii('WAVE')],
  mp3: ascii('ID3'),
  flac: ascii('fLaC'),
}
const blob = (header, type, size = 1000) => new Blob([bytes(size, header)], { type })

async function rejects(file, status, code) {
  await assert.rejects(
    () => validateAudio(file),
    (error) => error instanceof SttError && error.status === status && error.code === code
  )
}

let passed = 0
const check = async (name, fn) => {
  await fn()
  passed += 1
  console.log(`ok - ${name}`)
}

await check('accepts browser recordings (codec params stripped)', async () => {
  assert.deepEqual(await validateAudio(blob(SIGNATURES.webm, 'audio/webm;codecs=opus')), { extension: 'webm', mimeType: 'audio/webm' })
  assert.deepEqual(await validateAudio(blob(SIGNATURES.ogg, 'audio/ogg; codecs=opus')), { extension: 'ogg', mimeType: 'audio/ogg' })
  assert.deepEqual(await validateAudio(blob(SIGNATURES.mp4, 'audio/mp4')), { extension: 'mp4', mimeType: 'audio/mp4' })
  assert.deepEqual(await validateAudio(blob(SIGNATURES.mp4, 'AUDIO/MP4;codecs=mp4a.40.2')), { extension: 'mp4', mimeType: 'audio/mp4' })
})

await check('accepts other provider-supported formats', async () => {
  assert.equal((await validateAudio(blob(SIGNATURES.wav, 'audio/x-wav'))).extension, 'wav')
  assert.equal((await validateAudio(blob(SIGNATURES.mp3, 'audio/mpeg'))).extension, 'mp3')
  assert.equal((await validateAudio(blob([0xff, 0xfb, 0x90], 'audio/mpeg'))).extension, 'mp3')
  assert.equal((await validateAudio(blob(SIGNATURES.flac, 'audio/flac'))).extension, 'flac')
  assert.equal((await validateAudio(blob(SIGNATURES.mp4, 'video/mp4'))).extension, 'mp4')
})

await check('rejects unsupported or missing MIME types (415)', async () => {
  await rejects(blob(SIGNATURES.webm, 'text/plain'), 415, 'UNSUPPORTED_AUDIO_FORMAT')
  await rejects(blob(SIGNATURES.webm, 'application/octet-stream'), 415, 'UNSUPPORTED_AUDIO_FORMAT')
  await rejects(blob(SIGNATURES.webm, ''), 415, 'UNSUPPORTED_AUDIO_FORMAT')
})

await check('rejects garbage and mislabeled content (415)', async () => {
  await rejects(blob(ascii('this is not audio at all'), 'audio/webm'), 415, 'UNSUPPORTED_AUDIO_FORMAT')
  await rejects(blob(SIGNATURES.ogg, 'audio/webm'), 415, 'UNSUPPORTED_AUDIO_FORMAT')
  await rejects(blob(SIGNATURES.webm, 'audio/mp4'), 415, 'UNSUPPORTED_AUDIO_FORMAT')
})

await check('enforces size limits', async () => {
  await validateAudio(blob(SIGNATURES.webm, 'audio/webm', MAX_AUDIO_BYTES))
  await rejects(blob(SIGNATURES.webm, 'audio/webm', MAX_AUDIO_BYTES + 1), 413, 'AUDIO_TOO_LARGE')
  await rejects(new Blob([], { type: 'audio/webm' }), 400, 'INVALID_AUDIO')
  await rejects(blob(SIGNATURES.webm, 'audio/webm', 10), 400, 'INVALID_AUDIO')
})

console.log(`\n${passed} checks passed`)
