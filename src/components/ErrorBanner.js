'use client'

import { AlertCircle, X } from 'lucide-react'

export default function ErrorBanner({ message, onDismiss }) {
  return (
    <div className="flex items-start gap-3 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" strokeWidth={2} />
      <span className="flex-1">{message}</span>
      {onDismiss && (
        <button
          onClick={onDismiss}
          aria-label="Dismiss"
          className="shrink-0 text-red-400 hover:text-red-600"
        >
          <X className="w-4 h-4" strokeWidth={2} />
        </button>
      )}
    </div>
  )
}
