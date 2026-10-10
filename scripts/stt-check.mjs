// Deterministic, no-network checks for the speech-to-text layer: audio validation, provider error
// mapping (fetch is stubbed) and the endpoint's HTTP error responses.
//
//   node scripts/stt-check.mjs
import assert from 'node:assert/strict'
import { register } from 'node:module'
import { MAX_AUDIO_BYTES, validateAudio } from '../src/lib/stt/audio.js'
import { SttError } from '../src/lib/stt/errors.js'

register('./ai-eval-loader.mjs', import.meta.url)
const { sttErrorResponse } = await import('../src/lib/stt/http.js')
const { transcribeAudio } = await import('../src/lib/stt/groq.js')

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

// --- Provider error mapping and HTTP responses (no network: fetch is stubbed) ---
const providerFile = new Blob([bytes(1000, SIGNATURES.webm)], { type: 'audio/webm' })
const originalFetch = globalThis.fetch
const originalKey = process.env.GROQ_API_KEY
const originalError = console.error
console.error = () => {}

async function transcribeWith(stub) {
  globalThis.fetch = stub
  try {
    return await transcribeAudio({ file: providerFile, extension: 'webm', mimeType: 'audio/webm' })
  } finally {
    globalThis.fetch = originalFetch
  }
}
const reply = (status, body, headers = {}) => async () =>
  new Response(typeof body === 'string' ? body : JSON.stringify(body), { status, headers })
async function failure(stub) {
  try {
    await transcribeWith(stub)
  } catch (error) {
    assert.ok(error instanceof SttError)
    return error
  }
  assert.fail('expected an SttError')
}
async function responseFor(error) {
  const response = sttErrorResponse(error, 'test')
  return { status: response.status, headers: response.headers, body: await response.json() }
}

process.env.GROQ_API_KEY = 'test-key'

await check('provider success returns text and sends the expected request', async () => {
  let request
  const result = await transcribeWith(async (url, init) => {
    request = { url, init }
    return new Response(JSON.stringify({ text: ' hello ' }), { status: 200 })
  })
  assert.deepEqual(result, { text: ' hello ' })
  assert.match(request.url, /audio\/transcriptions$/)
  assert.equal(request.init.headers.Authorization, 'Bearer test-key')
  assert.equal(request.init.body.get('model'), 'whisper-large-v3-turbo')
  assert.equal(request.init.body.get('file').name, 'audio.webm')
  assert.equal(request.init.body.has('language'), false)
})

await check('provider 429 maps to RATE_LIMITED with Retry-After', async () => {
  const error = await failure(reply(429, 'rate limited', { 'retry-after': '7' }))
  const { status, headers, body } = await responseFor(error)
  assert.equal(status, 429)
  assert.equal(headers.get('retry-after'), '7')
  assert.deepEqual(body, { success: false, code: 'RATE_LIMITED', message: error.message, data: { retryAfterSeconds: 7 } })
  const clamped = await responseFor(await failure(reply(429, 'x', { 'retry-after': '9999' })))
  assert.equal(clamped.body.data.retryAfterSeconds, 120)
  const bare = await responseFor(await failure(reply(429, 'x')))
  assert.equal(bare.status, 429)
  assert.equal(bare.body.data, undefined)
})

await check('provider and transport failures map to safe responses', async () => {
  const secret = 'SECRET-PROVIDER-DETAIL'
  const rejected = await responseFor(await failure(reply(400, secret)))
  assert.equal(rejected.status, 422)
  assert.equal(rejected.body.code, 'INVALID_AUDIO')
  const tooLarge = await responseFor(await failure(reply(413, secret)))
  assert.equal(tooLarge.status, 413)
  const serverError = await responseFor(await failure(reply(503, secret)))
  assert.equal(serverError.status, 502)
  assert.equal(serverError.body.code, 'TRANSCRIPTION_FAILED')
  const unauthorized = await responseFor(await failure(reply(401, secret)))
  assert.equal(unauthorized.status, 502) // a bad API key is our problem, not the client's
  const timeout = await responseFor(await failure(async () => { throw Object.assign(new Error('t'), { name: 'TimeoutError' }) }))
  assert.equal(timeout.status, 504)
  assert.equal(timeout.body.code, 'TRANSCRIPTION_TIMEOUT')
  const network = await responseFor(await failure(async () => { throw new TypeError('fetch failed') }))
  assert.equal(network.status, 502)
  const malformed = await responseFor(await failure(reply(200, { nope: true })))
  assert.equal(malformed.status, 502)
  for (const result of [rejected, tooLarge, serverError, unauthorized, timeout, network, malformed]) {
    assert.ok(!JSON.stringify(result.body).includes(secret), 'provider detail must not reach the client')
  }
})

await check('missing API key and unexpected errors map to generic responses', async () => {
  delete process.env.GROQ_API_KEY
  const missing = await responseFor(await failure(reply(200, { text: 'x' })))
  assert.equal(missing.status, 500)
  assert.equal(missing.body.code, 'TRANSCRIPTION_UNAVAILABLE')
  const unexpected = await responseFor(new Error('db password leaked'))
  assert.equal(unexpected.status, 500)
  assert.ok(!JSON.stringify(unexpected.body).includes('leaked'))
  const validation = await responseFor(new SttError('NO_SPEECH', 'none', 422))
  assert.deepEqual(validation.body, { success: false, code: 'NO_SPEECH', message: 'none' })
})

console.error = originalError
globalThis.fetch = originalFetch
if (originalKey === undefined) delete process.env.GROQ_API_KEY
else process.env.GROQ_API_KEY = originalKey

console.log(`\n${passed} checks passed`)
