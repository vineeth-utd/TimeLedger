import prisma from '@/lib/prisma'
import { isValidTimeZone } from '@/lib/timezone'
import { resolveReportPeriods } from '@/lib/services/weeklyReportService'
import {
  generateWeeklyReport,
  MAX_SCHEDULED_ATTEMPTS,
  STALE_CLAIM_TIMEOUT_MS,
} from '@/lib/services/weeklyReportGenerationService'
import { WEEKLY_REPORT_STATUS } from '@/lib/analytics/reportStatus'
import { REPORT_ERROR } from '@/lib/ai/report/reportSchema'

export const DEFAULT_MAX_BATCH_SIZE = 3
export const DEFAULT_MAX_EXECUTION_MS = 45_000

const toDbDate = (dateString) => new Date(`${dateString}T00:00:00.000Z`)

// Returns users with Productivity Agent enabled and a valid timezone, along with their
// latest completed week (Monday YYYY-MM-DD) resolved in their local timezone.
export async function findEligibleScheduledUsers({ db = prisma, now = new Date() } = {}) {
  const rows = await db.userPreference.findMany({
    where: {
      productivityAgentEnabled: true,
      timezone: { not: null },
    },
    select: {
      userId: true,
      timezone: true,
    },
    orderBy: { id: 'asc' },
  })

  return rows
    .filter((row) => isValidTimeZone(row.timezone))
    .map((row) => {
      const periods = resolveReportPeriods({ timezone: row.timezone, now })
      return {
        userId: row.userId,
        timezone: row.timezone,
        weekStartDate: periods.report.weekStartDate,
      }
    })
}

// Orchestrates scheduled weekly report generation across eligible users.
// Catch-up semantics: once a completed week finishes in a user's timezone, it remains eligible
// until completed or until scheduled attempts are exhausted.
// Bounded execution: respects maxBatchSize and maxExecutionMs to remain safely within the
// serverless execution window.
export async function processScheduledWeeklyReports({
  db = prisma,
  now = new Date(),
  model,
  maxBatchSize = DEFAULT_MAX_BATCH_SIZE,
  maxExecutionMs = DEFAULT_MAX_EXECUTION_MS,
  maxScheduledAttempts = MAX_SCHEDULED_ATTEMPTS,
  staleTimeoutMs = STALE_CLAIM_TIMEOUT_MS,
} = {}) {
  const startTime = Date.now()
  const eligibleUsers = await findEligibleScheduledUsers({ db, now })

  const summary = {
    processed: 0,
    completed: 0,
    failed: 0,
    skipped: 0,
    attemptsExceeded: 0,
    details: [],
  }

  for (const user of eligibleUsers) {
    if (summary.processed >= maxBatchSize || Date.now() - startTime >= maxExecutionMs) {
      summary.skipped += 1
      summary.details.push({
        userId: user.userId,
        weekStartDate: user.weekStartDate,
        outcome: 'skipped',
        reason: 'batch_or_time_budget_exhausted',
      })
      continue
    }

    const existing = await db.weeklyReport.findUnique({
      where: {
        userId_weekStartDate: {
          userId: user.userId,
          weekStartDate: toDbDate(user.weekStartDate),
        },
      },
    })

    if (existing?.status === WEEKLY_REPORT_STATUS.COMPLETED) {
      summary.skipped += 1
      summary.details.push({
        userId: user.userId,
        weekStartDate: user.weekStartDate,
        outcome: 'skipped',
        reason: 'already_completed',
      })
      continue
    }

    if (existing?.status === WEEKLY_REPORT_STATUS.GENERATING) {
      const isStale = existing.generationStartedAt
        ? now.getTime() - new Date(existing.generationStartedAt).getTime() > staleTimeoutMs
        : false
      if (!isStale) {
        summary.skipped += 1
        summary.details.push({
          userId: user.userId,
          weekStartDate: user.weekStartDate,
          outcome: 'skipped',
          reason: 'in_progress',
        })
        continue
      }

      if (existing.attemptCount >= maxScheduledAttempts) {
        await db.weeklyReport.updateMany({
          where: { id: existing.id, userId: user.userId, status: WEEKLY_REPORT_STATUS.GENERATING },
          data: { status: WEEKLY_REPORT_STATUS.FAILED, errorCode: REPORT_ERROR.INTERNAL },
        })
        summary.attemptsExceeded += 1
        summary.details.push({
          userId: user.userId,
          weekStartDate: user.weekStartDate,
          outcome: 'exhausted',
          reason: 'max_attempts_exceeded',
        })
        continue
      }
    }

    if (existing?.status === WEEKLY_REPORT_STATUS.FAILED) {
      if (existing.attemptCount >= maxScheduledAttempts) {
        summary.attemptsExceeded += 1
        summary.details.push({
          userId: user.userId,
          weekStartDate: user.weekStartDate,
          outcome: 'exhausted',
          reason: 'max_attempts_exceeded',
        })
        continue
      }
    }

    summary.processed += 1
    try {
      const genResult = await generateWeeklyReport(user.userId, {
        timezone: user.timezone,
        now,
        weekStartDate: user.weekStartDate,
        model,
        db,
        maxAttempts: maxScheduledAttempts,
        staleTimeoutMs,
      })

      if (genResult.success) {
        summary.completed += 1
        summary.details.push({
          userId: user.userId,
          weekStartDate: user.weekStartDate,
          outcome: 'completed',
          kind: genResult.kind,
        })
      } else {
        summary.failed += 1
        summary.details.push({
          userId: user.userId,
          weekStartDate: user.weekStartDate,
          outcome: 'failed',
          errorCode: genResult.errorCode,
        })
      }
    } catch (error) {
      if (['REPORT_EXISTS', 'REPORT_IN_PROGRESS', 'REPORT_ATTEMPTS_EXCEEDED'].includes(error?.code)) {
        summary.skipped += 1
        summary.details.push({
          userId: user.userId,
          weekStartDate: user.weekStartDate,
          outcome: 'skipped',
          reason: error.code,
        })
      } else {
        summary.failed += 1
        summary.details.push({
          userId: user.userId,
          weekStartDate: user.weekStartDate,
          outcome: 'failed',
          errorCode: error?.code ?? REPORT_ERROR.INTERNAL,
        })
      }
    }
  }

  return {
    success: true,
    eligibleCount: eligibleUsers.length,
    ...summary,
    durationMs: Date.now() - startTime,
  }
}

