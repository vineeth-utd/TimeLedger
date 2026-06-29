'use client'

import EmptyState from '@/components/EmptyState'
import { formatTime, formatMinutes } from '@/lib/formatters'

export default function TodayTimeline({ activities, onEdit, onDelete }) {
  return (
    <section className="bg-white border border-zinc-200 rounded-lg shadow-sm">
      <div className="px-6 py-4 border-b border-zinc-100">
        <h2 className="text-sm font-semibold text-zinc-900">Today&apos;s Timeline</h2>
        <p className="text-xs text-zinc-500 mt-0.5">Activities logged today, in order</p>
      </div>

      {activities.length === 0 ? (
        <EmptyState message="No activities logged today. Start by adding one." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 border-b border-zinc-100">
              <tr className="text-left text-xs text-zinc-500 uppercase tracking-wide">
                <th className="px-6 py-3 font-medium">Time</th>
                <th className="px-4 py-3 font-medium">Title</th>
                <th className="px-4 py-3 font-medium hidden sm:table-cell">Sub Category</th>
                <th className="px-4 py-3 font-medium hidden md:table-cell">Main Category</th>
                <th className="px-4 py-3 font-medium text-right">Duration</th>
                <th className="px-6 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {activities.map((activity) => (
                <tr key={activity.id} className="border-b border-zinc-50 hover:bg-zinc-50/50">
                  <td className="px-6 py-3 text-zinc-500 whitespace-nowrap">
                    {formatTime(activity.startTime)} – {formatTime(activity.endTime)}
                  </td>
                  <td className="px-4 py-3 text-zinc-800 font-medium max-w-[200px] truncate">
                    {activity.title}
                  </td>
                  <td className="px-4 py-3 text-zinc-600 hidden sm:table-cell">
                    {activity.subCategory?.name}
                  </td>
                  <td className="px-4 py-3 text-zinc-400 hidden md:table-cell">
                    {activity.subCategory?.mainCategory?.name}
                  </td>
                  <td className="px-4 py-3 text-zinc-700 text-right whitespace-nowrap">
                    {formatMinutes(activity.durationMinutes)}
                  </td>
                  <td className="px-6 py-3 text-right whitespace-nowrap">
                    <button
                      onClick={() => onEdit(activity)}
                      className="text-xs text-blue-600 hover:underline font-medium mr-3"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => onDelete(activity)}
                      className="text-xs text-red-500 hover:underline font-medium"
                    >
                      Delete
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
