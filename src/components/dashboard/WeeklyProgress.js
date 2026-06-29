import EmptyState from '@/components/EmptyState'
import { formatMinutes } from '@/lib/formatters'

export default function WeeklyProgress({ weeklyProgress }) {
  return (
    <section className="bg-white border border-zinc-200 rounded-lg shadow-sm">
      <div className="px-6 py-4 border-b border-zinc-100">
        <h2 className="text-sm font-semibold text-zinc-900">Current Week Progress</h2>
        <p className="text-xs text-zinc-500 mt-0.5">Progress by main category</p>
      </div>

      {weeklyProgress.length === 0 ? (
        <EmptyState message="No weekly targets or activity data for this week." />
      ) : (
        <div className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {weeklyProgress.map((row) => (
            <div key={row.mainCategoryId} className="border border-zinc-100 rounded-lg p-4 bg-zinc-50">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-zinc-800">{row.mainCategoryName}</span>
                {row.isTargetFallback && (
                  <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5">
                    Fallback
                  </span>
                )}
              </div>

              {row.targetMinutes > 0 ? (
                <>
                  <div className="w-full bg-zinc-200 rounded-full h-2 mb-3">
                    <div
                      className="bg-green-500 h-2 rounded-full transition-all"
                      style={{ width: `${Math.min(100, row.progressPercentage ?? 0)}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-zinc-500">
                    <span>
                      <span className="font-medium text-zinc-800">{formatMinutes(row.spentMinutes)}</span> spent
                    </span>
                    <span>{formatMinutes(row.targetMinutes)} target</span>
                  </div>
                  <div className="flex justify-between text-xs text-zinc-500 mt-1">
                    <span>{formatMinutes(row.remainingMinutes)} remaining</span>
                    <span className="font-medium text-zinc-700">{row.progressPercentage ?? 0}%</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="text-sm text-zinc-700 font-medium">
                    {formatMinutes(row.spentMinutes)} spent
                  </div>
                  <div className="text-xs text-zinc-400 mt-1">No target set</div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
