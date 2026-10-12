// Pure, deterministic weekly report calculations. No Prisma, no I/O.
// Everything here is a FACT calculated by TimeLedger; interpretation is left to the LLM later.

// Share of target at or above which an unmet target counts as "near_target".
export const NEAR_TARGET_RATIO = 0.75
const TOP_CHANGES = 3

export function percentChange(current, previous) {
  if (!previous) return null
  return Math.round(((current - previous) / previous) * 100)
}

function percentOf(part, whole) {
  return whole > 0 ? Math.round((part / whole) * 100) : null
}

// Exact-minute comparison (not the rounded percent):
//   actual > target           -> exceeded
//   actual === target         -> achieved
//   actual >= 75% of target   -> near_target
//   otherwise                 -> below_target
export function getTargetStatus(actualMinutes, targetMinutes) {
  if (actualMinutes > targetMinutes) return 'exceeded'
  if (actualMinutes === targetMinutes) return 'achieved'
  if (actualMinutes >= targetMinutes * NEAR_TARGET_RATIO) return 'near_target'
  return 'below_target'
}

// Only explicit, positive targets are analytical targets; missing or 0 -> null.
export function computeTargetMetrics(targetMinutes, actualMinutes) {
  if (!targetMinutes || targetMinutes <= 0) return null
  return {
    targetMinutes,
    actualMinutes,
    achievementPercent: Math.round((actualMinutes / targetMinutes) * 100),
    deviationMinutes: actualMinutes - targetMinutes,
    status: getTargetStatus(actualMinutes, targetMinutes),
  }
}

const emptyWeek = () => ({ minutes: 0, activities: 0 })

function weekTotals(entries, key) {
  return entries.reduce(
    (sum, e) => ({ minutes: sum.minutes + e[key].minutes, activities: sum.activities + e[key].activities }),
    emptyWeek()
  )
}

// Sums sub-category summary rows into the per-main map (with nested subs) for one week.
function rollupWeek(summaries, mainTotals, weekKey) {
  const dates = new Set()
  for (const s of summaries) {
    dates.add(s.summaryDate)
    const sub = s.subCategory
    const main = mainTotals.get(sub.mainCategoryId) ?? {
      mainCategoryId: sub.mainCategoryId,
      name: sub.mainCategory.name,
      report: emptyWeek(),
      prior: emptyWeek(),
      subs: new Map(),
    }
    mainTotals.set(sub.mainCategoryId, main)
    const subEntry = main.subs.get(s.subCategoryId) ?? {
      subCategoryId: s.subCategoryId,
      name: sub.name,
      report: emptyWeek(),
      prior: emptyWeek(),
    }
    main.subs.set(s.subCategoryId, subEntry)
    for (const target of [main[weekKey], subEntry[weekKey]]) {
      target.minutes += s.totalMinutes
      target.activities += s.totalActivities
    }
  }
  return dates.size
}

const byNameThenId = (a, b) => a.name.localeCompare(b.name) || a.id - b.id

function rankChanges(items) {
  const changed = items.filter((i) => i.changeMinutes !== 0)
  const increases = changed.filter((i) => i.changeMinutes > 0)
  const decreases = changed.filter((i) => i.changeMinutes < 0)
  return {
    largestIncreases: increases
      .sort((a, b) => b.changeMinutes - a.changeMinutes || byNameThenId(a, b))
      .slice(0, TOP_CHANGES),
    largestDecreases: decreases
      .sort((a, b) => a.changeMinutes - b.changeMinutes || byNameThenId(a, b))
      .slice(0, TOP_CHANGES),
  }
}

const change = (report, prior) => ({
  minutes: report.minutes - prior.minutes,
  percent: percentChange(report.minutes, prior.minutes),
})

