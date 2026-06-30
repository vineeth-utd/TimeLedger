'use client'

import { useState, useEffect } from 'react'
import { Clock, Activity, Calendar, TrendingUp, Timer, Zap } from 'lucide-react'
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

function getPrevWeekDates(startDate) {
  const start = new Date(startDate + 'T00:00:00.000Z')
  const prevEnd = new Date(start)
  prevEnd.setUTCDate(prevEnd.getUTCDate() - 1)
  const prevStart = new Date(prevEnd)
  prevStart.setUTCDate(prevStart.getUTCDate() - 6)
  return {
    startDate: prevStart.toISOString().slice(0, 10),
    endDate: prevEnd.toISOString().slice(0, 10),
  }
}

function buildComparisonData(currentData, prevData) {
  const names = new Set([...currentData.map((d) => d.name), ...prevData.map((d) => d.name)])
  return Array.from(names)
    .map((name) => ({
      name,
      current: currentData.find((d) => d.name === name)?.totalMinutes ?? 0,
      previous: prevData.find((d) => d.name === name)?.totalMinutes ?? 0,
    }))
    .sort((a, b) => b.current + b.previous - (a.current + a.previous))
}

function computeLongestActivity(activities) {
  return activities.reduce((max, a) => (a.durationMinutes > max.durationMinutes ? a : max), activities[0])
}

function computeWeekHighlights(comparisonData) {
  if (comparisonData.length === 0) return null
  const sorted = [...comparisonData].sort(
    (a, b) => (b.current - b.previous) - (a.current - a.previous)
  )
  return {
    biggestGain: sorted[0],
    biggestDrop: sorted[sorted.length - 1],
  }
}

function computeTargetRows(weeklyTargets, mainCategoryData) {
  return weeklyTargets
    .filter((t) => t.targetMinutes > 0)
    .map((t) => {
      const actual = mainCategoryData.find((mc) => mc.id === t.mainCategoryId)
      const spentMinutes = actual?.totalMinutes ?? 0
      const pct = Math.round((spentMinutes / t.targetMinutes) * 100)
      return { name: t.mainCategory.name, targetMinutes: t.targetMinutes, spentMinutes, pct }
    })
    .sort((a, b) => b.pct - a.pct)
}

function getStatusBadge(pct) {
  if (pct > 100) return { label: 'Exceeded', cls: 'bg-violet-50 text-violet-700 border border-violet-200' }
  if (pct === 100) return { label: 'Target Achieved', cls: 'bg-green-50 text-green-700 border border-green-200' }
  if (pct >= 75) return { label: 'Near Target', cls: 'bg-amber-50 text-amber-700 border border-amber-200' }
  return { label: 'On Track', cls: 'bg-blue-50 text-blue-700 border border-blue-200' }
}

