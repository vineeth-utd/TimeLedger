'use client'

import { useState } from 'react'
import { ChevronDown, Eye, EyeOff, Pencil, Plus, Trash2 } from 'lucide-react'

export default function MainCategorySection({
  mainCategory,
  subCategories,
  statusFilter,
  onRenameMain,
  onToggleMain,
  onDeleteMain,
  onAddSub,
  onRenameSub,
  onToggleSub,
  onDeleteSub,
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
          aria-expanded={open}
          className="flex items-center gap-2 text-left min-w-0"
        >
          <ChevronDown
            className={`w-3.5 h-3.5 text-zinc-400 shrink-0 transition-transform duration-150 ${open ? '' : '-rotate-90'}`}
          />
          <span className={`text-sm font-semibold truncate ${mainCategory.isActive ? 'text-zinc-900' : 'text-zinc-400'}`}>
            {mainCategory.name}
          </span>
          {!mainCategory.isActive && (
            <span className="shrink-0 inline-flex items-center px-1.5 py-0.5 text-xs rounded bg-zinc-100 text-zinc-400 border border-zinc-200">
              Inactive
            </span>
          )}
        </button>

        <div className="flex items-center gap-1 shrink-0 ml-4">
          <button
            onClick={() => onRenameMain(mainCategory)}
            aria-label={`Rename ${mainCategory.name}`}
            className="p-1.5 rounded text-zinc-400 hover:text-blue-600 hover:bg-zinc-100 transition-colors"
          >
            <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
          <button
            onClick={() => onToggleMain(mainCategory)}
            aria-label={mainCategory.isActive ? `Deactivate ${mainCategory.name}` : `Reactivate ${mainCategory.name}`}
            className={`p-1.5 rounded transition-colors ${
              mainCategory.isActive
                ? 'text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100'
                : 'text-zinc-400 hover:text-green-600 hover:bg-zinc-100'
            }`}
          >
            {mainCategory.isActive ? <EyeOff className="w-3.5 h-3.5" aria-hidden="true" /> : <Eye className="w-3.5 h-3.5" aria-hidden="true" />}
          </button>
          <button
            onClick={() => onDeleteMain(mainCategory)}
            aria-label={`Delete ${mainCategory.name}`}
            className="p-1.5 rounded text-zinc-400 hover:text-red-500 hover:bg-zinc-100 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-zinc-100">
          {filteredSubs.length === 0 ? (
            <p className="text-xs text-zinc-400 px-5 py-3 pl-10">
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
                className={`flex items-center justify-between px-5 py-2.5 border-b border-zinc-50 last:border-0 ${!sc.isActive ? 'bg-zinc-50/60' : ''}`}
              >
                <div className="flex items-center gap-2 min-w-0 pl-6">
                  <span className={`text-sm truncate ${sc.isActive ? 'text-zinc-700' : 'text-zinc-400'}`}>
                    {sc.name}
                  </span>
                  {!sc.isActive && (
                    <span className="shrink-0 inline-flex items-center px-1.5 py-0.5 text-xs rounded bg-zinc-100 text-zinc-400 border border-zinc-200">
                      Inactive
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0 ml-4">
                  <button
                    onClick={() => onRenameSub(mainCategory, sc)}
                    aria-label={`Rename ${sc.name}`}
                    className="p-1.5 rounded text-zinc-400 hover:text-blue-600 hover:bg-zinc-100 transition-colors"
                  >
                    <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                  <button
                    onClick={() => onToggleSub(sc)}
                    aria-label={sc.isActive ? `Deactivate ${sc.name}` : `Reactivate ${sc.name}`}
                    className={`p-1.5 rounded transition-colors ${
                      sc.isActive
                        ? 'text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100'
                        : 'text-zinc-400 hover:text-green-600 hover:bg-zinc-100'
                    }`}
                  >
                    {sc.isActive ? <EyeOff className="w-3.5 h-3.5" aria-hidden="true" /> : <Eye className="w-3.5 h-3.5" aria-hidden="true" />}
                  </button>
                  <button
                    onClick={() => onDeleteSub(sc)}
                    aria-label={`Delete ${sc.name}`}
                    className="p-1.5 rounded text-zinc-400 hover:text-red-500 hover:bg-zinc-100 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                </div>
              </div>
            ))
          )}

          {statusFilter !== 'inactive' && (
            <div className="px-5 py-3 pl-11">
              <button
                onClick={() => onAddSub(mainCategory)}
                className="inline-flex items-center gap-1.5 text-xs text-blue-600 border border-dashed border-blue-300 rounded-full px-3 py-1 hover:bg-blue-50 hover:border-blue-400 transition-colors"
              >
                <Plus className="w-3 h-3" />
                Add Sub Category
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
