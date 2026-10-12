// Deterministic, no-network, no-database checks for the weekly report data foundation
// (Phase 11, Milestone 1): week resolution, rollups, change math, target metrics/status
// thresholds, highlights, user scoping and determinism.
//
//   node scripts/weekly-report-check.mjs
import assert from 'node:assert/strict'
import { register } from 'node:module'

register('./ai-eval-loader.mjs', import.meta.url)
process.env.DATABASE_URL ??= 'postgresql://unused:unused@localhost:5432/unused' // never connected

const { getWeekStartMondayForDate } = await import('@/lib/timezone.js')
const { buildWeeklyReportData, computeTargetMetrics, getTargetStatus, percentChange } =
  await import('@/lib/analytics/reportMetrics.js')
const { getWeeklyReportData, resolveReportPeriods } = await import('@/lib/services/weeklyReportService.js')

let passed = 0
const check = async (name, fn) => {
  await fn()
  passed += 1
  console.log(`ok - ${name}`)
}

// --- fixtures: report week 2026-10-05..11, prior week 2026-09-28..10-04 ---
const periods = {
  report: { weekStartDate: '2026-10-05', weekEndDate: '2026-10-11' },
  prior: { weekStartDate: '2026-09-28', weekEndDate: '2026-10-04' },
}
const sub = (id, name, mainId, mainName) => ({ name, mainCategoryId: mainId, mainCategory: { name: mainName }, id })
const SUBS = {
  coding: sub(1, 'Coding', 10, 'Work'),
  meetings: sub(2, 'Meetings', 10, 'Work'),
  gym: sub(3, 'Gym', 20, 'Health'),
  reading: sub(4, 'Reading', 30, 'Learning'),
}
const row = (summaryDate, s, totalMinutes, totalActivities = 1) => ({
  summaryDate,
  subCategoryId: s.id,
  totalMinutes,
  totalActivities,
  subCategory: s,
})
const summaries = [
  row('2026-10-05', SUBS.coding, 120, 2),
  row('2026-10-06', SUBS.coding, 60),
  row('2026-10-06', SUBS.meetings, 30),
  row('2026-10-07', SUBS.gym, 45),
  row('2026-09-28', SUBS.coding, 100),
  row('2026-09-29', SUBS.meetings, 80, 2),
  row('2026-09-30', SUBS.gym, 90, 2),
  row('2026-10-02', SUBS.reading, 30), // prior-only category
  row('2026-10-12', SUBS.coding, 999), // outside both weeks: must be ignored
]
const target = (weekStartDate, mainCategoryId, name, targetMinutes) => ({
  weekStartDate,
  mainCategoryId,
  targetMinutes,
  mainCategory: { name },
})
const targets = [
  target('2026-10-05', 10, 'Work', 180), // actual 210 -> exceeded
  target('2026-09-28', 10, 'Work', 180), // actual 180 -> achieved
  target('2026-10-05', 20, 'Health', 60), // actual 45 -> near_target (75%)
  target('2026-10-05', 40, 'Sleep', 100), // no activity at all -> below_target, still listed
  target('2026-10-05', 30, 'Learning', 0), // zero target -> null
]
const build = (overrides = {}) => buildWeeklyReportData({ summaries, targets, periods, timezone: 'UTC', ...overrides })
const main = (data, name) => data.facts.mainCategories.find((m) => m.name === name)

await check('week start: Monday of containing week', () => {
  assert.equal(getWeekStartMondayForDate('2026-10-11'), '2026-10-05') // Sunday
  assert.equal(getWeekStartMondayForDate('2026-10-05'), '2026-10-05') // Monday
  assert.equal(getWeekStartMondayForDate('2026-10-07'), '2026-10-05')
  assert.equal(getWeekStartMondayForDate('2026-01-01'), '2025-12-29') // year boundary
})

