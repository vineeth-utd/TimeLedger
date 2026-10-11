import EmptyState from '@/components/EmptyState'
import { formatMinutes } from '@/lib/formatters'

const ACCENTS = [
  { border: 'border-l-blue-500',    bar: 'bg-blue-500'    },
  { border: 'border-l-violet-500',  bar: 'bg-violet-500'  },
  { border: 'border-l-emerald-500', bar: 'bg-emerald-500' },
  { border: 'border-l-amber-500',   bar: 'bg-amber-500'   },
  { border: 'border-l-rose-500',    bar: 'bg-rose-500'    },
  { border: 'border-l-cyan-500',    bar: 'bg-cyan-500'    },
]

function getStatus(pct) {
  if (pct === null) return null
  if (pct > 100)   return { label: 'Exceeded',        cls: 'bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-800' }
  if (pct === 100) return { label: 'Target Achieved',  cls: 'bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800' }
  if (pct >= 75)   return { label: 'Near Target',      cls: 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800' }
  return             { label: 'On Track',              cls: 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800' }
}

export default function WeeklyProgress({ weeklyProgress }) {
  return (
    <section className="bg-surface border border-border rounded-xl shadow-sm">
      <div className="px-6 py-4 border-b border-border-subtle">
        <h2 className="text-sm font-semibold text-foreground">Weekly Progress</h2>
        <p className="text-xs text-foreground-muted mt-0.5">Progress by main category for the selected week</p>
      </div>

      {weeklyProgress.length === 0 ? (
        <EmptyState message="No weekly targets or activity data for the selected week." />
      ) : (
        <div className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {weeklyProgress.map((row, i) => {
            const accent = ACCENTS[i % ACCENTS.length]
            const pct = row.progressPercentage
            const status = getStatus(pct)
            const barWidth = pct !== null ? Math.min(100, pct) : 0

            return (
              <div
                key={row.mainCategoryId}
                className={`bg-surface border border-border-subtle border-l-4 ${accent.border} rounded-xl p-4 hover:shadow-md hover:-translate-y-0.5 transition-all duration-150 cursor-default`}
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <span className="text-sm font-semibold text-foreground leading-snug">
                    {row.mainCategoryName}
                  </span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {row.isTargetFallback && (
                      <span className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded px-1.5 py-0.5">
                        Fallback
                      </span>
                    )}
                    {status && (
                      <span className={`text-xs rounded px-1.5 py-0.5 ${status.cls}`}>
                        {status.label}
                      </span>
                    )}
                  </div>
                </div>

                {row.targetMinutes > 0 ? (
                  <>
                    {/* Percentage */}
                    <div className="mb-2">
                      <span className="text-2xl font-bold text-foreground">
                        {pct ?? 0}%
                      </span>
                    </div>

                    {/* Progress bar */}
                    <div
                      role="progressbar"
                      aria-valuenow={barWidth}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={`${row.mainCategoryName} progress`}
                      className="w-full bg-surface-muted rounded-full h-1.5 mb-1"
                    >
                      <div
                        className={`${accent.bar} h-1.5 rounded-full transition-all duration-500`}
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>

                    {/* 3-column stats */}
                    <div className="grid grid-cols-3 gap-1 mt-3 pt-3 border-t border-border-subtle">
                      <div>
                        <p className="text-[10px] text-foreground-subtle uppercase tracking-wide">Spent</p>
                        <p className="text-sm font-semibold text-foreground mt-0.5">{formatMinutes(row.spentMinutes)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-foreground-subtle uppercase tracking-wide">Target</p>
                        <p className="text-sm font-medium text-foreground-secondary mt-0.5">{formatMinutes(row.targetMinutes)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-foreground-subtle uppercase tracking-wide">Remaining</p>
                        <p className="text-sm font-medium text-foreground-muted mt-0.5">{formatMinutes(row.remainingMinutes)}</p>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="text-2xl font-bold text-foreground">
                      {formatMinutes(row.spentMinutes)}
                    </div>
                    <div className="text-xs text-foreground-subtle mt-1">No target set</div>
                  </>
                )}
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
