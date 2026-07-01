'use client'

import { useState, useEffect } from 'react'
import { addDays, getLocalMonthRange, getLocalToday, getWeekStartMonday } from '@/lib/formatters'

const PRESETS = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'week', label: 'This Week' },
  { key: 'prev-week', label: 'Last Week' },
  { key: 'month', label: 'This Month' },
  { key: 'custom', label: 'Custom' },
]

function computeDates(preset) {
  const today = getLocalToday()

  if (preset === 'today') return { startDate: today, endDate: today }

  if (preset === 'yesterday') {
    const yesterday = addDays(today, -1)
    return { startDate: yesterday, endDate: yesterday }
  }

  if (preset === 'week') {
    const start = getWeekStartMonday(today)
    return { startDate: start, endDate: addDays(start, 6) }
  }

  if (preset === 'prev-week') {
    const prevMonday = addDays(getWeekStartMonday(today), -7)
    return {
      startDate: prevMonday,
      endDate: addDays(prevMonday, 6),
    }
  }

  if (preset === 'month') {
    return getLocalMonthRange(today)
  }

  return null
}

export default function DateRangeFilter({ onChange }) {
  const [preset, setPreset] = useState('week')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')

  useEffect(() => {
    if (preset === 'custom') {
      if (customStart && customEnd && customEnd >= customStart) {
        onChange({ startDate: customStart, endDate: customEnd })
      }
      return
    }
    const dates = computeDates(preset)
    if (dates) onChange(dates)
  }, [preset, customStart, customEnd, onChange])

  return (
    <div className="bg-white border border-zinc-200 rounded-lg px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
      <div className="flex flex-wrap gap-1.5">
        {PRESETS.map((p) => (
          <button
            key={p.key}
            onClick={() => setPreset(p.key)}
            aria-pressed={preset === p.key}
            className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
              preset === p.key
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-zinc-600 border-zinc-300 hover:border-zinc-400'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {preset === 'custom' && (
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={customStart}
            onChange={(e) => setCustomStart(e.target.value)}
            aria-label="Start date"
            className="border border-zinc-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <span className="text-xs text-zinc-400" aria-hidden="true">to</span>
          <input
            type="date"
            value={customEnd}
            onChange={(e) => setCustomEnd(e.target.value)}
            aria-label="End date"
            className="border border-zinc-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      )}
    </div>
  )
}