await check('periods: last two completed weeks in the user timezone', () => {
  const at = (iso, timezone) => resolveReportPeriods({ timezone, now: new Date(iso) })
  // Wed 2026-10-14 -> report week is 10-05..10-11, prior 09-28..10-04
  assert.deepEqual(at('2026-10-14T12:00:00Z', 'UTC'), periods)
  // Sunday 23:30 Phoenix (UTC-7) is already Monday in UTC: Phoenix still in the older week
  assert.equal(at('2026-10-19T06:30:00Z', 'America/Phoenix').report.weekStartDate, '2026-10-05')
  assert.equal(at('2026-10-19T06:30:00Z', 'UTC').report.weekStartDate, '2026-10-12')
  // DST end week (US 2026-11-01) and year boundary
  assert.equal(at('2026-11-04T12:00:00Z', 'America/New_York').report.weekStartDate, '2026-10-26')
  const ny = at('2027-01-05T12:00:00Z', 'America/New_York')
  assert.deepEqual([ny.report.weekStartDate, ny.report.weekEndDate], ['2026-12-28', '2027-01-03'])
  assert.equal(ny.prior.weekStartDate, '2026-12-21')
})

await check('periods: override must be a Monday; invalid timezone rejected', () => {
  const ok = resolveReportPeriods({ timezone: 'UTC', now: new Date(), weekStartDate: '2026-10-05' })
  assert.deepEqual(ok, periods)
  for (const bad of ['2026-10-06', 'nope', '2026-13-01']) {
    assert.throws(() => resolveReportPeriods({ timezone: 'UTC', now: new Date(), weekStartDate: bad }), { code: 'VALIDATION_ERROR' })
  }
  assert.throws(() => resolveReportPeriods({ timezone: 'Not/AZone', now: new Date() }), { code: 'VALIDATION_ERROR' })
})

await check('rollup: main totals equal sum of subs; activities and activeDays', () => {
  const data = build()
  const work = main(data, 'Work')
  assert.deepEqual([work.report.minutes, work.report.activities], [210, 4])
  assert.equal(work.subCategories.reduce((s, x) => s + x.report.minutes, 0), work.report.minutes)
  assert.equal(work.prior.minutes, 180)
  assert.deepEqual(data.facts.totals.report, { minutes: 255, activities: 5, activeDays: 3 })
  assert.deepEqual(data.facts.totals.prior, { minutes: 300, activities: 6, activeDays: 4 })
  assert.deepEqual(data.facts.totals.change, { minutes: -45, percent: -15 })
  assert.equal(work.report.sharePercent, 82) // 210/255
})

await check('change math: absolute, percent, null when prior is 0', () => {
  assert.equal(percentChange(150, 100), 50)
  assert.equal(percentChange(50, 100), -50)
  assert.equal(percentChange(10, 0), null)
  const data = build()
  const learning = main(data, 'Learning')
  assert.deepEqual(learning.change, { minutes: -30, percent: -100 })
  const gym = main(data, 'Health').subCategories[0]
  assert.deepEqual(gym.change, { minutes: -45, percent: -50 })
})

await check('target status thresholds (exact minutes)', () => {
  assert.equal(getTargetStatus(101, 100), 'exceeded')
  assert.equal(getTargetStatus(100, 100), 'achieved')
  assert.equal(getTargetStatus(99, 100), 'near_target') // 99%: not "achieved" even though rounds near 100
  assert.equal(getTargetStatus(75, 100), 'near_target') // boundary: exactly 75%
  assert.equal(getTargetStatus(74, 100), 'below_target')
  assert.equal(getTargetStatus(0, 100), 'below_target')
  assert.equal(getTargetStatus(3, 4), 'near_target')
  assert.equal(getTargetStatus(299, 400), 'below_target') // 74.75% rounds to 75 but is below
})

await check('target metrics: missing/zero target is null, deviation signed', () => {
  assert.equal(computeTargetMetrics(undefined, 50), null)
  assert.equal(computeTargetMetrics(0, 50), null)
  assert.deepEqual(computeTargetMetrics(60, 45), {
    targetMinutes: 60,
    actualMinutes: 45,
    achievementPercent: 75,
    deviationMinutes: -15,
    status: 'near_target',
  })
  const data = build()
  const work = main(data, 'Work')
  assert.equal(work.target.report.status, 'exceeded')
  assert.equal(work.target.report.deviationMinutes, 30)
  assert.equal(work.target.prior.status, 'achieved')
  assert.equal(main(data, 'Health').target.report.status, 'near_target')
  assert.equal(main(data, 'Health').target.prior, null) // explicit targets only: no fallback
  assert.equal(main(data, 'Learning').target.report, null) // zero target
  const sleep = main(data, 'Sleep')
  assert.equal(sleep.target.report.status, 'below_target')
  assert.equal(sleep.report.minutes, 0)
})

