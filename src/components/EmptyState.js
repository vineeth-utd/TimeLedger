import { FileText } from 'lucide-react'

export default function EmptyState({ message, actionLabel, onAction, icon: Icon = FileText, primaryAction = true }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-4">
        <Icon className="w-6 h-6 text-gray-400" strokeWidth={1.5} />
      </div>
      <p className="text-sm text-gray-500 max-w-xs">{message}</p>
      {actionLabel && onAction && (
        primaryAction ? (
          <button
            onClick={onAction}
            className="mt-4 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50"
          >
            {actionLabel}
          </button>
        ) : (
          <button
            onClick={onAction}
            className="mt-3 text-sm text-blue-600 hover:text-blue-700 font-medium hover:underline"
          >
            {actionLabel}
          </button>
        )
      )}
    </div>
  )
}
