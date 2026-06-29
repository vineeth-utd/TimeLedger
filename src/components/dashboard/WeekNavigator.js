'use client'

function formatWeekLabel(weekStartDate) {
  const start = new Date(weekStartDate + 'T00:00:00.000Z')
  const end = new Date(weekStartDate + 'T00:00:00.000Z')
  end.setUTCDate(end.getUTCDate() + 6)
  const fmt = (d) =>
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
  return `${fmt(start)} – ${fmt(end)}, ${end.getUTCFullYear()}`
}

export default function WeekNavigator({ weekStartDate, onPrev, onNext, onToday }) {
  return (
    <div className="flex items-center gap-3 flex-wrap">
      <button
        onClick={onPrev}
        className="px-3 py-1.5 text-sm font-medium text-zinc-600 bg-white border border-zinc-200 rounded hover:bg-zinc-50"
      >
        ← Prev
      </button>
      <span className="text-sm font-medium text-zinc-800 min-w-[180px] text-center">
        {formatWeekLabel(weekStartDate)}
      </span>
      <button
        onClick={onNext}
        className="px-3 py-1.5 text-sm font-medium text-zinc-600 bg-white border border-zinc-200 rounded hover:bg-zinc-50"
      >
        Next →
      </button>
      <button
        onClick={onToday}
        className="px-3 py-1.5 text-sm font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded hover:bg-blue-100"
      >
        Today
      </button>
    </div>
  )
}
