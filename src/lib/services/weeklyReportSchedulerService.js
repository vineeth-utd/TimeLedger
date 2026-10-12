import prisma from '@/lib/prisma'
import { isValidTimeZone } from '@/lib/timezone'
import { resolveReportPeriods } from '@/lib/services/weeklyReportService'
import {
  generateWeeklyReport,
  MAX_SCHEDULED_ATTEMPTS,
  STALE_CLAIM_TIMEOUT_MS,
} from '@/lib/services/weeklyReportGenerationService'
import {
  sendWeeklyReportEmail,
  MAX_SCHEDULED_EMAIL_ATTEMPTS,
  STALE_EMAIL_TIMEOUT_MS,
} from '@/lib/services/weeklyReportEmailService'
import { WEEKLY_REPORT_EMAIL_STATUS, WEEKLY_REPORT_STATUS } from '@/lib/analytics/reportStatus'
import { REPORT_ERROR } from '@/lib/ai/report/reportSchema'
import { EMAIL_ERROR, isRetryableEmailError } from '@/lib/email/emailErrors'

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
      weeklyEmailReportsEnabled: true,
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
        weeklyEmailReportsEnabled: row.weeklyEmailReportsEnabled,
        weekStartDate: periods.report.weekStartDate,
      }
    })
}

// Orchestrates scheduled weekly report generation and email delivery across eligible users.
// Catch-up semantics: once a completed week finishes in a user's timezone, it remains eligible
// until completed or until scheduled attempts are exhausted.
// Bounded execution: respects maxBatchSize and maxExecutionMs to remain safely within the
// serverless execution window.
export async function processScheduledWeeklyReports({
  db = prisma,
  now = new Date(),
  model,
  emailClient,
  adminClient,
  maxBatchSize = DEFAULT_MAX_BATCH_SIZE,
  maxExecutionMs = DEFAULT_MAX_EXECUTION_MS,
  maxScheduledAttempts = MAX_SCHEDULED_ATTEMPTS,
  staleTimeoutMs = STALE_CLAIM_TIMEOUT_MS,
  maxScheduledEmailAttempts = MAX_SCHEDULED_EMAIL_ATTEMPTS,
  staleEmailTimeoutMs = STALE_EMAIL_TIMEOUT_MS,
} = {}) {
  const startTime = Date.now()
  const eligibleUsers = await findEligibleScheduledUsers({ db, now })

  const summary = {
    processed: 0,
    completed: 0,
    failed: 0,
    skipped: 0,
    attemptsExceeded: 0,
    emailsSent: 0,
    emailsFailed: 0,
    emailsSkipped: 0,
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

    // If report is already completed, check if email delivery is still pending
    if (existing?.status === WEEKLY_REPORT_STATUS.COMPLETED) {
      if (user.weeklyEmailReportsEnabled) {
        const isEmailSent = existing.emailStatus === WEEKLY_REPORT_EMAIL_STATUS.SENT
        const isEmailExhausted =
          existing.emailStatus === WEEKLY_REPORT_EMAIL_STATUS.FAILED &&
          (existing.emailAttemptCount >= maxScheduledEmailAttempts ||
            existing.emailErrorCode === EMAIL_ERROR.UNKNOWN_OUTCOME ||
            !isRetryableEmailError(existing.emailErrorCode))
        const isEmailActive =
          existing.emailStatus === WEEKLY_REPORT_EMAIL_STATUS.SENDING &&
          now.getTime() - new Date(existing.emailSentAt ?? existing.updatedAt).getTime() <= staleEmailTimeoutMs

        if (isEmailSent || isEmailExhausted || isEmailActive) {
          summary.skipped += 1
          summary.details.push({
            userId: user.userId,
            weekStartDate: user.weekStartDate,
            outcome: 'skipped',
            reason: isEmailSent ? 'already_completed_and_sent' : 'already_completed',
          })
          continue
        }

        // Email delivery needed for existing completed report
        summary.processed += 1
        try {
          const emailResult = await sendWeeklyReportEmail(existing.id, {
            userId: user.userId,
            db,
            emailClient,
            adminClient,
            now,
            maxAttempts: maxScheduledEmailAttempts,
          })

          if (emailResult.success) {
            summary.emailsSent += 1
          } else {
            summary.emailsFailed += 1
          }
          summary.details.push({
            userId: user.userId,
            weekStartDate: user.weekStartDate,
            outcome: 'email_only',
            emailStatus: emailResult.emailStatus,
            errorCode: emailResult.errorCode ?? null,
          })
        } catch (emailError) {
          summary.emailsFailed += 1
          summary.details.push({
            userId: user.userId,
            weekStartDate: user.weekStartDate,
            outcome: 'email_failed',
            errorCode: emailError?.code ?? EMAIL_ERROR.INTERNAL,
          })
        }
        continue
      }

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
    let reportId = null
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
        reportId = genResult.reportId
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

    // If report generation succeeded and email reports are enabled, send email
    if (reportId && user.weeklyEmailReportsEnabled) {
      try {
        const emailResult = await sendWeeklyReportEmail(reportId, {
          userId: user.userId,
          db,
          emailClient,
          adminClient,
          now,
          maxAttempts: maxScheduledEmailAttempts,
        })
        if (emailResult.success) {
          summary.emailsSent += 1
        } else {
          summary.emailsFailed += 1
        }
      } catch {
        summary.emailsFailed += 1
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

