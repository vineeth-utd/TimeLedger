'use client'

import { useEffect, useRef, useState } from 'react'
import { Check, Copy, Pencil, Trash2 } from 'lucide-react'
import EmptyState from '@/components/EmptyState'
import { formatDateOnly, formatTime, formatMinutes } from '@/lib/formatters'

function formatDate(isoString) {
  return formatDateOnly(isoString, {
    month: 'short',
    day: 'numeric',
  })
}

export default function ActivitiesTable({ activities, onEdit, onDelete }) {
  const [copiedActivityId, setCopiedActivityId] = useState(null)
  const copyTimeoutRef = useRef(null)

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current)
    }
  }, [])

  async function handleCopyTitle(e, activity) {
    e.stopPropagation()
    try {
      await navigator.clipboard.writeText(activity.title)
      setCopiedActivityId(activity.id)
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current)
      copyTimeoutRef.current = setTimeout(() => {
        setCopiedActivityId((current) => current === activity.id ? null : current)
      }, 1500)
    } catch {
      // Clipboard access can fail if the browser blocks it; no toast needed here.
    }
  }

  if (activities.length === 0) {
    return (
      <div className="bg-surface border border-border rounded-lg shadow-sm">
        <EmptyState message="No activities found for this date range." />
      </div>
    )
  }

  return (
    <div className="bg-surface border border-border rounded-lg shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-surface-subtle border-b border-border-subtle">
            <tr className="text-left text-xs text-foreground-muted uppercase tracking-wide">
              <th scope="col" className="px-5 py-3 font-medium">Date</th>
              <th scope="col" className="px-5 py-3 font-medium">Title</th>
              <th scope="col" className="px-5 py-3 font-medium hidden sm:table-cell">Category</th>
              <th scope="col" className="px-5 py-3 font-medium hidden sm:table-cell">Time</th>
              <th scope="col" className="px-5 py-3 font-medium">Duration</th>
              <th scope="col" className="px-5 py-3 font-medium hidden lg:table-cell">Notes</th>
              <th scope="col" className="px-5 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {activities.map((activity) => (
              <tr key={activity.id} className="border-b border-border-subtle hover:bg-surface-subtle transition-colors">
                <td className="px-5 py-3.5 text-foreground-muted whitespace-nowrap">
                  {formatDate(activity.activityDate)}
                </td>
                <td
                  className="px-5 py-3.5 text-foreground font-medium max-w-[180px]"
                  title={activity.title}
                >
                  <div className="flex items-center gap-1 min-w-0">
                    <span className="truncate min-w-0">{activity.title}</span>
                    <button
                      type="button"
                      onClick={(e) => handleCopyTitle(e, activity)}
                      aria-label={`Copy title: ${activity.title}`}
                      title="Copy title"
                      className="p-1 rounded text-foreground-subtle hover:text-foreground-secondary hover:bg-surface-muted transition-colors shrink-0"
                    >
                      {copiedActivityId === activity.id
                        ? <Check className="w-3.5 h-3.5 text-green-600 dark:text-green-400" aria-hidden="true" />
                        : <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                      }
                    </button>
                  </div>
                </td>
                <td className="px-5 py-3.5 hidden sm:table-cell">
                  <span className="text-foreground-secondary">{activity.subCategory?.name}</span>
                  <span className="block text-xs text-foreground-subtle">{activity.subCategory?.mainCategory?.name}</span>
                </td>
                <td className="px-5 py-3.5 text-foreground-muted whitespace-nowrap hidden sm:table-cell">
                  {formatTime(activity.startTime)} – {formatTime(activity.endTime)}
                </td>
                <td className="px-5 py-3.5 text-foreground-secondary whitespace-nowrap">
                  {formatMinutes(activity.durationMinutes)}
                </td>
                <td
                  className="px-5 py-3.5 hidden lg:table-cell max-w-[200px] truncate"
                  title={activity.notes || undefined}
                >
                  {activity.notes
                    ? <span className="text-foreground-secondary italic">{activity.notes}</span>
                    : <span className="text-foreground-subtle">—</span>
                  }
                </td>
                <td className="px-5 py-3.5 text-right whitespace-nowrap">
                  <div className="inline-flex items-center gap-1">
                    <button
                      onClick={() => onEdit(activity)}
                      aria-label="Edit activity"
                      className="p-1.5 rounded text-foreground-subtle hover:text-blue-600 dark:hover:text-blue-400 hover:bg-surface-muted transition-colors"
                    >
                      <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                    <button
                      onClick={() => onDelete(activity)}
                      aria-label="Delete activity"
                      className="p-1.5 rounded text-foreground-subtle hover:text-red-500 hover:bg-surface-muted transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
