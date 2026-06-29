'use client'

import { useState, useEffect } from 'react'
import PageHeader from '@/components/PageHeader'
import SummaryCard from '@/components/SummaryCard'
import LoadingState from '@/components/LoadingState'
import ErrorBanner from '@/components/ErrorBanner'
import ActivityModal from '@/components/ActivityModal'
import ConfirmDialog from '@/components/ConfirmDialog'
import WeekNavigator from '@/components/dashboard/WeekNavigator'
import TodaySummary from '@/components/dashboard/TodaySummary'
import WeeklyProgress from '@/components/dashboard/WeeklyProgress'
import TodayTimeline from '@/components/dashboard/TodayTimeline'
import { getWeekStartMonday, formatMinutes } from '@/lib/formatters'

export default function DashboardPage() {
  const [weekStartDate, setWeekStartDate] = useState(() => getWeekStartMonday())
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [refreshKey, setRefreshKey] = useState(0)

  const [modalOpen, setModalOpen] = useState(false)
  const [editingActivity, setEditingActivity] = useState(null)
  const [deletingActivity, setDeletingActivity] = useState(null)
  const [deleteError, setDeleteError] = useState('')

  useEffect(() => {
    setLoading(true)
    setError(null)
    fetch(`/api/dashboard/weekly?weekStartDate=${weekStartDate}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setData(json.data)
        else setError(json.message ?? 'Failed to load dashboard')
      })
      .catch(() => setError('Network error. Please try again.'))
      .finally(() => setLoading(false))
  }, [weekStartDate, refreshKey])

  function refresh() {
    setRefreshKey((k) => k + 1)
  }

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
    setRefreshKey((k) => k + 1)
  }

  async function handleConfirmDelete() {
    if (!deletingActivity) return
    setDeleteError('')
    try {
      const res = await fetch(`/api/activities/${deletingActivity.id}`, { method: 'DELETE' })
      const json = await res.json()
      if (json.success) {
        setDeletingActivity(null)
        refresh()
      } else {
        setDeleteError(json.message ?? 'Delete failed')
      }
    } catch {
      setDeleteError('Network error. Please try again.')
    }
  }

  const weeklyProgress = data?.weeklyProgress ?? []
  const weekSpent = weeklyProgress.reduce((s, r) => s + r.spentMinutes, 0)
  const weekTarget = weeklyProgress.reduce((s, r) => s + r.targetMinutes, 0)
  const weekRemaining = weeklyProgress.reduce((s, r) => s + r.remainingMinutes, 0)
  const weekProgress = weekTarget > 0 ? Math.round((weekSpent / weekTarget) * 100) : null

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <PageHeader title="Dashboard" subtitle="Your daily and weekly overview" />
        <button
          onClick={() => { setEditingActivity(null); setModalOpen(true) }}
          className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700"
        >
          + Add Activity
        </button>
      </div>

      <WeekNavigator
        weekStartDate={weekStartDate}
        onPrev={handlePrevWeek}
        onNext={handleNextWeek}
        onToday={handleToday}
      />

      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

      {loading ? (
        <LoadingState />
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <SummaryCard label="Week Spent" value={formatMinutes(weekSpent)} />
            <SummaryCard
              label="Week Target"
              value={weekTarget > 0 ? formatMinutes(weekTarget) : '—'}
            />
            <SummaryCard
              label="Remaining"
              value={weekTarget > 0 ? formatMinutes(weekRemaining) : '—'}
            />
            <SummaryCard
              label="Progress"
              value={weekProgress !== null ? `${Math.min(100, weekProgress)}%` : '—'}
            />
          </div>

          <TodaySummary
            byMainCategory={data?.todaySummary?.byMainCategory ?? []}
            bySubCategory={data?.todaySummary?.bySubCategory ?? []}
            today={data?.today}
          />

          <WeeklyProgress weeklyProgress={weeklyProgress} />

          <TodayTimeline
            activities={data?.todayTimeline ?? []}
            onEdit={(activity) => { setEditingActivity(activity); setModalOpen(true) }}
            onDelete={(activity) => { setDeleteError(''); setDeletingActivity(activity) }}
          />
        </>
      )}

      <ActivityModal
        isOpen={modalOpen}
        activity={editingActivity}
        onClose={() => setModalOpen(false)}
        onSuccess={() => { setModalOpen(false); refresh() }}
      />

      <ConfirmDialog
        isOpen={!!deletingActivity}
        title="Delete Activity"
        message={deletingActivity ? `Delete "${deletingActivity.title}"? This cannot be undone.` : ''}
        error={deleteError}
        onConfirm={handleConfirmDelete}
        onCancel={() => { setDeletingActivity(null); setDeleteError('') }}
      />
    </div>
  )
}
