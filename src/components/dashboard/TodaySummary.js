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

  const totalMinutes = byMainCategory.reduce((s, r) => s + r.totalMinutes, 0)
  const totalActivities = byMainCategory.reduce((s, r) => s + r.totalActivities, 0)

  return (
    <section className="bg-white border border-gray-200 rounded-xl shadow-sm">
      <div className="px-6 py-4 border-b border-gray-100">
        <h2 className="text-sm font-semibold text-gray-900">Today&apos;s Summary</h2>
        {today && <p className="text-xs text-gray-500 mt-0.5">{formatDate(today)}</p>}
      </div>

      {isEmpty ? (
        <EmptyState message="No activities logged today." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-gray-100">
          {/* By Main Category */}
          <div className="px-6 py-5">
            <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-4">
              By Main Category
            </h3>
            {byMainCategory.length === 0 ? (
              <p className="text-sm text-gray-400">No data</p>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="text-left text-xs text-gray-400">
                    <th className="pb-2 font-medium">Category</th>
                    <th className="pb-2 font-medium text-right">Time</th>
                    <th className="pb-2 font-medium text-right">Activities</th>
                  </tr>
                </thead>
                <tbody>
                  {byMainCategory.map((row) => (
                    <tr key={row.mainCategoryId} className="border-t border-gray-100 hover:bg-gray-50">
                      <td className="py-2.5 text-sm text-gray-800">{row.mainCategoryName}</td>
                      <td className="py-2.5 text-right text-base font-semibold text-gray-900 tabular-nums">
                        {formatMinutes(row.totalMinutes)}
                      </td>
                      <td className="py-2.5 text-right text-sm text-gray-400 tabular-nums">
                        {row.totalActivities}
                      </td>
                    </tr>
                  ))}
                  {byMainCategory.length > 1 && (
                    <tr className="border-t-2 border-gray-200">
                      <td className="py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide">Total</td>
                      <td className="py-2.5 text-right text-base font-bold text-gray-900 tabular-nums">
                        {formatMinutes(totalMinutes)}
                      </td>
                      <td className="py-2.5 text-right text-sm font-medium text-gray-600 tabular-nums">
                        {totalActivities}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>

          {/* By Sub Category */}
          <div className="px-6 py-5">
            <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-4">
              By Sub Category
            </h3>
            {bySubCategory.length === 0 ? (
              <p className="text-sm text-gray-400">No data</p>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="text-left text-xs text-gray-400">
                    <th className="pb-2 font-medium">Sub Category</th>
                    <th className="pb-2 font-medium">Main</th>
                    <th className="pb-2 font-medium text-right">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {bySubCategory.map((row) => (
                    <tr key={row.subCategoryId} className="border-t border-gray-100 hover:bg-gray-50">
                      <td className="py-2.5 text-sm text-gray-800">{row.subCategoryName}</td>
                      <td className="py-2.5 text-xs text-gray-400">{row.mainCategoryName}</td>
                      <td className="py-2.5 text-right text-base font-semibold text-gray-900 tabular-nums">
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
