'use client'

import { getWeekStartMonday } from '@/lib/formatters'

function formatWeekLabel(weekStartDate) {
  const start = new Date(weekStartDate + 'T00:00:00.000Z')
  const end = new Date(weekStartDate + 'T00:00:00.000Z')
  end.setUTCDate(end.getUTCDate() + 6)
  const fmt = (d) =>
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
  return `${fmt(start)} – ${fmt(end)}, ${end.getUTCFullYear()}`
}

export default function WeekNavigator({ weekStartDate, onPrev, onNext, onToday, onGoTo }) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <button
        onClick={onPrev}
        className="px-3 py-1.5 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-md hover:bg-gray-50 active:bg-gray-100"
      >
        ← Prev
      </button>
      <span className="text-sm font-medium text-gray-800 min-w-[180px] text-center">
        {formatWeekLabel(weekStartDate)}
      </span>
      <button
        onClick={onNext}
        className="px-3 py-1.5 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-md hover:bg-gray-50 active:bg-gray-100"
      >
        Next →
      </button>
      <button
        onClick={onToday}
        className="px-3 py-1.5 text-sm font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 active:bg-blue-200"
      >
        Today
      </button>
      {onGoTo && (
        <div className="flex items-center gap-1.5 ml-1">
          <span className="text-xs text-gray-400">Go to:</span>
          <input
            type="date"
            aria-label="Jump to week containing date"
            className="text-sm border border-gray-200 rounded-md px-2 py-1 text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            onChange={(e) => {
              if (e.target.value) {
                onGoTo(getWeekStartMonday(new Date(e.target.value + 'T00:00:00')))
              }
            }}
          />
        </div>
      )}
    </div>
  )
}