// summaries: [{ summaryDate: 'YYYY-MM-DD', subCategoryId, totalMinutes, totalActivities,
//               subCategory: { name, mainCategoryId, mainCategory: { name } } }]
// targets:   [{ weekStartDate: 'YYYY-MM-DD', mainCategoryId, targetMinutes, mainCategory: { name } }]
// periods:   { report: { weekStartDate, weekEndDate }, prior: { weekStartDate, weekEndDate } }
export function buildWeeklyReportData({ summaries, targets, periods, timezone }) {
  const inWeek = (date, period) => date >= period.weekStartDate && date <= period.weekEndDate
  const reportRows = summaries.filter((s) => inWeek(s.summaryDate, periods.report))
  const priorRows = summaries.filter((s) => inWeek(s.summaryDate, periods.prior))

  const mainTotals = new Map()
  const reportActiveDays = rollupWeek(reportRows, mainTotals, 'report')
  const priorActiveDays = rollupWeek(priorRows, mainTotals, 'prior')

  const targetFor = (mainCategoryId, period) =>
    targets.find((t) => t.mainCategoryId === mainCategoryId && t.weekStartDate === period.weekStartDate)

  // A main category with a target but no activity in either week still belongs in the report.
  for (const t of targets) {
    if (!mainTotals.has(t.mainCategoryId)) {
      mainTotals.set(t.mainCategoryId, {
        mainCategoryId: t.mainCategoryId,
        name: t.mainCategory.name,
        report: emptyWeek(),
        prior: emptyWeek(),
        subs: new Map(),
      })
    }
  }

  const totals = {
    report: { ...weekTotals([...mainTotals.values()], 'report'), activeDays: reportActiveDays },
    prior: { ...weekTotals([...mainTotals.values()], 'prior'), activeDays: priorActiveDays },
  }

  const mainCategories = [...mainTotals.values()]
    .filter((m) => m.report.minutes || m.prior.minutes || targetFor(m.mainCategoryId, periods.report) || targetFor(m.mainCategoryId, periods.prior))
    .sort((a, b) => b.report.minutes - a.report.minutes || byNameThenId({ name: a.name, id: a.mainCategoryId }, { name: b.name, id: b.mainCategoryId }))
    .map((m) => {
      const targetOf = (period, week) => {
        const t = targetFor(m.mainCategoryId, period)
        return computeTargetMetrics(t?.targetMinutes, m[week].minutes)
      }
      return {
        mainCategoryId: m.mainCategoryId,
        name: m.name,
        report: { ...m.report, sharePercent: percentOf(m.report.minutes, totals.report.minutes) },
        prior: { ...m.prior, sharePercent: percentOf(m.prior.minutes, totals.prior.minutes) },
        change: change(m.report, m.prior),
        target: { report: targetOf(periods.report, 'report'), prior: targetOf(periods.prior, 'prior') },
        subCategories: [...m.subs.values()]
          .sort((a, b) => b.report.minutes - a.report.minutes || byNameThenId({ name: a.name, id: a.subCategoryId }, { name: b.name, id: b.subCategoryId }))
          .map((s) => ({
            subCategoryId: s.subCategoryId,
            name: s.name,
            report: s.report,
            prior: s.prior,
            change: change(s.report, s.prior),
          })),
      }
    })

  const mainChanges = mainCategories.map((m) => ({
    id: m.mainCategoryId,
    name: m.name,
    changeMinutes: m.change.minutes,
    changePercent: m.change.percent,
  }))
  const subChanges = mainCategories.flatMap((m) =>
    m.subCategories.map((s) => ({
      id: s.subCategoryId,
      name: s.name,
      mainName: m.name,
      changeMinutes: s.change.minutes,
      changePercent: s.change.percent,
    }))
  )

  return {
    schemaVersion: 1,
    facts: {
      timezone,
      periods,
      totals: { ...totals, change: change(totals.report, totals.prior) },
      mainCategories,
      highlights: {
        mainCategories: rankChanges(mainChanges),
        subCategories: rankChanges(subChanges),
      },
    },
  }
}
