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
    <div className="bg-surface border border-border rounded-lg overflow-hidden">
      <div className={`flex items-center justify-between px-5 py-3 ${!mainCategory.isActive ? 'bg-surface-subtle' : ''}`}>
        <button
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="flex items-center gap-2 text-left min-w-0"
        >
          <ChevronDown
            className={`w-3.5 h-3.5 text-foreground-subtle shrink-0 transition-transform duration-150 ${open ? '' : '-rotate-90'}`}
          />
          <span className={`text-sm font-semibold truncate ${mainCategory.isActive ? 'text-foreground' : 'text-foreground-subtle'}`}>
            {mainCategory.name}
          </span>
          {!mainCategory.isActive && (
            <span className="shrink-0 inline-flex items-center px-1.5 py-0.5 text-xs rounded bg-surface-muted text-foreground-subtle border border-border">
              Inactive
            </span>
          )}
        </button>

        <div className="flex items-center gap-1 shrink-0 ml-4">
          <button
            onClick={() => onRenameMain(mainCategory)}
            aria-label={`Rename ${mainCategory.name}`}
            className="p-1.5 rounded text-foreground-subtle hover:text-blue-600 dark:hover:text-blue-400 hover:bg-surface-muted transition-colors"
          >
            <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
          <button
            onClick={() => onToggleMain(mainCategory)}
            aria-label={mainCategory.isActive ? `Deactivate ${mainCategory.name}` : `Reactivate ${mainCategory.name}`}
            className={`p-1.5 rounded transition-colors ${
              mainCategory.isActive
                ? 'text-foreground-subtle hover:text-foreground-secondary hover:bg-surface-muted'
                : 'text-foreground-subtle hover:text-green-600 dark:hover:text-green-400 hover:bg-surface-muted'
            }`}
          >
            {mainCategory.isActive ? <EyeOff className="w-3.5 h-3.5" aria-hidden="true" /> : <Eye className="w-3.5 h-3.5" aria-hidden="true" />}
          </button>
          <button
            onClick={() => onDeleteMain(mainCategory)}
            aria-label={`Delete ${mainCategory.name}`}
            className="p-1.5 rounded text-foreground-subtle hover:text-red-500 hover:bg-surface-muted transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-border-subtle">
          {filteredSubs.length === 0 ? (
            <p className="text-xs text-foreground-subtle px-5 py-3 pl-10">
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
                className={`flex items-center justify-between px-5 py-2.5 border-b border-border-subtle last:border-0 ${!sc.isActive ? 'bg-surface-subtle/60' : ''}`}
              >
                <div className="flex items-center gap-2 min-w-0 pl-6">
                  <span className={`text-sm truncate ${sc.isActive ? 'text-foreground-secondary' : 'text-foreground-subtle'}`}>
                    {sc.name}
                  </span>
                  {!sc.isActive && (
                    <span className="shrink-0 inline-flex items-center px-1.5 py-0.5 text-xs rounded bg-surface-muted text-foreground-subtle border border-border">
                      Inactive
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0 ml-4">
                  <button
                    onClick={() => onRenameSub(mainCategory, sc)}
                    aria-label={`Rename ${sc.name}`}
                    className="p-1.5 rounded text-foreground-subtle hover:text-blue-600 dark:hover:text-blue-400 hover:bg-surface-muted transition-colors"
                  >
                    <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                  <button
                    onClick={() => onToggleSub(sc)}
                    aria-label={sc.isActive ? `Deactivate ${sc.name}` : `Reactivate ${sc.name}`}
                    className={`p-1.5 rounded transition-colors ${
                      sc.isActive
                        ? 'text-foreground-subtle hover:text-foreground-secondary hover:bg-surface-muted'
                        : 'text-foreground-subtle hover:text-green-600 dark:hover:text-green-400 hover:bg-surface-muted'
                    }`}
                  >
                    {sc.isActive ? <EyeOff className="w-3.5 h-3.5" aria-hidden="true" /> : <Eye className="w-3.5 h-3.5" aria-hidden="true" />}
                  </button>
                  <button
                    onClick={() => onDeleteSub(sc)}
                    aria-label={`Delete ${sc.name}`}
                    className="p-1.5 rounded text-foreground-subtle hover:text-red-500 hover:bg-surface-muted transition-colors"
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
                className="inline-flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 border border-dashed border-blue-300 dark:border-blue-700 rounded-full px-3 py-1 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:border-blue-400 transition-colors"
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
