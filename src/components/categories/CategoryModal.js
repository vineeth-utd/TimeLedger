'use client'

import { useState, useEffect } from 'react'
import { X } from 'lucide-react'

const TITLES = {
  'add-main': 'Add Main Category',
  'edit-main': 'Rename Main Category',
  'add-sub': 'Add Sub Category',
  'edit-sub': 'Rename Sub Category',
}

export default function CategoryModal({ isOpen, mode, mainCategory, subCategory, onClose, onSuccess }) {
  const [name, setName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [nameError, setNameError] = useState('')
  const [apiError, setApiError] = useState('')

  useEffect(() => {
    if (!isOpen) return
    setNameError('')
    setApiError('')
    if (mode === 'edit-main') setName(mainCategory?.name ?? '')
    else if (mode === 'edit-sub') setName(subCategory?.name ?? '')
    else setName('')
  }, [isOpen, mode, mainCategory, subCategory])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim()) {
      setNameError('Name is required')
      return
    }
    setSubmitting(true)
    setApiError('')
    setNameError('')

    let url, method, body
    if (mode === 'add-main') {
      url = '/api/main-categories'
      method = 'POST'
      body = { name: name.trim() }
    } else if (mode === 'edit-main') {
      url = `/api/main-categories/${mainCategory.id}`
      method = 'PATCH'
      body = { name: name.trim() }
    } else if (mode === 'add-sub') {
      url = '/api/sub-categories'
      method = 'POST'
      body = { mainCategoryId: mainCategory.id, name: name.trim() }
    } else {
      url = `/api/sub-categories/${subCategory.id}`
      method = 'PATCH'
      body = { name: name.trim() }
    }

    try {
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200">
          <h2 className="text-base font-semibold text-zinc-900">{TITLES[mode]}</h2>
          <button onClick={onClose} className="p-1 rounded text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          {apiError && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded">
              {apiError}
            </div>
          )}

          {(mode === 'add-sub' || mode === 'edit-sub') && (
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">Main Category</label>
              <div className="w-full border border-zinc-200 rounded px-3 py-2 text-sm bg-zinc-50 text-zinc-500">
                {mainCategory?.name ?? '—'}
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => { setName(e.target.value); setNameError('') }}
              autoFocus
              placeholder={mode === 'add-main' || mode === 'edit-main' ? 'e.g. Career Growth' : 'e.g. LeetCode Problems'}
              className="w-full border border-zinc-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {nameError && <p className="text-red-600 text-xs mt-1">{nameError}</p>}
          </div>

          <div className="flex justify-end gap-3 pt-2 pb-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-zinc-700 bg-white border border-zinc-300 rounded hover:bg-zinc-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
