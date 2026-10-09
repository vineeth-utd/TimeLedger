'use client'

import { useEffect, useState } from 'react'
import { Check, ShieldCheck, X } from 'lucide-react'

// Re-renders once when the confirmation passes its expiresAt (also correct on restore).
function useExpired(expiresAt) {
  const [now, setNow] = useState(() => Date.now())
  const expiry = new Date(expiresAt).getTime()
  useEffect(() => {
    const remaining = expiry - Date.now()
    if (remaining <= 0) return
    const timer = setTimeout(() => setNow(Date.now()), Math.min(remaining + 50, 2 ** 31 - 1))
    return () => clearTimeout(timer)
  }, [expiry])
  return now > expiry
}

// Shows only the server-built summaries; approve/reject send just the actionId and decision.
export default function ConfirmationCard({ pendingAction, busy, onDecision }) {
  const expired = useExpired(pendingAction.expiresAt)
  const many = pendingAction.actions.length > 1

  return (
    <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-3.5">
      <div className="flex items-center gap-2 text-sm font-medium text-blue-800">
        <ShieldCheck className="w-4 h-4" strokeWidth={2} />
        {expired ? 'This request expired' : many ? 'Please confirm these actions' : 'Please confirm this action'}
      </div>
      <ul className="mt-2 space-y-1.5">
        {pendingAction.actions.map((action, index) => (
          <li key={index} className="text-sm text-gray-800">
            {action.display.summary}
          </li>
        ))}
      </ul>
      <div className="mt-3 flex gap-2">
        {expired ? (
          <button
            type="button"
            onClick={() => onDecision('reject')}
            disabled={busy}
            className="flex-1 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 active:bg-gray-100 disabled:opacity-50"
          >
            Dismiss
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={() => onDecision('approve')}
              disabled={busy}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50"
            >
              <Check className="w-4 h-4" strokeWidth={2} />
              Approve
            </button>
            <button
              type="button"
              onClick={() => onDecision('reject')}
              disabled={busy}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 active:bg-gray-100 disabled:opacity-50"
            >
              <X className="w-4 h-4" strokeWidth={2} />
              Reject
            </button>
          </>
        )}
      </div>
    </div>
  )
}
