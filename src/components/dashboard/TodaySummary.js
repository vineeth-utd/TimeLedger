import EmptyState from '@/components/EmptyState'
import { formatMinutes } from '@/lib/formatters'

function formatDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T00:00:00.000Z')
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  })
}

export default function TodaySummary({ byMainCategory, bySubCategory, today }) {
  const isEmpty = byMainCategory.length === 0 && bySubCategory.length === 0

  return (
    <section className="bg-white border border-zinc-200 rounded-lg shadow-sm">
      <div className="px-6 py-4 border-b border-zinc-100">
        <h2 className="text-sm font-semibold text-zinc-900">Today&apos;s Summary</h2>
        {today && <p className="text-xs text-zinc-500 mt-0.5">{formatDate(today)}</p>}
      </div>

      {isEmpty ? (
        <EmptyState message="No activities logged today." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-zinc-100">
          {/* Main Category */}
          <div className="px-6 py-4">
            <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-3">
              By Main Category
            </h3>
            {byMainCategory.length === 0 ? (
              <p className="text-sm text-zinc-400">No data</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-zinc-400">
                    <th className="pb-2 font-medium">Category</th>
                    <th className="pb-2 font-medium text-right">Time</th>
                    <th className="pb-2 font-medium text-right">Activities</th>
                  </tr>
                </thead>
                <tbody>
                  {byMainCategory.map((row) => (
                    <tr key={row.mainCategoryId} className="border-t border-zinc-50">
                      <td className="py-2 text-zinc-800">{row.mainCategoryName}</td>
                      <td className="py-2 text-right text-zinc-700 font-medium">
                        {formatMinutes(row.totalMinutes)}
                      </td>
                      <td className="py-2 text-right text-zinc-400">{row.totalActivities}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Sub Category */}
          <div className="px-6 py-4">
            <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-3">
              By Sub Category
            </h3>
            {bySubCategory.length === 0 ? (
              <p className="text-sm text-zinc-400">No data</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-zinc-400">
                    <th className="pb-2 font-medium">Sub Category</th>
                    <th className="pb-2 font-medium text-zinc-300">Main</th>
                    <th className="pb-2 font-medium text-right">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {bySubCategory.map((row) => (
                    <tr key={row.subCategoryId} className="border-t border-zinc-50">
                      <td className="py-2 text-zinc-800">{row.subCategoryName}</td>
                      <td className="py-2 text-zinc-400 text-xs">{row.mainCategoryName}</td>
                      <td className="py-2 text-right text-zinc-700 font-medium">
                        {formatMinutes(row.totalMinutes)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
