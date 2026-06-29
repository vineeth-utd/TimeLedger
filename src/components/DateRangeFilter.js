'use client'

import { useState, useEffect } from 'react'
import { getWeekStartMonday } from '@/lib/formatters'

const PRESETS = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'week', label: 'This Week' },
  { key: 'prev-week', label: 'Last Week' },
  { key: 'month', label: 'This Month' },
  { key: 'custom', label: 'Custom' },
]

function computeDates(preset) {
  const todayStr = new Date().toISOString().substring(0, 10)
  const today = new Date(todayStr + 'T00:00:00.000Z')

  if (preset === 'today') return { startDate: todayStr, endDate: todayStr }

  if (preset === 'yesterday') {
    const y = new Date(today)
    y.setUTCDate(y.getUTCDate() - 1)
    const s = y.toISOString().substring(0, 10)
    return { startDate: s, endDate: s }
  }

  if (preset === 'week') {
    const start = getWeekStartMonday(today)
    const end = new Date(start + 'T00:00:00.000Z')
    end.setUTCDate(end.getUTCDate() + 6)
    return { startDate: start, endDate: end.toISOString().substring(0, 10) }
  }

  if (preset === 'prev-week') {
    const thisMonday = new Date(getWeekStartMonday(today) + 'T00:00:00.000Z')
    const prevMonday = new Date(thisMonday)
    prevMonday.setUTCDate(prevMonday.getUTCDate() - 7)
    const prevSunday = new Date(prevMonday)
    prevSunday.setUTCDate(prevSunday.getUTCDate() + 6)
    return {
      startDate: prevMonday.toISOString().substring(0, 10),
      endDate: prevSunday.toISOString().substring(0, 10),
    }
  }

  if (preset === 'month') {
    const y = today.getUTCFullYear()
    const m = today.getUTCMonth()
    const first = new Date(Date.UTC(y, m, 1)).toISOString().substring(0, 10)
    const last = new Date(Date.UTC(y, m + 1, 0)).toISOString().substring(0, 10)
    return { startDate: first, endDate: last }
  }

  return null
}

export default function DateRangeFilter({ onChange }) {
  const [preset, setPreset] = useState('week')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (preset === 'custom') {
      if (customStart && customEnd && customEnd >= customStart) {
        onChange({ startDate: customStart, endDate: customEnd })
      }
      return
    }
    const dates = computeDates(preset)
    if (dates) onChange(dates)
  }, [preset, customStart, customEnd])

  return (
    <div className="bg-white border border-zinc-200 rounded-lg px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
      <div className="flex flex-wrap gap-1.5">
        {PRESETS.map((p) => (
          <button
            key={p.key}
            onClick={() => setPreset(p.key)}
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
            className="border border-zinc-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <span className="text-xs text-zinc-400">to</span>
          <input
            type="date"
            value={customEnd}
            onChange={(e) => setCustomEnd(e.target.value)}
            className="border border-zinc-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      )}
    </div>
  )
}
