'use client'

import { forwardRef } from 'react'
import { SendHorizontal } from 'lucide-react'

const MAX_LENGTH = 4000

const ChatInput = forwardRef(function ChatInput({ value, onChange, onSubmit, disabled, placeholder }, ref) {
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
        if (!disabled && value.trim()) onSubmit()
      }}
      className="flex items-end gap-2 border-t border-gray-200 bg-white p-3"
    >
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
    </form>
  )
})

export default ChatInput