await check('highlights: ordering, tie-break, zero excluded, fewer than 3', () => {
  const data = build()
  const { mainCategories, subCategories } = data.facts.highlights
  assert.deepEqual(mainCategories.largestIncreases.map((x) => x.name), ['Work']) // Work 210-180=+30
  assert.deepEqual(mainCategories.largestDecreases.map((x) => x.name), ['Health', 'Learning'])
  assert.ok(subCategories.largestIncreases.length <= 3 && subCategories.largestDecreases.length <= 3)
  const tied = buildWeeklyReportData({
    summaries: [
      row('2026-10-05', SUBS.reading, 50),
      row('2026-10-05', SUBS.gym, 50),
      row('2026-09-28', SUBS.coding, 0),
    ],
    targets: [],
    periods,
    timezone: 'UTC',
  })
  assert.deepEqual(tied.facts.highlights.subCategories.largestIncreases.map((x) => x.name), ['Gym', 'Reading'])
  assert.deepEqual(tied.facts.highlights.subCategories.largestDecreases, [])
})

await check('empty data: valid structure, no NaN/Infinity', () => {
  const empty = buildWeeklyReportData({ summaries: [], targets: [], periods, timezone: 'UTC' })
  assert.deepEqual(empty.facts.mainCategories, [])
  assert.deepEqual(empty.facts.totals.change, { minutes: 0, percent: null })
  const oneSided = buildWeeklyReportData({ summaries: [row('2026-10-05', SUBS.coding, 60)], targets: [], periods, timezone: 'UTC' })
  assert.equal(oneSided.facts.mainCategories[0].change.percent, null)
  assert.doesNotMatch(JSON.stringify(empty) + JSON.stringify(oneSided), /NaN|Infinity/)
})

await check('service: user scoping, no userId or raw activity data in output', async () => {
  const calls = []
  const dbRows = (name) => async (args) => {
    calls.push({ name, where: args.where })
    return []
  }
  const db = { dailySubCategorySummary: { findMany: dbRows('summaries') }, weeklyTarget: { findMany: dbRows('targets') } }
  const out = await getWeeklyReportData('user-123', { timezone: 'UTC', now: new Date('2026-10-14T12:00:00Z'), db })
  assert.equal(calls.length, 2)
  for (const c of calls) assert.equal(c.where.userId, 'user-123')
  assert.equal(calls.find((c) => c.name === 'summaries').where.summaryDate.gte.toISOString(), '2026-09-28T00:00:00.000Z')
  assert.equal(calls.find((c) => c.name === 'summaries').where.summaryDate.lte.toISOString(), '2026-10-11T00:00:00.000Z')
  assert.doesNotMatch(JSON.stringify(out), /user-123|userId/)
  await assert.rejects(() => getWeeklyReportData('', { timezone: 'UTC', db }), { code: 'VALIDATION_ERROR' })
})

await check('service: maps DB rows and is deterministic', async () => {
  const asDate = (s) => new Date(`${s}T00:00:00.000Z`)
  const db = {
    dailySubCategorySummary: {
      findMany: async () => summaries.slice(0, 8).map((s) => ({ ...s, summaryDate: asDate(s.summaryDate) })),
    },
    weeklyTarget: {
      findMany: async () => targets.map((t) => ({ ...t, weekStartDate: asDate(t.weekStartDate) })),
    },
  }
  const opts = { timezone: 'UTC', now: new Date('2026-10-14T12:00:00Z'), db }
  const a = await getWeeklyReportData('u', opts)
  const b = await getWeeklyReportData('u', opts)
  assert.deepEqual(a, b)
  assert.deepEqual(a.facts, build({ summaries: summaries.slice(0, 8) }).facts)
  assert.doesNotMatch(JSON.stringify(a), /title|notes/)
})

console.log(`\n${passed} checks passed`)
process.exit(0)
