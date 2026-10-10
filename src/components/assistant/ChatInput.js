'use client'

import { forwardRef } from 'react'
import { Loader2, Mic, SendHorizontal, Square, X } from 'lucide-react'
import { MAX_RECORDING_SECONDS, formatElapsed } from '@/lib/voiceRecorder'

const MAX_LENGTH = 4000

// Replaces the text field while a recording is in progress or being transcribed.
function VoiceBar({ voice }) {
  const { state, elapsed } = voice
  const recording = state === 'recording'
  return (
    <div className="flex-1 flex items-center gap-2 min-w-0">
      <button
        type="button"
        onClick={voice.cancel}
        aria-label="Cancel recording"
        title="Cancel"
        className="shrink-0 w-10 h-10 inline-flex items-center justify-center rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 active:bg-gray-100"
      >
        <X className="w-4 h-4" strokeWidth={2} />
      </button>
      <div className="flex-1 min-w-0 flex items-center gap-2 text-sm text-gray-700">
        {state === 'requesting' && (
          <>
            <Loader2 className="w-4 h-4 shrink-0 animate-spin text-gray-500" strokeWidth={2} />
            <span className="truncate">Waiting for microphone…</span>
          </>
        )}
        {recording && (
          <>
            <span className="w-2.5 h-2.5 shrink-0 rounded-full bg-red-500 animate-pulse" />
            <span className="truncate">
              Recording {formatElapsed(elapsed)} / {formatElapsed(MAX_RECORDING_SECONDS)}
            </span>
          </>
        )}
        {(state === 'stopping' || state === 'transcribing') && (
          <>
            <Loader2 className="w-4 h-4 shrink-0 animate-spin text-gray-500" strokeWidth={2} />
            <span className="truncate">Transcribing…</span>
          </>
        )}
      </div>
      {recording && (
        <button
          type="button"
          onClick={voice.stop}
          autoFocus
          aria-label="Stop recording"
          title="Stop"
          className="shrink-0 w-10 h-10 inline-flex items-center justify-center rounded-lg bg-red-600 text-white hover:bg-red-700 active:bg-red-800"
        >
          <Square className="w-4 h-4" fill="currentColor" strokeWidth={2} />
        </button>
      )}
    </div>
  )
}

const ChatInput = forwardRef(function ChatInput({ value, onChange, onSubmit, disabled, placeholder, voice, announcement }, ref) {
  const voiceActive = Boolean(voice) && voice.state !== 'idle'

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      if (!disabled && value.trim()) onSubmit()
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (!disabled && !voiceActive && value.trim()) onSubmit()
      }}
      className="flex items-end gap-2 border-t border-gray-200 bg-white p-3"
    >
      <div role="status" aria-live="polite" className="sr-only">
        {announcement}
      </div>
      {voiceActive ? (
        <VoiceBar voice={voice} />
      ) : (
        <>
          {voice?.supported && (
            <button
              type="button"
              onClick={voice.start}
              disabled={disabled}
              aria-label="Record voice message"
              title="Record voice message"
              className="shrink-0 w-10 h-10 inline-flex items-center justify-center rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 active:bg-gray-100 disabled:opacity-50 disabled:hover:bg-transparent"
            >
              <Mic className="w-4 h-4" strokeWidth={2} />
            </button>
          )}
          <textarea
            ref={ref}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            rows={1}
            maxLength={MAX_LENGTH}
            placeholder={placeholder}
            aria-label="Message"
            className="flex-1 resize-none field-sizing-content max-h-32 rounded-lg border border-gray-300 px-3 py-2 text-base md:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:text-gray-400"
          />
          <button
            type="submit"
            disabled={disabled || !value.trim()}
            aria-label="Send message"
            className="shrink-0 w-10 h-10 inline-flex items-center justify-center rounded-lg bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50"
          >
            <SendHorizontal className="w-4 h-4" strokeWidth={2} />
          </button>
        </>
      )}
    </form>
  )
})

export default ChatInput
