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
              <th className="px-6 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Title</th>
              <th className="px-4 py-3 font-medium hidden sm:table-cell">Category</th>
              <th className="px-4 py-3 font-medium hidden sm:table-cell">Time</th>
              <th className="px-4 py-3 font-medium">Duration</th>
              <th className="px-4 py-3 font-medium hidden lg:table-cell">Notes</th>
              <th className="px-6 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {activities.map((activity) => (
              <tr key={activity.id} className="border-b border-zinc-50 hover:bg-zinc-50/50">
                <td className="px-6 py-3 text-zinc-500 whitespace-nowrap">
                  {formatDate(activity.activityDate)}
                </td>
                <td className="px-4 py-3 text-zinc-800 font-medium max-w-[180px] truncate">
                  {activity.title}
                </td>
                <td className="px-4 py-3 hidden sm:table-cell">
                  <span className="text-zinc-700">{activity.subCategory?.name}</span>
                  <span className="block text-xs text-zinc-400">{activity.subCategory?.mainCategory?.name}</span>
                </td>
                <td className="px-4 py-3 text-zinc-500 whitespace-nowrap hidden sm:table-cell">
                  {formatTime(activity.startTime)} – {formatTime(activity.endTime)}
                </td>
                <td className="px-4 py-3 text-zinc-700 whitespace-nowrap">
                  {formatMinutes(activity.durationMinutes)}
                </td>
                <td className="px-4 py-3 text-zinc-400 hidden lg:table-cell max-w-[200px] truncate">
                  {activity.notes || '—'}
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
    </div>
  )
}
