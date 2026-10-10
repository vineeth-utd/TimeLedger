'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { sendTranscription } from '@/lib/assistantClient'
import {
  MAX_RECORDING_SECONDS,
  MIN_RECORDING_BYTES,
  MIN_RECORDING_MS,
  baseMimeType,
  describeMicrophoneError,
  extensionForMime,
  isVoiceSupported,
  pickRecordingMimeType,
} from '@/lib/voiceRecorder'

const TRANSCRIPTION_ERRORS = {
  NO_SPEECH: "We couldn't hear any speech. Please try again.",
  NETWORK: "Couldn't reach the server. Please try again.",
}

// Tap-to-record state machine: idle -> requesting -> recording -> stopping -> transcribing -> idle.
// Audio exists only in this hook's refs/closures; it is uploaded once and dropped. The returned
// text goes to `onTranscript` only: nothing here talks to the chat endpoints.
export function useVoiceRecorder({ onTranscript }) {
  const router = useRouter()
  const [state, setState] = useState('idle')
  const [elapsed, setElapsed] = useState(0)
  const [error, setError] = useState(null)
  // The widget renders nothing until the session is confirmed on the client, so detecting browser
  // support here cannot cause a hydration mismatch.
  const [supported] = useState(() => isVoiceSupported())

  const session = useRef(null) // { recorder, stream, chunks, startedAt, cancelled, timer, limit }
  const abortRef = useRef(null)
  const runId = useRef(0) // invalidates callbacks of a cancelled/superseded recording
  const onTranscriptRef = useRef(onTranscript)
  useEffect(() => {
    onTranscriptRef.current = onTranscript
  }, [onTranscript])

  const releaseSession = useCallback(() => {
    const current = session.current
    session.current = null
    if (!current) return
    clearInterval(current.timer)
    clearTimeout(current.limit)
    current.stream.getTracks().forEach((track) => track.stop())
    current.chunks.length = 0
  }, [])

  // Stops everything and returns to idle without sending anything.
  const cancel = useCallback(() => {
    runId.current += 1
    const current = session.current
    if (current) {
      current.cancelled = true
      current.recorder.ondataavailable = null
      current.recorder.onstop = null
      current.recorder.onerror = null
      if (current.recorder.state !== 'inactive') {
        try {
          current.recorder.stop()
        } catch {}
      }
    }
    releaseSession()
    abortRef.current?.abort()
    abortRef.current = null
    setElapsed(0)
    setState('idle')
  }, [releaseSession])

  useEffect(() => {
    const onPageHide = () => cancel()
    window.addEventListener('pagehide', onPageHide)
    return () => {
      window.removeEventListener('pagehide', onPageHide)
      cancel()
    }
  }, [cancel])

  const transcribe = useCallback(
    async (blob, mimeType, id) => {
      const type = baseMimeType(mimeType)
      const file = new File([blob], `recording.${extensionForMime(type)}`, { type })
      const controller = new AbortController()
      abortRef.current = controller
      setState('transcribing')
      const result = await sendTranscription(file, controller.signal)
      if (id !== runId.current) return
      abortRef.current = null
      setState('idle')
      if (result.ok) {
        onTranscriptRef.current(result.text)
      } else if (result.unauthorized) {
        router.replace('/login')
      } else {
        const retry = result.retryAfterSeconds ? ` Try again in ${result.retryAfterSeconds}s.` : ''
        setError((TRANSCRIPTION_ERRORS[result.code] ?? result.message ?? 'Transcription failed. Please try again.') + retry)
      }
    },
    [router]
  )

  // Fires on user stop, the 60 s limit, or the browser ending the recording on its own.
  const finishRecording = useCallback(
    (current, id) => {
      const durationMs = Date.now() - current.startedAt
      const mimeType = current.recorder.mimeType || current.mimeType
      const blob = new Blob(current.chunks, { type: mimeType })
      releaseSession()
      setElapsed(0)
      if (id !== runId.current) return
      if (durationMs < MIN_RECORDING_MS || blob.size < MIN_RECORDING_BYTES) {
        setState('idle')
        setError('Recording was too short. Tap the microphone and speak, then tap stop.')
        return
      }
      transcribe(blob, mimeType, id)
    },
    [releaseSession, transcribe]
  )

  const start = useCallback(async () => {
    if (state !== 'idle') return
    setError(null)
    setState('requesting')
    const id = ++runId.current
    let stream
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
      })
    } catch (e) {
      if (id !== runId.current) return
      setState('idle')
      setError(describeMicrophoneError(e))
      return
    }
    if (id !== runId.current) {
      stream.getTracks().forEach((track) => track.stop())
      return
    }
    try {
      const mimeType = pickRecordingMimeType()
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      const current = { recorder, stream, chunks: [], startedAt: Date.now(), mimeType, cancelled: false }
      recorder.ondataavailable = (event) => {
        if (event.data?.size) current.chunks.push(event.data)
      }
      recorder.onstop = () => finishRecording(current, id)
      recorder.onerror = () => {
        cancel()
        setError("Couldn't record audio. Please try again.")
      }
      current.timer = setInterval(() => setElapsed((Date.now() - current.startedAt) / 1000), 250)
      current.limit = setTimeout(() => {
        if (recorder.state === 'recording') {
          setState('stopping')
          recorder.stop()
        }
      }, MAX_RECORDING_SECONDS * 1000)
      session.current = current
      recorder.start()
      setElapsed(0)
      setState('recording')
    } catch (e) {
      stream.getTracks().forEach((track) => track.stop())
      setState('idle')
      setError(describeMicrophoneError(e))
    }
  }, [state, cancel, finishRecording])

  const stop = useCallback(() => {
    const recorder = session.current?.recorder
    if (state !== 'recording' || recorder?.state !== 'recording') return
    setState('stopping')
    recorder.stop()
  }, [state])

  const dismissError = useCallback(() => setError(null), [])

  return { supported, state, elapsed, error, start, stop, cancel, dismissError }
}
