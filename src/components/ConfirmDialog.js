'use client'

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
  if (!isOpen) return null

  const confirmClass =
    confirmVariant === 'danger'
      ? 'px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 active:bg-red-800'
      : 'px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 active:bg-blue-800'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
        <div className="flex items-start justify-between mb-1">
          <h2 className="text-base font-semibold text-gray-900">{title}</h2>
          <button
            onClick={onCancel}
            aria-label="Close"
            className="text-gray-400 hover:text-gray-600 ml-4"
          >
            <X className="w-4 h-4" strokeWidth={2} />
          </button>
        </div>
        <p className="text-sm text-gray-600 mt-2">{message}</p>
        {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 active:bg-gray-100"
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
