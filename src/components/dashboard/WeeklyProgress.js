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
  if (pct >= 100) return { label: 'Exceeded', cls: 'bg-violet-50 text-violet-700 border border-violet-200' }
  if (pct >= 75)  return { label: 'Near Target', cls: 'bg-amber-50 text-amber-700 border border-amber-200' }
  return { label: 'On Track', cls: 'bg-blue-50 text-blue-700 border border-blue-200' }
}

export default function WeeklyProgress({ weeklyProgress }) {
  return (
    <section className="bg-white border border-gray-200 rounded-xl shadow-sm">
      <div className="px-6 py-4 border-b border-gray-100">
        <h2 className="text-sm font-semibold text-gray-900">Current Week Progress</h2>
        <p className="text-xs text-gray-500 mt-0.5">Progress by main category</p>
      </div>

      {weeklyProgress.length === 0 ? (
        <EmptyState message="No weekly targets or activity data for this week." />
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
                className={`bg-white border border-gray-100 border-l-4 ${accent.border} rounded-xl p-4 hover:shadow-md hover:-translate-y-0.5 transition-all duration-150 cursor-default`}
              >
                {/* Header row */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <span className="text-sm font-semibold text-gray-800 leading-snug">
                    {row.mainCategoryName}
                  </span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {row.isTargetFallback && (
                      <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5">
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
                    <div className="flex items-baseline gap-1 mb-2">
                      <span className="text-2xl font-bold text-gray-900">
                        {pct ?? 0}%
                      </span>
                      {pct !== null && pct >= 100 && (
                        <span className="text-sm text-violet-600 font-medium">✓</span>
                      )}
                    </div>

                    {/* Progress bar */}
                    <div className="w-full bg-gray-100 rounded-full h-1.5 mb-3">
                      <div
                        className={`${accent.bar} h-1.5 rounded-full transition-all duration-500`}
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>

                    {/* Stats */}
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>
                        <span className="font-medium text-gray-800">{formatMinutes(row.spentMinutes)}</span> spent
                      </span>
                      <span>{formatMinutes(row.targetMinutes)} target</span>
                    </div>
                    <div className="flex justify-between text-xs text-gray-400 mt-1">
                      <span>{formatMinutes(row.remainingMinutes)} remaining</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="text-2xl font-bold text-gray-900">
                      {formatMinutes(row.spentMinutes)}
                    </div>
                    <div className="text-xs text-gray-400 mt-1">No target set</div>
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
