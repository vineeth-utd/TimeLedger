import prisma from '@/lib/prisma'
import { ServiceError } from '@/lib/errors'
import {
  addDaysToDateString,
  dateOnlyToString,
  getWeekStartMondayForDate,
  isValidTimeZone,
  utcToLocalDateTime,
} from '@/lib/timezone'
import { buildWeeklyReportData } from '@/lib/analytics/reportMetrics'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const toDbDate = (dateString) => new Date(`${dateString}T00:00:00.000Z`)

function weekPeriod(weekStartDate) {
  return { weekStartDate, weekEndDate: addDaysToDateString(weekStartDate, 6) }
}

// The report week is the latest completed Monday–Sunday week in the user's timezone
// (the week before the one containing "today"), unless an explicit Monday is given.
export function resolveReportPeriods({ timezone, now, weekStartDate }) {
  if (!isValidTimeZone(timezone)) {
    throw new ServiceError('VALIDATION_ERROR', 'A valid IANA timezone is required')
  }
  let reportStart = weekStartDate
  if (reportStart === undefined) {
    const today = utcToLocalDateTime(now, timezone).date
    reportStart = addDaysToDateString(getWeekStartMondayForDate(today), -7)
  } else if (
    !DATE_RE.test(reportStart) ||
    Number.isNaN(toDbDate(reportStart).getTime()) ||
    getWeekStartMondayForDate(reportStart) !== reportStart
  ) {
    throw new ServiceError('VALIDATION_ERROR', 'weekStartDate must be a Monday in YYYY-MM-DD format')
  }
  return {
    report: weekPeriod(reportStart),
    prior: weekPeriod(addDaysToDateString(reportStart, -7)),
  }
}

// Compact deterministic two-week report dataset for one user, built from the daily sub category
// summaries and explicit weekly targets. Never reads raw activities.
export async function getWeeklyReportData(
  userId,
  { timezone, now = new Date(), weekStartDate, db = prisma } = {}
) {
  if (!userId || typeof userId !== 'string') {
    throw new ServiceError('VALIDATION_ERROR', 'userId is required')
  }
  const periods = resolveReportPeriods({ timezone, now, weekStartDate })

  const [summaries, targets] = await Promise.all([
    db.dailySubCategorySummary.findMany({
      where: {
        userId,
        summaryDate: { gte: toDbDate(periods.prior.weekStartDate), lte: toDbDate(periods.report.weekEndDate) },
      },
      include: { subCategory: { select: { name: true, mainCategoryId: true, mainCategory: { select: { name: true } } } } },
    }),
    db.weeklyTarget.findMany({
      where: {
        userId,
        weekStartDate: { in: [toDbDate(periods.prior.weekStartDate), toDbDate(periods.report.weekStartDate)] },
      },
      include: { mainCategory: { select: { name: true } } },
    }),
  ])

  return buildWeeklyReportData({
    summaries: summaries.map((s) => ({ ...s, summaryDate: dateOnlyToString(s.summaryDate) })),
    targets: targets.map((t) => ({ ...t, weekStartDate: dateOnlyToString(t.weekStartDate) })),
    periods,
    timezone,
  })
}
