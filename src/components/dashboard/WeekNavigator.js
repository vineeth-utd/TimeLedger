'use client'

import { addDays, formatDateOnly, getWeekStartMonday } from '@/lib/formatters'

function formatWeekLabel(weekStartDate) {
  const weekEndDate = addDays(weekStartDate, 6)
  const fmt = (date) => formatDateOnly(date, { month: 'short', day: 'numeric' })
  return `${fmt(weekStartDate)} – ${fmt(weekEndDate)}, ${formatDateOnly(weekEndDate, { year: 'numeric' })}`
}

export default function WeekNavigator({ weekStartDate, onPrev, onNext, onToday, onGoTo }) {
  return (
    <div className="flex items-center gap-3 flex-wrap">
      {/* Grouped Prev / week label / Next */}
      <div className="flex items-center border border-gray-200 rounded-md bg-white divide-x divide-gray-200 shadow-sm">
        <button
          onClick={onPrev}
          className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50 active:bg-gray-100 rounded-l-md transition-colors"
        >
          ← Prev
        </button>
        <span className="px-5 py-1.5 text-sm font-medium text-gray-800 min-w-[196px] text-center select-none">
          {formatWeekLabel(weekStartDate)}
        </span>
        <button
          onClick={onNext}
          className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50 active:bg-gray-100 rounded-r-md transition-colors"
        >
          Next →
        </button>
      </div>

      {/* Today */}
      <button
        onClick={onToday}
        className="px-3 py-1.5 text-sm font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 active:bg-blue-200 transition-colors"
      >
        Today
      </button>

      {/* Jump to week */}
      {onGoTo && (
        <div className="flex items-center gap-2 ml-1">
          <span className="text-xs text-gray-500 whitespace-nowrap">Week containing:</span>
          <input
            type="date"
            aria-label="Jump to week containing date"
            className="text-sm border border-gray-200 rounded-md px-2 py-1 text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
            onChange={(e) => {
              if (e.target.value) {
                onGoTo(getWeekStartMonday(e.target.value))
              }
            }}
          />
        </div>
      )}
    </div>
  )
}
