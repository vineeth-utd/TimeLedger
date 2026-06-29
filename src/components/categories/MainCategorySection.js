'use client'

import { useState } from 'react'

export default function MainCategorySection({
  mainCategory,
  subCategories,
  statusFilter,
  onRenameMain,
  onToggleMain,
  onAddSub,
  onRenameSub,
  onToggleSub,
}) {
  const [open, setOpen] = useState(true)

  const filteredSubs = subCategories.filter((sc) => {
    if (statusFilter === 'active') return sc.isActive
    if (statusFilter === 'inactive') return !sc.isActive
    return true
  })

  return (
    <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
      <div className={`flex items-center justify-between px-5 py-3 ${!mainCategory.isActive ? 'bg-zinc-50' : ''}`}>
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-2 text-left min-w-0"
        >
          <span className={`text-xs text-zinc-400 inline-block transition-transform duration-150 ${open ? '' : '-rotate-90'}`}>
            ▼
          </span>
          <span className={`text-sm font-semibold truncate ${mainCategory.isActive ? 'text-zinc-900' : 'text-zinc-400'}`}>
            {mainCategory.name}
          </span>
          {!mainCategory.isActive && (
            <span className="shrink-0 inline-flex items-center px-1.5 py-0.5 text-xs rounded bg-zinc-100 text-zinc-400 border border-zinc-200">
              Inactive
            </span>
          )}
        </button>

        <div className="flex items-center gap-3 shrink-0 ml-4">
          <button
            onClick={() => onRenameMain(mainCategory)}
            className="text-xs text-blue-600 hover:underline font-medium"
          >
            Rename
          </button>
          <button
            onClick={() => onToggleMain(mainCategory)}
            className="text-xs text-zinc-500 hover:underline font-medium"
          >
            {mainCategory.isActive ? 'Deactivate' : 'Reactivate'}
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-zinc-100">
          {filteredSubs.length === 0 ? (
            <p className="text-xs text-zinc-400 px-5 py-3">
              {statusFilter === 'inactive'
                ? 'No inactive sub categories.'
                : statusFilter === 'active'
                ? 'No active sub categories.'
                : 'No sub categories yet.'}
            </p>
          ) : (
            filteredSubs.map((sc) => (
              <div
                key={sc.id}
                className="flex items-center justify-between px-5 py-2.5 border-b border-zinc-50 last:border-0"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`text-sm truncate ${sc.isActive ? 'text-zinc-700' : 'text-zinc-400'}`}>
                    {sc.name}
                  </span>
                  {!sc.isActive && (
                    <span className="shrink-0 inline-flex items-center px-1.5 py-0.5 text-xs rounded bg-zinc-100 text-zinc-400 border border-zinc-200">
                      Inactive
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 shrink-0 ml-4">
                  <button
                    onClick={() => onRenameSub(mainCategory, sc)}
                    className="text-xs text-blue-600 hover:underline font-medium"
                  >
                    Rename
                  </button>
                  <button
                    onClick={() => onToggleSub(sc)}
                    className="text-xs text-zinc-500 hover:underline font-medium"
                  >
                    {sc.isActive ? 'Deactivate' : 'Reactivate'}
                  </button>
                </div>
              </div>
            ))
          )}

          {statusFilter !== 'inactive' && (
            <div className="px-5 py-2.5">
              <button
                onClick={() => onAddSub(mainCategory)}
                className="text-xs text-blue-600 hover:underline font-medium"
              >
                + Add Sub Category
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
