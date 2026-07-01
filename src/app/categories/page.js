'use client'

import { useState, useEffect } from 'react'
import PageHeader from '@/components/PageHeader'
import LoadingState from '@/components/LoadingState'
import ErrorBanner from '@/components/ErrorBanner'
import EmptyState from '@/components/EmptyState'
import ConfirmDialog from '@/components/ConfirmDialog'
import CategoryModal from '@/components/categories/CategoryModal'
import MainCategorySection from '@/components/categories/MainCategorySection'
import WeeklyTargetsSection from '@/components/categories/WeeklyTargetsSection'

const STATUS_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'inactive', label: 'Inactive' },
]

export default function CategoriesPage() {
  const [mainCategories, setMainCategories] = useState([])
  const [subCategories, setSubCategories] = useState([])
  const [statusFilter, setStatusFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [refreshKey, setRefreshKey] = useState(0)

  const [modalOpen, setModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState('add-main')
  const [modalMainCategory, setModalMainCategory] = useState(null)
  const [modalSubCategory, setModalSubCategory] = useState(null)

  const [togglingId, setTogglingId] = useState(null)
  const [toggleError, setToggleError] = useState('')
  const [deletingCategory, setDeletingCategory] = useState(null)
  const [deleteError, setDeleteError] = useState('')

  useEffect(() => {
    setLoading(true)
    setError(null)
    setToggleError('')
    setDeleteError('')
    Promise.all([
      fetch('/api/main-categories').then((r) => r.json()),
      fetch('/api/sub-categories').then((r) => r.json()),
    ])
      .then(([mcRes, scRes]) => {
        if (mcRes.success) setMainCategories(mcRes.data)
        else setError(mcRes.message ?? 'Failed to load categories')
        if (scRes.success) setSubCategories(scRes.data)
      })
      .catch(() => setError('Network error. Please try again.'))
      .finally(() => setLoading(false))
  }, [refreshKey])

  function refresh() {
    setRefreshKey((k) => k + 1)
  }

  function openAddMain() {
    setModalMode('add-main')
    setModalMainCategory(null)
    setModalSubCategory(null)
    setModalOpen(true)
  }

  function openRenameMain(mc) {
    setModalMode('edit-main')
    setModalMainCategory(mc)
    setModalSubCategory(null)
    setModalOpen(true)
  }

  function openAddSub(mc) {
    setModalMode('add-sub')
    setModalMainCategory(mc)
    setModalSubCategory(null)
    setModalOpen(true)
  }

  function openRenameSub(mc, sc) {
    setModalMode('edit-sub')
    setModalMainCategory(mc)
    setModalSubCategory(sc)
    setModalOpen(true)
  }

  function openDeleteMain(mc) {
    setDeletingCategory({ type: 'main', category: mc })
    setDeleteError('')
  }

  function openDeleteSub(sc) {
    setDeletingCategory({ type: 'sub', category: sc })
    setDeleteError('')
  }

  async function handleToggleMain(mc) {
    const key = `main-${mc.id}`
    if (togglingId === key) return
    setTogglingId(key)
    setToggleError('')
    try {
      const res = await fetch(`/api/main-categories/${mc.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !mc.isActive }),
      })
      const json = await res.json()
      if (json.success) refresh()
      else setToggleError(json.message ?? 'Failed to update category')
    } catch {
      setToggleError('Network error. Please try again.')
    } finally {
      setTogglingId(null)
    }
  }

  async function handleToggleSub(sc) {
    const key = `sub-${sc.id}`
    if (togglingId === key) return
    setTogglingId(key)
    setToggleError('')
    try {
      const res = await fetch(`/api/sub-categories/${sc.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !sc.isActive }),
      })
      const json = await res.json()
      if (json.success) refresh()
      else setToggleError(json.message ?? 'Failed to update sub category')
    } catch {
      setToggleError('Network error. Please try again.')
    } finally {
      setTogglingId(null)
    }
  }

  async function handleConfirmDelete() {
    if (!deletingCategory) return
    setDeleteError('')

    const isMain = deletingCategory.type === 'main'
    const category = deletingCategory.category
    const url = isMain
      ? `/api/main-categories/${category.id}`
      : `/api/sub-categories/${category.id}`

    try {
      const res = await fetch(url, { method: 'DELETE' })
      const json = await res.json()
      if (json.success) {
        setDeletingCategory(null)
        refresh()
      } else {
        setDeleteError(json.message ?? 'Delete failed')
      }
    } catch {
      setDeleteError('Network error. Please try again.')
    }
  }

  const filteredMainCategories = mainCategories.filter((mc) => {
    if (statusFilter === 'active') return mc.isActive
    if (statusFilter === 'inactive') return !mc.isActive
    return true
  })

  const subsByMain = {}
  for (const sc of subCategories) {
    if (!subsByMain[sc.mainCategoryId]) subsByMain[sc.mainCategoryId] = []
    subsByMain[sc.mainCategoryId].push(sc)
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <PageHeader title="Categories" subtitle="Manage your main categories and sub categories" />
        <button
          onClick={openAddMain}
          className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700"
        >
          + Add Main Category
        </button>
      </div>

      <div className="flex gap-1.5">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setStatusFilter(f.key)}
            className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
              statusFilter === f.key
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-zinc-600 border-zinc-300 hover:border-zinc-400'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}
      {toggleError && <ErrorBanner message={toggleError} onDismiss={() => setToggleError('')} />}

      {loading ? (
        <LoadingState />
      ) : filteredMainCategories.length === 0 ? (
        <div className="bg-white border border-zinc-200 rounded-lg">
          <EmptyState
            message={
              statusFilter === 'all'
                ? 'No categories yet. Create your first main category to get started.'
                : `No ${statusFilter} categories found.`
            }
            actionLabel={statusFilter === 'all' ? 'Add Main Category' : undefined}
            onAction={statusFilter === 'all' ? openAddMain : undefined}
          />
        </div>
      ) : (
        <div className="space-y-3">
          {filteredMainCategories.map((mc) => (
            <MainCategorySection
              key={mc.id}
              mainCategory={mc}
              subCategories={subsByMain[mc.id] ?? []}
              statusFilter={statusFilter}
              onRenameMain={openRenameMain}
              onToggleMain={handleToggleMain}
              onDeleteMain={openDeleteMain}
              onAddSub={openAddSub}
              onRenameSub={openRenameSub}
              onToggleSub={handleToggleSub}
              onDeleteSub={openDeleteSub}
            />
          ))}
        </div>
      )}

      <WeeklyTargetsSection />

      <CategoryModal
        isOpen={modalOpen}
        mode={modalMode}
        mainCategory={modalMainCategory}
        subCategory={modalSubCategory}
        onClose={() => setModalOpen(false)}
        onSuccess={() => { setModalOpen(false); refresh() }}
      />

      <ConfirmDialog
        isOpen={!!deletingCategory}
        title={deletingCategory?.type === 'main' ? 'Delete Main Category' : 'Delete Sub Category'}
        message={
          deletingCategory
            ? `Delete "${deletingCategory.category.name}"? This cannot be undone.`
            : ''
        }
        error={deleteError}
        onConfirm={handleConfirmDelete}
        onCancel={() => { setDeletingCategory(null); setDeleteError('') }}
      />
    </div>
  )
}