export default function AnalyticsPage() {
  const [dateRange, setDateRange] = useState(null)
  const [activities, setActivities] = useState([])
  const [prevActivities, setPrevActivities] = useState([])
  const [weeklyTargets, setWeeklyTargets] = useState([])
  const [loading, setLoading] = useState(false)
  const [prevLoading, setPrevLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!dateRange) return
    setLoading(true)
    setError(null)

    const rl = Math.round(
      (new Date(dateRange.endDate + 'T00:00:00.000Z') - new Date(dateRange.startDate + 'T00:00:00.000Z')) / 86400000
    )
    const weekRange = rl === 6

    const primaryFetch = fetch(
      `/api/activities?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`
    ).then((r) => r.json())

    if (weekRange) {
      const prev = getPrevWeekDates(dateRange.startDate)
      setPrevLoading(true)
      const prevFetch = fetch(
        `/api/activities?startDate=${prev.startDate}&endDate=${prev.endDate}`
      ).then((r) => r.json())
      const targetsFetch = fetch(
        `/api/weekly-targets?weekStartDate=${dateRange.startDate}`
      ).then((r) => r.json())

      Promise.all([primaryFetch, prevFetch, targetsFetch])
        .then(([json, prevJson, targetsJson]) => {
          if (json.success) setActivities(json.data)
          else setError(json.message ?? 'Failed to load analytics data')
          setPrevActivities(prevJson.success ? prevJson.data : [])
          setWeeklyTargets(targetsJson.success ? targetsJson.data : [])
        })
        .catch(() => setError('Network error. Please try again.'))
        .finally(() => {
          setLoading(false)
          setPrevLoading(false)
        })
    } else {
      setPrevActivities([])
      setWeeklyTargets([])
      primaryFetch
        .then((json) => {
          if (json.success) setActivities(json.data)
          else setError(json.message ?? 'Failed to load analytics data')
        })
        .catch(() => setError('Network error. Please try again.'))
        .finally(() => setLoading(false))
    }
  }, [dateRange])

  const rangeLength = dateRange
    ? Math.round(
        (new Date(dateRange.endDate + 'T00:00:00.000Z') - new Date(dateRange.startDate + 'T00:00:00.000Z')) /
          86400000
      )
    : -1
  const isWeekRange = rangeLength === 6

  const hasData = activities.length > 0

  const summary = hasData ? computeSummary(activities) : null
  const mainCategoryData = hasData ? aggregateByMainCategory(activities) : []
  const subCategoryData = hasData ? aggregateBySubCategory(activities) : []
  const dailyData = hasData ? aggregateByDate(activities) : []

  const longestActivity = hasData ? computeLongestActivity(activities) : null
  const avgSessionMinutes = hasData ? Math.round(summary.totalMinutes / summary.totalActivities) : 0

  const prevMainCategoryData = prevActivities.length > 0 ? aggregateByMainCategory(prevActivities) : []
  const comparisonData = isWeekRange ? buildComparisonData(mainCategoryData, prevMainCategoryData) : []
  const currentTotal = mainCategoryData.reduce((s, d) => s + d.totalMinutes, 0)
  const prevTotal = prevMainCategoryData.reduce((s, d) => s + d.totalMinutes, 0)
  const totalDelta = currentTotal - prevTotal

  const weekHighlights = isWeekRange && prevActivities.length > 0
    ? computeWeekHighlights(comparisonData)
    : null

  const targetRows = isWeekRange ? computeTargetRows(weeklyTargets, mainCategoryData) : []

  const tooltipStyle = { fontSize: 12, border: '1px solid #e4e4e7', borderRadius: 6 }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
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
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <SummaryCard
              label="Total Time"
              value={formatMinutes(summary.totalMinutes)}
              icon={Clock}
              sublabel={
                summary.activeDays > 1
                  ? `${formatMinutes(Math.round(summary.totalMinutes / summary.activeDays))}/day avg`
                  : undefined
              }
            />
            <SummaryCard
              label="Activities"
              value={summary.totalActivities}
              icon={Activity}
              sublabel={
                summary.activeDays > 1
                  ? `${(summary.totalActivities / summary.activeDays).toFixed(1)}/day avg`
                  : undefined
              }
            />
            <SummaryCard
              label="Active Days"
              value={summary.activeDays}
              icon={Calendar}
            />
          </div>

          {/* Insights Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <SummaryCard
              label="Most Active"
              value={mainCategoryData[0].name}
              icon={TrendingUp}
              sublabel={`${formatMinutes(mainCategoryData[0].totalMinutes)} · ${Math.round((mainCategoryData[0].totalMinutes / summary.totalMinutes) * 100)}% of total`}
            />
            <SummaryCard
              label="Avg Session"
              value={formatMinutes(avgSessionMinutes)}
              icon={Timer}
              sublabel="per activity"
            />
            <SummaryCard
              label="Longest Session"
              value={formatMinutes(longestActivity.durationMinutes)}
              icon={Zap}
              sublabel={longestActivity.title}
            />
          </div>

          {/* Week-over-Week Comparison */}
          {isWeekRange && (
            <div className="bg-white border border-zinc-200 rounded-lg p-5">
              <div className="flex items-start justify-between mb-1">
                <h2 className="text-sm font-semibold text-zinc-900">Week-over-Week Comparison</h2>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="flex items-center gap-1.5 text-xs text-zinc-500">
                    <span className="inline-block w-3 h-2 rounded-sm bg-blue-600" />
                    This Period
                  </span>
                  <span className="flex items-center gap-1.5 text-xs text-zinc-500">
                    <span className="inline-block w-3 h-2 rounded-sm bg-zinc-300" />
                    Prior Period
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-3 text-sm text-zinc-600">
                <span>
                  This period:{' '}
                  <span className="font-medium text-zinc-800">{formatMinutes(currentTotal)}</span>
                </span>
                <span className="text-zinc-300">|</span>
                <span>
                  Prior period:{' '}
                  <span className="font-medium text-zinc-800">{formatMinutes(prevTotal)}</span>
                </span>
                {totalDelta !== 0 && (
                  <span
                    className={`text-xs font-medium rounded px-1.5 py-0.5 border ${
                      totalDelta > 0
                        ? 'text-emerald-600 bg-emerald-50 border-emerald-200'
                        : 'text-rose-600 bg-rose-50 border-rose-200'
                    }`}
                  >
                    <span aria-label={totalDelta > 0 ? 'increased' : 'decreased'}>{totalDelta > 0 ? '▲' : '▼'}</span> {formatMinutes(Math.abs(totalDelta))}
                  </span>
                )}
              </div>

              {/* Week-over-Week Highlights */}
              {weekHighlights && (
                <div className="flex flex-wrap gap-2 mb-4">
                  {weekHighlights.biggestGain.current - weekHighlights.biggestGain.previous > 0 && (
                    <span className="flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-3 py-1">
                      <span aria-label="increased">▲</span>
                      <span>Biggest gain: <strong>{weekHighlights.biggestGain.name}</strong></span>
                      <span className="text-emerald-500">
                        +{formatMinutes(weekHighlights.biggestGain.current - weekHighlights.biggestGain.previous)}
                      </span>
                    </span>
                  )}
                  {weekHighlights.biggestDrop.current - weekHighlights.biggestDrop.previous < 0 && (
                    <span className="flex items-center gap-1.5 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-full px-3 py-1">
                      <span aria-label="decreased">▼</span>
                      <span>Biggest drop: <strong>{weekHighlights.biggestDrop.name}</strong></span>
                      <span className="text-rose-500">
                        -{formatMinutes(weekHighlights.biggestDrop.previous - weekHighlights.biggestDrop.current)}
                      </span>
                    </span>
                  )}
                </div>
              )}

              {prevLoading ? (
                <LoadingState />
              ) : comparisonData.length === 0 ? (
                <p className="text-sm text-zinc-400 py-8 text-center">No data to compare.</p>
              ) : (
                <ResponsiveContainer
                  width="100%"
                  height={Math.max(200, comparisonData.length * 56)}
                >
                  <BarChart
                    layout="vertical"
                    data={comparisonData}
                    margin={{ left: 8, right: 24, top: 4, bottom: 4 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" />
                    <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 12 }} />
                    <XAxis
                      type="number"
                      tickFormatter={(v) => formatMinutes(v)}
                      tick={{ fontSize: 11 }}
                    />
                    <Tooltip
                      formatter={(v, name) => [formatMinutes(v), name]}
                      contentStyle={tooltipStyle}
                    />
                    <Bar dataKey="current" name="This Period" fill="#2563eb" radius={[0, 3, 3, 0]} />
                    <Bar dataKey="previous" name="Prior Period" fill="#d4d4d8" radius={[0, 3, 3, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          )}

          {/* Target vs Actual */}
          {isWeekRange && (
            <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
              <div className="px-5 py-4 border-b border-zinc-100">
                <h2 className="text-sm font-semibold text-zinc-900">Target vs Actual</h2>
                <p className="text-xs text-zinc-500 mt-0.5">Weekly target progress by main category</p>
              </div>
              {targetRows.length === 0 ? (
                <p className="text-sm text-zinc-400 px-5 py-8 text-center">
                  No weekly targets set for this period.
                </p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-zinc-50 border-b border-zinc-100">
                    <tr className="text-left text-xs text-zinc-500 uppercase tracking-wide">
                      <th scope="col" className="px-5 py-3 font-medium">Category</th>
                      <th scope="col" className="px-5 py-3 font-medium hidden sm:table-cell">Target</th>
                      <th scope="col" className="px-5 py-3 font-medium">Actual</th>
                      <th scope="col" className="px-5 py-3 font-medium hidden md:table-cell">Progress</th>
                      <th scope="col" className="px-5 py-3 font-medium text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {targetRows.map((row) => {
                      const status = getStatusBadge(row.pct)
                      const barWidth = Math.min(row.pct, 100)
                      return (
                        <tr key={row.name} className="border-b border-zinc-50 last:border-0">
                          <td className="px-5 py-3.5 text-zinc-800 font-medium">{row.name}</td>
                          <td className="px-5 py-3.5 text-zinc-500 hidden sm:table-cell">
                            {formatMinutes(row.targetMinutes)}
                          </td>
                          <td className="px-5 py-3.5 text-zinc-800 font-semibold">
                            {formatMinutes(row.spentMinutes)}
                          </td>
                          <td className="px-5 py-3.5 hidden md:table-cell">
                            <div className="flex items-center gap-2">
                              <div
                                role="progressbar"
                                aria-valuenow={barWidth}
                                aria-valuemin={0}
                                aria-valuemax={100}
                                aria-label={`${row.name} progress`}
                                className="flex-1 bg-zinc-100 rounded-full h-1.5 max-w-[120px]"
                              >
                                <div
                                  className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
                                  style={{ width: `${barWidth}%` }}
                                />
                              </div>
                              <span className="text-xs text-zinc-500 w-9 shrink-0">{row.pct}%</span>
                            </div>
                          </td>
                          <td className="px-5 py-3.5 text-right">
                            <span className={`text-xs rounded px-1.5 py-0.5 ${status.cls}`}>
                              {status.label}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* Time by Main Category */}
          <div className="bg-white border border-zinc-200 rounded-lg p-5">
            <h2 className="text-sm font-semibold text-zinc-900 mb-4">Time by Main Category</h2>
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
                  <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={100}
                    tick={{ fontSize: 12 }}
                  />
                  <XAxis
                    type="number"
                    tickFormatter={(v) => formatMinutes(v)}
                    tick={{ fontSize: 11 }}
                  />
                  <Tooltip
                    formatter={(v) => [
                      `${formatMinutes(v)} (${Math.round((v / summary.totalMinutes) * 100)}%)`,
                      'Time Spent',
                    ]}
                    contentStyle={tooltipStyle}
                  />
                  <Bar dataKey="totalMinutes" fill="#2563eb" radius={[0, 3, 3, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Daily Trend */}
          {dailyData.length >= 2 && (
            <div className="bg-white border border-zinc-200 rounded-lg p-5">
              <h2 className="text-sm font-semibold text-zinc-900 mb-4">Daily Trend</h2>
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
                    formatter={(v) => [formatMinutes(v), 'Time Spent']}
                    labelFormatter={formatAxisDate}
                    contentStyle={tooltipStyle}
                  />
                  <Line
                    type="monotone"
                    dataKey="totalMinutes"
                    stroke="#2563eb"
                    strokeWidth={2}
                    dot={dailyData.length <= 14 ? { r: 3, fill: '#2563eb' } : false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Top Sub Categories */}
          <div className="bg-white border border-zinc-200 rounded-lg p-5">
            <h2 className="text-sm font-semibold text-zinc-900 mb-4">Top Sub Categories</h2>
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
                  <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={120}
                    tick={{ fontSize: 12 }}
                  />
                  <XAxis
                    type="number"
                    tickFormatter={(v) => formatMinutes(v)}
                    tick={{ fontSize: 11 }}
                  />
                  <Tooltip
                    formatter={(v) => [formatMinutes(v), 'Time Spent']}
                    labelFormatter={(label) => {
                      const entry = subCategoryData.find((d) => d.name === label)
                      return entry ? `${label} (${entry.mainName})` : label
                    }}
                    contentStyle={tooltipStyle}
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
