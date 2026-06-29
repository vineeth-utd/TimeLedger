'use client'

import { useState, useEffect } from 'react'
import PageHeader from '@/components/PageHeader'
import LoadingState from '@/components/LoadingState'
import ErrorBanner from '@/components/ErrorBanner'
import ActivityModal from '@/components/ActivityModal'
import ConfirmDialog from '@/components/ConfirmDialog'
import DateRangeFilter from '@/components/DateRangeFilter'
import ActivitiesTable from '@/components/activities/ActivitiesTable'

export default function ActivitiesPage() {
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [mainCategoryId, setMainCategoryId] = useState('')
  const [subCategoryId, setSubCategoryId] = useState('')

  const [activities, setActivities] = useState([])
  const [mainCategories, setMainCategories] = useState([])
  const [subCategories, setSubCategories] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [refreshKey, setRefreshKey] = useState(0)

  const [modalOpen, setModalOpen] = useState(false)
  const [editingActivity, setEditingActivity] = useState(null)
  const [deletingActivity, setDeletingActivity] = useState(null)
  const [deleteError, setDeleteError] = useState('')

  // Load category lists once on mount for filter dropdowns
  useEffect(() => {
    Promise.all([
      fetch('/api/main-categories').then((r) => r.json()),
      fetch('/api/sub-categories').then((r) => r.json()),
    ])
      .then(([mcRes, scRes]) => {
        if (mcRes.success) setMainCategories(mcRes.data)
        if (scRes.success) setSubCategories(scRes.data)
      })
      .catch(() => {})
  }, [])

  // Fetch activities whenever filters or refreshKey change
  useEffect(() => {
    if (!startDate || !endDate) return
    setLoading(true)
    setError(null)
    const params = new URLSearchParams({ startDate, endDate })
    if (mainCategoryId) params.set('mainCategoryId', mainCategoryId)
    if (subCategoryId) params.set('subCategoryId', subCategoryId)
    fetch(`/api/activities?${params}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setActivities(json.data)
        else setError(json.message ?? 'Failed to load activities')
      })
      .catch(() => setError('Network error. Please try again.'))
      .finally(() => setLoading(false))
  }, [startDate, endDate, mainCategoryId, subCategoryId, refreshKey])

  function refresh() {
    setRefreshKey((k) => k + 1)
  }

  function handleDateRangeChange({ startDate: s, endDate: e }) {
    setStartDate(s)
    setEndDate(e)
  }

  function handleMainCategoryChange(e) {
    setMainCategoryId(e.target.value)
    setSubCategoryId('')
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

  const filteredSubCategories = mainCategoryId
    ? subCategories.filter((sc) => String(sc.mainCategoryId) === mainCategoryId)
    : subCategories

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <PageHeader title="Activities" subtitle="Browse and manage your logged activities" />
        <button
          onClick={() => { setEditingActivity(null); setModalOpen(true) }}
          className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700"
        >
          + Add Activity
        </button>
      </div>

      <DateRangeFilter onChange={handleDateRangeChange} />

      <div className="flex flex-wrap gap-3">
        <select
          value={mainCategoryId}
          onChange={handleMainCategoryChange}
          className="border border-zinc-300 rounded px-3 py-1.5 text-sm text-zinc-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Main Categories</option>
          {mainCategories.map((mc) => (
            <option key={mc.id} value={mc.id}>{mc.name}</option>
          ))}
        </select>

        <select
          value={subCategoryId}
          onChange={(e) => setSubCategoryId(e.target.value)}
          className="border border-zinc-300 rounded px-3 py-1.5 text-sm text-zinc-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Sub Categories</option>
          {filteredSubCategories.map((sc) => (
            <option key={sc.id} value={sc.id}>{sc.name}</option>
          ))}
        </select>
      </div>

      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

      {loading ? (
        <LoadingState />
      ) : (
        <ActivitiesTable
          activities={activities}
          onEdit={(activity) => { setEditingActivity(activity); setModalOpen(true) }}
          onDelete={(activity) => { setDeleteError(''); setDeletingActivity(activity) }}
        />
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
