'use client'

import { useState, useEffect } from 'react'
import WeekNavigator from '@/components/dashboard/WeekNavigator'
import LoadingState from '@/components/LoadingState'
import ErrorBanner from '@/components/ErrorBanner'
import { getWeekStartMonday, formatMinutes } from '@/lib/formatters'

export default function WeeklyTargetsSection() {
  const [weekStartDate, setWeekStartDate] = useState(() => getWeekStartMonday())
  const [mainCategories, setMainCategories] = useState([])
  const [targets, setTargets] = useState([])
  const [inputs, setInputs] = useState({})
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [saveError, setSaveError] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    fetch('/api/main-categories?isActive=true')
      .then((r) => r.json())
      .then((json) => { if (json.success) setMainCategories(json.data) })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!weekStartDate) return
    setLoading(true)
    setError(null)
    setSaveError('')
    setSaved(false)
    fetch(`/api/weekly-targets?weekStartDate=${weekStartDate}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.success) {
          setTargets(json.data)
          const next = {}
          for (const t of json.data) {
            next[t.mainCategoryId] = String(t.targetMinutes)
          }
          setInputs(next)
        } else {
          setError(json.message ?? 'Failed to load targets')
        }
      })
      .catch(() => setError('Network error. Please try again.'))
      .finally(() => setLoading(false))
  }, [weekStartDate])

  function handlePrevWeek() {
    setWeekStartDate((d) => {
      const dt = new Date(d + 'T00:00:00.000Z')
      dt.setUTCDate(dt.getUTCDate() - 7)
      return dt.toISOString().substring(0, 10)
    })
  }

  function handleNextWeek() {
    setWeekStartDate((d) => {
      const dt = new Date(d + 'T00:00:00.000Z')
      dt.setUTCDate(dt.getUTCDate() + 7)
      return dt.toISOString().substring(0, 10)
    })
  }

  function handleToday() {
    setWeekStartDate(getWeekStartMonday())
  }

  function handleInput(mcId, value) {
    setInputs((prev) => ({ ...prev, [mcId]: value }))
    setSaved(false)
  }

  function getTargetForCategory(mcId) {
    return targets.find((t) => t.mainCategoryId === mcId) ?? null
  }

  function isDirty() {
    return mainCategories.some((mc) => {
      const existing = getTargetForCategory(mc.id)
      const inputVal = inputs[mc.id] ?? ''
      const existingStr = existing ? String(existing.targetMinutes) : ''
      return inputVal !== existingStr
    })
  }

  async function handleSave() {
    setSaving(true)
    setSaveError('')
    setSaved(false)

    const ops = []

    for (const mc of mainCategories) {
      const existing = getTargetForCategory(mc.id)
      const rawVal = inputs[mc.id] ?? ''
      const numVal = rawVal === '' ? 0 : Number(rawVal)
      const existingVal = existing ? existing.targetMinutes : null

      if (numVal === existingVal) continue

      if (numVal > 0 && existing) {
        ops.push(
          fetch(`/api/weekly-targets/${existing.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ targetMinutes: numVal }),
          }).then((r) => r.json())
        )
      } else if (numVal > 0 && !existing) {
        ops.push(
          fetch('/api/weekly-targets', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ weekStartDate, mainCategoryId: mc.id, targetMinutes: numVal }),
          }).then((r) => r.json())
        )
      } else if ((numVal === 0 || rawVal === '') && existing) {
        ops.push(
          fetch(`/api/weekly-targets/${existing.id}`, { method: 'DELETE' }).then((r) => r.json())
        )
      }
    }

    try {
      const results = await Promise.all(ops)
      const failed = results.find((r) => !r.success)
      if (failed) {
        setSaveError(failed.message ?? 'One or more saves failed')
      } else {
        setSaved(true)
        // Re-fetch to sync state
        const res = await fetch(`/api/weekly-targets?weekStartDate=${weekStartDate}`)
        const json = await res.json()
        if (json.success) {
          setTargets(json.data)
          const next = {}
          for (const t of json.data) {
            next[t.mainCategoryId] = String(t.targetMinutes)
          }
          setInputs(next)
        }
      }
    } catch {
      setSaveError('Network error. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const dirty = isDirty()

  return (
    <div className="border-t border-zinc-200 pt-6 space-y-4">
      <h2 className="text-base font-semibold text-zinc-900">Weekly Targets</h2>

      <WeekNavigator
        weekStartDate={weekStartDate}
        onPrev={handlePrevWeek}
        onNext={handleNextWeek}
        onToday={handleToday}
      />

      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}
      {saveError && <ErrorBanner message={saveError} onDismiss={() => setSaveError('')} />}

      {loading ? (
        <LoadingState />
      ) : mainCategories.length === 0 ? (
        <p className="text-sm text-zinc-500">No active categories. Add main categories first.</p>
      ) : (
        <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 border-b border-zinc-100">
              <tr className="text-left text-xs text-zinc-500 uppercase tracking-wide">
                <th className="px-5 py-3 font-medium">Category</th>
                <th className="px-5 py-3 font-medium">Target (minutes)</th>
                <th className="px-5 py-3 font-medium hidden sm:table-cell text-zinc-400">Formatted</th>
              </tr>
            </thead>
            <tbody>
              {mainCategories.map((mc) => {
                const val = inputs[mc.id] ?? ''
                const numVal = val === '' ? 0 : Number(val)
                return (
                  <tr key={mc.id} className="border-b border-zinc-50 last:border-0">
                    <td className="px-5 py-3 text-zinc-800 font-medium">{mc.name}</td>
                    <td className="px-5 py-3">
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={val}
                        onChange={(e) => handleInput(mc.id, e.target.value)}
                        placeholder="0"
                        className="w-24 border border-zinc-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </td>
                    <td className="px-5 py-3 text-zinc-400 hidden sm:table-cell text-xs">
                      {numVal > 0 ? formatMinutes(numVal) : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          <div className="px-5 py-3 border-t border-zinc-100 flex items-center gap-3">
            <button
              onClick={handleSave}
              disabled={saving || !dirty}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
            {saved && !dirty && (
              <span className="text-sm text-green-600 font-medium">Saved</span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
