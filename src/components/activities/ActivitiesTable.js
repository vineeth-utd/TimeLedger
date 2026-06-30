import { Pencil, Trash2 } from 'lucide-react'
import EmptyState from '@/components/EmptyState'
import { formatTime, formatMinutes } from '@/lib/formatters'

function formatDate(isoString) {
  const d = new Date(isoString)
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  })
}

export default function ActivitiesTable({ activities, onEdit, onDelete }) {
  if (activities.length === 0) {
    return (
      <div className="bg-white border border-zinc-200 rounded-lg shadow-sm">
        <EmptyState message="No activities found for this date range." />
      </div>
    )
  }

  return (
    <div className="bg-white border border-zinc-200 rounded-lg shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 border-b border-zinc-100">
            <tr className="text-left text-xs text-zinc-500 uppercase tracking-wide">
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
              <tr key={activity.id} className="border-b border-zinc-50 hover:bg-zinc-50 transition-colors">
                <td className="px-5 py-3.5 text-zinc-500 whitespace-nowrap">
                  {formatDate(activity.activityDate)}
                </td>
                <td className="px-5 py-3.5 text-zinc-800 font-medium max-w-[180px] truncate">
                  {activity.title}
                </td>
                <td className="px-5 py-3.5 hidden sm:table-cell">
                  <span className="text-zinc-700">{activity.subCategory?.name}</span>
                  <span className="block text-xs text-zinc-400">{activity.subCategory?.mainCategory?.name}</span>
                </td>
                <td className="px-5 py-3.5 text-zinc-500 whitespace-nowrap hidden sm:table-cell">
                  {formatTime(activity.startTime)} – {formatTime(activity.endTime)}
                </td>
                <td className="px-5 py-3.5 text-zinc-700 whitespace-nowrap">
                  {formatMinutes(activity.durationMinutes)}
                </td>
                <td className="px-5 py-3.5 hidden lg:table-cell max-w-[200px] truncate">
                  {activity.notes
                    ? <span className="text-zinc-600 italic">{activity.notes}</span>
                    : <span className="text-zinc-400">—</span>
                  }
                </td>
                <td className="px-5 py-3.5 text-right whitespace-nowrap">
                  <div className="inline-flex items-center gap-1">
                    <button
                      onClick={() => onEdit(activity)}
                      aria-label="Edit activity"
                      className="p-1.5 rounded text-zinc-400 hover:text-blue-600 hover:bg-zinc-100 transition-colors"
                    >
                      <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                    <button
                      onClick={() => onDelete(activity)}
                      aria-label="Delete activity"
                      className="p-1.5 rounded text-zinc-400 hover:text-red-500 hover:bg-zinc-100 transition-colors"
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
