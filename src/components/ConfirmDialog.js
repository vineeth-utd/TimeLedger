'use client'

import { useEffect } from 'react'
import { X } from 'lucide-react'

export default function ConfirmDialog({
  isOpen,
  title,
  message,
  error,
  onConfirm,
  onCancel,
  confirmLabel = 'Delete',
  confirmVariant = 'danger',
}) {
  useEffect(() => {
    if (!isOpen) return
    function handleKeyDown(e) {
      if (e.key === 'Escape') onCancel()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onCancel])

  if (!isOpen) return null

  const confirmClass =
    confirmVariant === 'danger'
      ? 'px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 active:bg-red-800'
      : 'px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 active:bg-blue-800'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        className="bg-surface rounded-xl shadow-xl w-full max-w-sm p-6"
      >
        <div className="flex items-start justify-between mb-1">
          <h2 id="confirm-dialog-title" className="text-base font-semibold text-foreground">{title}</h2>
          <button
            onClick={onCancel}
            aria-label="Close"
            className="text-foreground-subtle hover:text-foreground-secondary ml-4"
          >
            <X className="w-4 h-4" strokeWidth={2} />
          </button>
        </div>
        <p className="text-sm text-foreground-secondary mt-2">{message}</p>
        {error && <p className="text-sm text-red-600 dark:text-red-400 mt-2">{error}</p>}
        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-foreground-secondary bg-surface border border-border-strong rounded-md hover:bg-surface-subtle active:bg-surface-muted"
          >
            Cancel
          </button>
          <button onClick={onConfirm} className={confirmClass}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
