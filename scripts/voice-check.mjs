// Deterministic, no-network, no-browser checks for the voice recording helpers.
//
//   node scripts/voice-check.mjs
import assert from 'node:assert/strict'
import { interpretTranscription } from '../src/lib/assistantClient.js'
import {
  appendToDraft,
  describeMicrophoneError,
  extensionForMime,
  formatElapsed,
  isVoiceSupported,
  pickRecordingMimeType,
} from '../src/lib/voiceRecorder.js'

const recorderSupporting = (...types) => ({ isTypeSupported: (type) => types.includes(type) })
let passed = 0
const check = (name, fn) => {
  fn()
  passed += 1
  console.log(`ok - ${name}`)
}

check('MIME selection per browser', () => {
  assert.equal(pickRecordingMimeType(recorderSupporting('audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus')), 'audio/webm;codecs=opus') // Chrome/Firefox
  assert.equal(pickRecordingMimeType(recorderSupporting('audio/mp4')), 'audio/mp4') // Safari/iOS < 18.4
  assert.equal(pickRecordingMimeType(recorderSupporting('audio/mp4', 'audio/webm;codecs=opus')), 'audio/webm;codecs=opus') // Safari >= 18.4
  assert.equal(pickRecordingMimeType(recorderSupporting('audio/ogg;codecs=opus')), 'audio/ogg;codecs=opus')
  assert.equal(pickRecordingMimeType(recorderSupporting()), '') // browser default container
  assert.equal(pickRecordingMimeType(undefined), '')
})

check('extension from recorder MIME type', () => {
  assert.equal(extensionForMime('audio/webm;codecs=opus'), 'webm')
  assert.equal(extensionForMime('audio/mp4'), 'mp4')
  assert.equal(extensionForMime('audio/ogg; codecs=opus'), 'ogg')
  assert.equal(extensionForMime(''), 'webm')
})

check('voice support detection', () => {
  assert.equal(isVoiceSupported({}), false)
  assert.equal(isVoiceSupported({ MediaRecorder: class {} }), false) // e.g. insecure context
  assert.equal(isVoiceSupported({ MediaRecorder: class {}, navigator: { mediaDevices: { getUserMedia() {} } } }), true)
})

check('microphone error messages', () => {
  assert.match(describeMicrophoneError({ name: 'NotAllowedError' }), /blocked/)
  assert.match(describeMicrophoneError({ name: 'NotFoundError' }), /No microphone/)
  assert.match(describeMicrophoneError({ name: 'NotReadableError' }), /unavailable/)
  assert.match(describeMicrophoneError(new Error('x')), /Couldn't start/)
})

check('timer and draft helpers', () => {
  assert.equal(formatElapsed(0), '0:00')
  assert.equal(formatElapsed(12.9), '0:12')
  assert.equal(formatElapsed(60), '1:00')
  assert.equal(appendToDraft('', 'log gym'), 'log gym')
  assert.equal(appendToDraft('Hello ', 'log gym'), 'Hello log gym')
  assert.equal(appendToDraft('a'.repeat(3999), 'bcd').length, 4000)
})

check('transcription response interpretation', () => {
  assert.deepEqual(interpretTranscription(200, { success: true, data: { text: 'hi' } }), { ok: true, text: 'hi' })
  assert.equal(interpretTranscription(401, { success: false }).unauthorized, true)
  assert.equal(interpretTranscription(422, { success: false, code: 'NO_SPEECH', message: 'm' }).code, 'NO_SPEECH')
  const limited = interpretTranscription(429, { success: false, code: 'RATE_LIMITED', data: { retryAfterSeconds: 7 } })
  assert.equal(limited.retryAfterSeconds, 7)
  assert.equal(interpretTranscription(500, null).code, 'ERROR')
  assert.equal(interpretTranscription(200, { success: true, data: {} }).ok, false)
})

console.log(`\n${passed} checks passed`)
