'use client'

import { useState, useEffect } from 'react'
import { X } from 'lucide-react'

const EMPTY_FORM = {
  activityDate: '',
  title: '',
  subCategoryId: '',
  startTime: '',
  endTime: '',
  notes: '',
}

function groupByMainCategory(subCategories) {
  const groups = {}
  for (const sc of subCategories) {
    const name = sc.mainCategory?.name ?? 'Other'
    if (!groups[name]) groups[name] = []
    groups[name].push(sc)
  }
  return groups
}

export default function ActivityModal({ isOpen, activity, onClose, onSuccess }) {
  const [form, setForm] = useState(EMPTY_FORM)
  const [subCategories, setSubCategories] = useState([])
  const [mainCategoryName, setMainCategoryName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [errors, setErrors] = useState({})
  const [apiError, setApiError] = useState('')

  useEffect(() => {
    if (!isOpen) return

    fetch('/api/sub-categories?isActive=true')
      .then((r) => r.json())
      .then((json) => { if (json.success) setSubCategories(json.data) })
      .catch(() => {})

    if (activity) {
      const date = new Date(activity.activityDate).toISOString().substring(0, 10)
      const start = new Date(activity.startTime).toISOString().substring(11, 16)
      const end = new Date(activity.endTime).toISOString().substring(11, 16)
      setForm({
        activityDate: date,
        title: activity.title,
        subCategoryId: String(activity.subCategoryId),
        startTime: start,
        endTime: end,
        notes: activity.notes ?? '',
      })
      setMainCategoryName(activity.subCategory?.mainCategory?.name ?? '')
    } else {
      const today = new Date().toISOString().substring(0, 10)
      setForm({ ...EMPTY_FORM, activityDate: today })
      setMainCategoryName('')
    }

    setErrors({})
    setApiError('')
  }, [isOpen, activity])

  useEffect(() => {
    if (!form.subCategoryId || subCategories.length === 0) return
    const found = subCategories.find((sc) => String(sc.id) === form.subCategoryId)
    setMainCategoryName(found?.mainCategory?.name ?? '')
  }, [form.subCategoryId, subCategories])

  function handleChange(e) {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }))
  }

  function validate() {
    const errs = {}
    if (!form.title.trim()) errs.title = 'Title is required'
    if (!form.subCategoryId) errs.subCategoryId = 'Sub category is required'
    if (!form.activityDate) errs.activityDate = 'Date is required'
    if (!form.startTime) errs.startTime = 'Start time is required'
    if (!form.endTime) errs.endTime = 'End time is required'
    if (form.startTime && form.endTime && form.endTime <= form.startTime) {
      errs.endTime = 'End time must be after start time'
    }
    return errs
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length > 0) {
      setErrors(errs)
      return
    }

    setSubmitting(true)
    setApiError('')

    const body = {
      activityDate: form.activityDate,
      title: form.title.trim(),
      subCategoryId: Number(form.subCategoryId),
      startTime: `${form.activityDate}T${form.startTime}:00.000Z`,
      endTime: `${form.activityDate}T${form.endTime}:00.000Z`,
      notes: form.notes || null,
    }

    try {
      const url = activity ? `/api/activities/${activity.id}` : '/api/activities'
      const method = activity ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (json.success) {
        onSuccess()
      } else {
        setApiError(json.message ?? 'An error occurred')
      }
    } catch {
      setApiError('Network error. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (!isOpen) return null

  const grouped = groupByMainCategory(subCategories)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-900">
            {activity ? 'Edit Activity' : 'Add Activity'}
          </h2>
          <button onClick={onClose} aria-label="Close" className="text-gray-400 hover:text-gray-600">
            <X className="w-4 h-4" strokeWidth={2} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4 overflow-y-auto">
          {apiError && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded">
              {apiError}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Activity Date</label>
            <input
              type="date"
              name="activityDate"
              value={form.activityDate}
              onChange={handleChange}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {errors.activityDate && <p className="text-red-600 text-xs mt-1">{errors.activityDate}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
            <input
              type="text"
              name="title"
              value={form.title}
              onChange={handleChange}
              placeholder="What did you work on?"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {errors.title && <p className="text-red-600 text-xs mt-1">{errors.title}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Sub Category</label>
            <select
              name="subCategoryId"
              value={form.subCategoryId}
              onChange={handleChange}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white appearance-none"
            >
              <option value="">Select a sub category</option>
              {Object.entries(grouped).map(([mcName, scs]) => (
                <optgroup key={mcName} label={mcName}>
                  {scs.map((sc) => (
                    <option key={sc.id} value={sc.id}>
                      {sc.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            {errors.subCategoryId && <p className="text-red-600 text-xs mt-1">{errors.subCategoryId}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Main Category</label>
            <div className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm bg-gray-50 text-gray-500 min-h-[38px]">
              {mainCategoryName || '—'}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
              <input
                type="time"
                name="startTime"
                value={form.startTime}
                onChange={handleChange}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {errors.startTime && <p className="text-red-600 text-xs mt-1">{errors.startTime}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Time</label>
              <input
                type="time"
                name="endTime"
                value={form.endTime}
                onChange={handleChange}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {errors.endTime && <p className="text-red-600 text-xs mt-1">{errors.endTime}</p>}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <textarea
              name="notes"
              value={form.notes}
              onChange={handleChange}
              rows={2}
              placeholder="Optional notes..."
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none placeholder:text-gray-400"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2 pb-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 active:bg-gray-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50"
            >
              {submitting ? 'Saving…' : activity ? 'Save Changes' : 'Add Activity'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
