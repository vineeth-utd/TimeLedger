import EmptyState from '@/components/EmptyState'
import { formatDateOnly, formatMinutes } from '@/lib/formatters'

function formatDate(dateStr) {
  if (!dateStr) return ''
  return formatDateOnly(dateStr, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export default function TodaySummary({ byMainCategory, bySubCategory, today }) {
  const isEmpty = byMainCategory.length === 0 && bySubCategory.length === 0

  const totalMinutes = byMainCategory.reduce((s, r) => s + r.totalMinutes, 0)
  const totalActivities = byMainCategory.reduce((s, r) => s + r.totalActivities, 0)

  return (
    <section className="bg-surface border border-border rounded-xl shadow-sm">
      <div className="px-6 py-4 border-b border-border-subtle">
        <h2 className="text-sm font-semibold text-foreground">Today&apos;s Summary</h2>
        {today && <p className="text-xs text-foreground-muted mt-0.5">{formatDate(today)}</p>}
      </div>

      {isEmpty ? (
        <EmptyState message="No activities logged today." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border-subtle">
          {/* By Main Category */}
          <div className="px-6 py-5">
            <h3 className="text-xs font-medium text-foreground-subtle uppercase tracking-wide mb-4">
              By Main Category
            </h3>
            {byMainCategory.length === 0 ? (
              <p className="text-sm text-foreground-subtle">No data</p>
            ) : (
              <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-xs text-foreground-subtle">
                    <th scope="col" className="pb-2 font-medium">Category</th>
                    <th scope="col" className="pb-2 font-medium text-right">Time</th>
                    <th scope="col" className="pb-2 font-medium text-right">Activities</th>
                  </tr>
                </thead>
                <tbody>
                  {byMainCategory.map((row) => (
                    <tr key={row.mainCategoryId} className="border-t border-border-subtle hover:bg-surface-subtle">
                      <td className="py-2.5 text-sm text-foreground">{row.mainCategoryName}</td>
                      <td className="py-2.5 text-right text-base font-semibold text-foreground tabular-nums">
                        {formatMinutes(row.totalMinutes)}
                      </td>
                      <td className="py-2.5 text-right text-sm text-foreground-subtle tabular-nums">
                        {row.totalActivities}
                      </td>
                    </tr>
                  ))}
                  {byMainCategory.length > 1 && (
                    <tr className="border-t-2 border-border">
                      <td className="py-2.5 text-xs font-medium text-foreground-muted uppercase tracking-wide">Total</td>
                      <td className="py-2.5 text-right text-base font-bold text-foreground tabular-nums">
                        {formatMinutes(totalMinutes)}
                      </td>
                      <td className="py-2.5 text-right text-sm font-medium text-foreground-secondary tabular-nums">
                        {totalActivities}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
              </div>
            )}
          </div>

          {/* By Sub Category */}
          <div className="px-6 py-5">
            <h3 className="text-xs font-medium text-foreground-subtle uppercase tracking-wide mb-4">
              By Sub Category
            </h3>
            {bySubCategory.length === 0 ? (
              <p className="text-sm text-foreground-subtle">No data</p>
            ) : (
              <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-xs text-foreground-subtle">
                    <th scope="col" className="pb-2 font-medium">Sub Category</th>
                    <th scope="col" className="pb-2 font-medium">Main</th>
                    <th scope="col" className="pb-2 font-medium text-right">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {bySubCategory.map((row) => (
                    <tr key={row.subCategoryId} className="border-t border-border-subtle hover:bg-surface-subtle">
                      <td className="py-2.5 text-sm text-foreground">{row.subCategoryName}</td>
                      <td className="py-2.5 text-xs text-foreground-subtle">{row.mainCategoryName}</td>
                      <td className="py-2.5 text-right text-base font-semibold text-foreground tabular-nums">
                        {formatMinutes(row.totalMinutes)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
