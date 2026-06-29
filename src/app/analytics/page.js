'use client'

import { useState, useEffect } from 'react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  LineChart,
  Line,
} from 'recharts'
import PageHeader from '@/components/PageHeader'
import DateRangeFilter from '@/components/DateRangeFilter'
import SummaryCard from '@/components/SummaryCard'
import LoadingState from '@/components/LoadingState'
import ErrorBanner from '@/components/ErrorBanner'
import EmptyState from '@/components/EmptyState'
import { formatMinutes } from '@/lib/formatters'

function aggregateByMainCategory(activities) {
  const map = {}
  for (const a of activities) {
    const mc = a.subCategory.mainCategory
    if (!map[mc.id]) map[mc.id] = { id: mc.id, name: mc.name, totalMinutes: 0 }
    map[mc.id].totalMinutes += a.durationMinutes
  }
  return Object.values(map).sort((a, b) => b.totalMinutes - a.totalMinutes)
}

function aggregateBySubCategory(activities) {
  const map = {}
  for (const a of activities) {
    const sc = a.subCategory
    const mc = sc.mainCategory
    if (!map[sc.id]) map[sc.id] = { id: sc.id, name: sc.name, mainName: mc.name, totalMinutes: 0 }
    map[sc.id].totalMinutes += a.durationMinutes
  }
  return Object.values(map)
    .sort((a, b) => b.totalMinutes - a.totalMinutes)
    .slice(0, 10)
}

function aggregateByDate(activities) {
  const map = {}
  for (const a of activities) {
    const date = String(a.activityDate).substring(0, 10)
    if (!map[date]) map[date] = 0
    map[date] += a.durationMinutes
  }
  return Object.entries(map)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, totalMinutes]) => ({ date, totalMinutes }))
}

function computeSummary(activities) {
  const dates = new Set()
  let totalMinutes = 0
  for (const a of activities) {
    totalMinutes += a.durationMinutes
    dates.add(String(a.activityDate).substring(0, 10))
  }
  return { totalMinutes, totalActivities: activities.length, activeDays: dates.size }
}

function formatAxisDate(dateStr) {
  return new Date(dateStr + 'T00:00:00.000Z').toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  })
}

export default function AnalyticsPage() {
  const [dateRange, setDateRange] = useState(null)
  const [activities, setActivities] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!dateRange) return
    setLoading(true)
    setError(null)
    fetch(`/api/activities?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setActivities(json.data)
        else setError(json.message ?? 'Failed to load analytics data')
      })
      .catch(() => setError('Network error. Please try again.'))
      .finally(() => setLoading(false))
  }, [dateRange])

  const hasData = activities.length > 0
  const isSingleDay = dateRange?.startDate === dateRange?.endDate

  const summary = hasData ? computeSummary(activities) : null
  const mainCategoryData = hasData ? aggregateByMainCategory(activities) : []
  const subCategoryData = hasData ? aggregateBySubCategory(activities) : []
  const dailyData = hasData ? aggregateByDate(activities) : []

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      <PageHeader
        title="Analytics"
        subtitle="Understand how your time is distributed across categories"
      />

      <DateRangeFilter onChange={setDateRange} />

      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

      {!dateRange || loading ? (
        <LoadingState />
      ) : !hasData ? (
        <EmptyState message="No activities found for the selected period. Log activities for a few days to see analytics." />
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <SummaryCard label="Total Time" value={formatMinutes(summary.totalMinutes)} />
            <SummaryCard label="Activities" value={summary.totalActivities} />
            <SummaryCard label="Active Days" value={summary.activeDays} />
          </div>

          <div className="bg-white border border-zinc-200 rounded-lg p-5">
            <h2 className="text-sm font-semibold text-zinc-700 mb-4">Time by Main Category</h2>
            {mainCategoryData.length === 0 ? (
              <p className="text-sm text-zinc-400 py-8 text-center">No data for this period.</p>
            ) : (
              <ResponsiveContainer
                width="100%"
                height={Math.max(200, mainCategoryData.length * 48)}
              >
                <BarChart
                  layout="vertical"
                  data={mainCategoryData}
                  margin={{ left: 8, right: 24, top: 4, bottom: 4 }}
                >
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={130}
                    tick={{ fontSize: 12 }}
                  />
                  <XAxis
                    type="number"
                    tickFormatter={(v) => formatMinutes(v)}
                    tick={{ fontSize: 11 }}
                  />
                  <Tooltip formatter={(v) => [formatMinutes(v), 'Time']} />
                  <Bar dataKey="totalMinutes" fill="#2563eb" radius={[0, 3, 3, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {!isSingleDay && (
            <div className="bg-white border border-zinc-200 rounded-lg p-5">
              <h2 className="text-sm font-semibold text-zinc-700 mb-4">Daily Trend</h2>
              {dailyData.length === 0 ? (
                <p className="text-sm text-zinc-400 py-8 text-center">No data for this period.</p>
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart
                    data={dailyData}
                    margin={{ left: 8, right: 16, top: 4, bottom: 4 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f1f1" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={formatAxisDate}
                      tick={{ fontSize: 11 }}
                    />
                    <YAxis
                      tickFormatter={(v) => formatMinutes(v)}
                      tick={{ fontSize: 11 }}
                    />
                    <Tooltip
                      formatter={(v) => [formatMinutes(v), 'Time']}
                      labelFormatter={formatAxisDate}
                    />
                    <Line
                      type="monotone"
                      dataKey="totalMinutes"
                      stroke="#2563eb"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          )}

          <div className="bg-white border border-zinc-200 rounded-lg p-5">
            <h2 className="text-sm font-semibold text-zinc-700 mb-4">Top Sub Categories</h2>
            {subCategoryData.length === 0 ? (
              <p className="text-sm text-zinc-400 py-8 text-center">No data for this period.</p>
            ) : (
              <ResponsiveContainer
                width="100%"
                height={Math.max(200, subCategoryData.length * 48)}
              >
                <BarChart
                  layout="vertical"
                  data={subCategoryData}
                  margin={{ left: 8, right: 24, top: 4, bottom: 4 }}
                >
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={160}
                    tick={{ fontSize: 12 }}
                  />
                  <XAxis
                    type="number"
                    tickFormatter={(v) => formatMinutes(v)}
                    tick={{ fontSize: 11 }}
                  />
                  <Tooltip
                    formatter={(v) => [formatMinutes(v), 'Time']}
                    labelFormatter={(label) => {
                      const entry = subCategoryData.find((d) => d.name === label)
                      return entry ? `${label} (${entry.mainName})` : label
                    }}
                  />
                  <Bar dataKey="totalMinutes" fill="#0891b2" radius={[0, 3, 3, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
