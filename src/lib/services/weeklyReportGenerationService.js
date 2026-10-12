import prisma from '@/lib/prisma'
import { ServiceError, isUniqueViolation } from '@/lib/errors'
import { generateReportContent } from '@/lib/ai/report/generateReportContent'
import { REPORT_ERROR, ReportGenerationError } from '@/lib/ai/report/reportSchema'
import { WEEKLY_REPORT_STATUS } from '@/lib/analytics/reportStatus'
import { getWeeklyReportData, resolveReportPeriods } from '@/lib/services/weeklyReportService'

const toDbDate = (dateString) => new Date(`${dateString}T00:00:00.000Z`)

const inProgress = () => new ServiceError('REPORT_IN_PROGRESS', 'A report for this week is already being generated', 409)

// Acquires the (user, week) row as `generating`. The unique (user_id, week_start_date) constraint
// is the claim: only one caller can insert. An existing row is never overwritten here:
//   completed  -> REPORT_EXISTS (M3 never regenerates a completed report)
//   generating -> REPORT_IN_PROGRESS (lease/stale-claim recovery belongs to the scheduler milestone)
//   failed     -> one conditional re-claim for a manual rerun
async function claimReport(db, userId, weekStartDate) {
  const weekDate = toDbDate(weekStartDate)
  try {
    return await db.weeklyReport.create({
      data: {
        userId,
        weekStartDate: weekDate,
        status: WEEKLY_REPORT_STATUS.GENERATING,
        attemptCount: 1,
        generationStartedAt: new Date(),
      },
    })
  } catch (error) {
    if (!isUniqueViolation(error)) throw error
  }

  const existing = await db.weeklyReport.findUnique({
    where: { userId_weekStartDate: { userId, weekStartDate: weekDate } },
  })
  if (!existing || existing.status === WEEKLY_REPORT_STATUS.GENERATING) throw inProgress()
  if (existing.status === WEEKLY_REPORT_STATUS.COMPLETED) {
    throw new ServiceError('REPORT_EXISTS', 'A completed report already exists for this week', 409)
  }

  const { count } = await db.weeklyReport.updateMany({
    where: { id: existing.id, userId, status: WEEKLY_REPORT_STATUS.FAILED },
    data: {
      status: WEEKLY_REPORT_STATUS.GENERATING,
      attemptCount: { increment: 1 },
      generationStartedAt: new Date(),
      errorCode: null,
    },
  })
  if (count === 0) throw inProgress()
  return existing
}

// Best effort: if even this fails the row stays `generating` (recovered by a later milestone).
async function markFailed(db, report, errorCode) {
  try {
    await db.weeklyReport.updateMany({
      where: { id: report.id, userId: report.userId, status: WEEKLY_REPORT_STATUS.GENERATING },
      data: { status: WEEKLY_REPORT_STATUS.FAILED, errorCode },
    })
  } catch (error) {
    console.error(`weekly report ${report.id}: could not record failure (${error?.name})`)
  }
}

function toErrorCode(error) {
  return error instanceof ReportGenerationError ? error.code : REPORT_ERROR.INTERNAL
}

// Manual / development entry point for one user's weekly report (no scheduling, no preference
// check). Order: claim the (user, week) row, then compute the M1 facts, then call the model, then
// persist facts + content in one conditional update. A failure never leaves a `completed` row and
// stores only a safe errorCode. Precondition problems throw ServiceError; generation outcomes
// (including failures) are returned.
export async function generateWeeklyReport(
  userId,
  { timezone, now = new Date(), weekStartDate, model, db = prisma } = {}
) {
  if (!userId || typeof userId !== 'string') {
    throw new ServiceError('VALIDATION_ERROR', 'userId is required')
  }
  const periods = resolveReportPeriods({ timezone, now, weekStartDate })
  const reportWeek = periods.report.weekStartDate

  const report = await claimReport(db, userId, reportWeek)
  const failure = async (error) => {
    const errorCode = toErrorCode(error)
    console.error(`weekly report ${report.id}: generation failed (${errorCode})`)
    await markFailed(db, report, errorCode)
    return { success: false, reportId: report.id, status: WEEKLY_REPORT_STATUS.FAILED, weekStartDate: reportWeek, errorCode }
  }

  let reportData
  let content
  try {
    reportData = await getWeeklyReportData(userId, { timezone, now, weekStartDate: reportWeek, db })
    content = await generateReportContent({ reportData, model })
  } catch (error) {
    return failure(error)
  }

  try {
    const { count } = await db.weeklyReport.updateMany({
      where: { id: report.id, userId, status: WEEKLY_REPORT_STATUS.GENERATING },
      data: {
        status: WEEKLY_REPORT_STATUS.COMPLETED,
        facts: reportData,
        content,
        generatedAt: new Date(),
        errorCode: null,
      },
    })
    if (count === 0) {
      throw new ServiceError('REPORT_STATE_CONFLICT', 'The report was changed by another process', 409)
    }
  } catch (error) {
    if (error instanceof ServiceError) throw error
    return failure(error)
  }
  return {
    success: true,
    reportId: report.id,
    status: WEEKLY_REPORT_STATUS.COMPLETED,
    weekStartDate: reportWeek,
    kind: content.kind,
  }
}
