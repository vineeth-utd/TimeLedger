'use client'

import { useEffect, useRef, useState } from 'react'
import { Check, Copy, Pencil, Trash2 } from 'lucide-react'
import EmptyState from '@/components/EmptyState'
import { formatTime, formatMinutes } from '@/lib/formatters'

export default function TodayTimeline({ activities, onEdit, onDelete }) {
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

  return (
    <section className="bg-white border border-gray-200 rounded-xl shadow-sm">
      <div className="px-6 py-4 border-b border-gray-100">
        <h2 className="text-sm font-semibold text-gray-900">Today&apos;s Timeline</h2>
        <p className="text-xs text-gray-500 mt-0.5">Activities logged today, newest first</p>
      </div>

      {activities.length === 0 ? (
        <EmptyState message="No activities logged today. Start by adding one." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr className="text-left text-xs text-gray-400 uppercase tracking-wide">
                <th scope="col" className="px-3 py-2 sm:px-6 sm:py-3 font-medium">Time</th>
                <th scope="col" className="px-2 py-2 sm:px-4 sm:py-3 font-medium">Title</th>
                <th scope="col" className="px-4 py-3 font-medium hidden sm:table-cell">Sub Category</th>
                <th scope="col" className="px-4 py-3 font-medium hidden md:table-cell">Main Category</th>
                <th scope="col" className="px-2 py-2 sm:px-4 sm:py-3 font-medium text-right">Duration</th>
                <th scope="col" className="px-3 py-2 sm:px-6 sm:py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {activities.map((activity) => (
                <tr key={activity.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                  <td className="px-3 py-2 sm:px-6 sm:py-3 text-gray-500 whitespace-nowrap tabular-nums">
                    {formatTime(activity.startTime)} – {formatTime(activity.endTime)}
                  </td>
                  <td
                    className="px-2 py-2 sm:px-4 sm:py-3 text-gray-800 font-medium max-w-[100px] sm:max-w-[200px]"
                    title={activity.title}
                  >
                    <div className="flex items-center gap-1 min-w-0">
                      <span className="truncate min-w-0">{activity.title}</span>
                      <button
                        type="button"
                        onClick={(e) => handleCopyTitle(e, activity)}
                        aria-label={`Copy title: ${activity.title}`}
                        title="Copy title"
                        className="p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors shrink-0"
                      >
                        {copiedActivityId === activity.id
                          ? <Check className="w-3.5 h-3.5 text-green-600" aria-hidden="true" />
                          : <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                        }
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600 hidden sm:table-cell">
                    {activity.subCategory?.name}
                  </td>
                  <td className="px-4 py-3 text-gray-400 hidden md:table-cell">
                    {activity.subCategory?.mainCategory?.name}
                  </td>
                  <td className="px-2 py-2 sm:px-4 sm:py-3 text-gray-700 text-right whitespace-nowrap tabular-nums">
                    {formatMinutes(activity.durationMinutes)}
                  </td>
                  <td className="px-3 py-2 sm:px-6 sm:py-3 text-right whitespace-nowrap">
                    <button
                      onClick={() => onEdit(activity)}
                      aria-label="Edit activity"
                      className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                    >
                      <Pencil className="w-3.5 h-3.5" strokeWidth={2} />
                    </button>
                    <button
                      onClick={() => onDelete(activity)}
                      aria-label="Delete activity"
                      className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors ml-0.5"
                    >
                      <Trash2 className="w-3.5 h-3.5" strokeWidth={2} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
