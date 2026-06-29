'use client'

export default function ErrorBanner({ message, onDismiss }) {
  return (
    <div className="flex items-start justify-between gap-4 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
      <span>{message}</span>
      {onDismiss && (
        <button onClick={onDismiss} className="shrink-0 text-red-400 hover:text-red-600 font-medium">
          Dismiss
        </button>
      )}
    </div>
  )
}
