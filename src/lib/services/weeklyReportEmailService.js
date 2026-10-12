import prisma from '@/lib/prisma'
import { ServiceError } from '@/lib/errors'
import { WEEKLY_REPORT_EMAIL_STATUS, WEEKLY_REPORT_STATUS } from '@/lib/analytics/reportStatus'
import { EMAIL_ERROR, EmailDeliveryError, isRetryableEmailError } from '@/lib/email/emailErrors'
import { renderReportEmail } from '@/lib/email/renderReportEmail'
import { sendResendEmail } from '@/lib/email/resendClient'
import { getUserEmailById } from '@/lib/supabase/admin'

export const STALE_EMAIL_TIMEOUT_MS = 5 * 60 * 1000 // 5 minutes
export const MAX_SCHEDULED_EMAIL_ATTEMPTS = 3

// Atomically claims a completed report for email transmission.
// Prevents duplicate concurrent sends, recovers stale leases, and bounds automatic retries.
// Manual requests (force = true) bypass the scheduled attempt cap and allow resending.
export async function claimReportForEmail(
  db,
  reportId,
  userId,
  {
    now = new Date(),
    maxAttempts = MAX_SCHEDULED_EMAIL_ATTEMPTS,
    staleTimeoutMs = STALE_EMAIL_TIMEOUT_MS,
    force = false,
  } = {}
) {
  const existing = await db.weeklyReport.findFirst({
    where: { id: reportId, userId },
  })

  if (!existing) {
    throw new ServiceError('NOT_FOUND', 'Report not found', 404)
  }

  if (existing.status !== WEEKLY_REPORT_STATUS.COMPLETED) {
    throw new ServiceError('REPORT_NOT_COMPLETED', 'Report must be completed before delivering email', 409)
  }

  if (existing.emailStatus === WEEKLY_REPORT_EMAIL_STATUS.SENT && !force) {
    throw new ServiceError('EMAIL_ALREADY_SENT', 'Email has already been sent for this report', 409)
  }

  if (existing.emailStatus === WEEKLY_REPORT_EMAIL_STATUS.SENDING) {
    const referenceTime = existing.emailSentAt ?? existing.updatedAt ?? existing.createdAt
    const isStale = referenceTime
      ? now.getTime() - new Date(referenceTime).getTime() > staleTimeoutMs
      : false

    if (!isStale && !force) {
      throw new ServiceError('EMAIL_IN_PROGRESS', 'An email is currently being sent for this report', 409)
    }

    if (!force && existing.emailAttemptCount >= maxAttempts) {
      throw new ServiceError('EMAIL_ATTEMPTS_EXCEEDED', 'Maximum automatic email attempts reached', 409)
    }
  }

  if (existing.emailStatus === WEEKLY_REPORT_EMAIL_STATUS.FAILED && !force) {
    if (existing.emailAttemptCount >= maxAttempts) {
      throw new ServiceError('EMAIL_ATTEMPTS_EXCEEDED', 'Maximum automatic email attempts reached', 409)
    }
    // Do not automatically retry unknown outcome errors
    if (existing.emailErrorCode === EMAIL_ERROR.UNKNOWN_OUTCOME) {
      throw new ServiceError('EMAIL_UNKNOWN_OUTCOME', 'Email delivery outcome is uncertain; automatic retry blocked', 409)
    }
    if (!isRetryableEmailError(existing.emailErrorCode)) {
      throw new ServiceError('EMAIL_NON_RETRYABLE', 'Email failure is not retryable', 409)
    }
  }

  const { count } = await db.weeklyReport.updateMany({
    where: {
      id: reportId,
      userId,
      status: WEEKLY_REPORT_STATUS.COMPLETED,
    },
    data: {
      emailStatus: WEEKLY_REPORT_EMAIL_STATUS.SENDING,
      emailAttemptCount: { increment: 1 },
      emailErrorCode: null,
    },
  })

  if (count === 0) {
    throw new ServiceError('EMAIL_IN_PROGRESS', 'Could not claim report for email delivery', 409)
  }

  return existing
}

// Delivers a completed weekly report by email. Never invokes the LLM.
export async function sendWeeklyReportEmail(
  reportId,
  {
    userId,
    recipientEmail,
    db = prisma,
    emailClient,
    force = false,
    maxAttempts = MAX_SCHEDULED_EMAIL_ATTEMPTS,
    now = new Date(),
    adminClient,
  } = {}
) {
  if (!userId || typeof userId !== 'string') {
    throw new ServiceError('VALIDATION_ERROR', 'userId is required')
  }

  let email = recipientEmail
  if (!email) {
    email = await getUserEmailById(userId, { adminClient })
  }

  if (!email || typeof email !== 'string' || !email.includes('@')) {
    await db.weeklyReport.updateMany({
      where: { id: reportId, userId },
      data: {
        emailStatus: WEEKLY_REPORT_EMAIL_STATUS.FAILED,
        emailErrorCode: EMAIL_ERROR.RECIPIENT_MISSING,
      },
    })
    return {
      success: false,
      reportId,
      emailStatus: WEEKLY_REPORT_EMAIL_STATUS.FAILED,
      errorCode: EMAIL_ERROR.RECIPIENT_MISSING,
    }
  }

  const report = await claimReportForEmail(db, reportId, userId, { now, maxAttempts, force })
  const { subject, html, text } = renderReportEmail({ report })

  try {
    if (emailClient) {
      await emailClient.send({ to: email, subject, html, text })
    } else {
      await sendResendEmail({ to: email, subject, html, text })
    }
  } catch (error) {
    const errorCode = error instanceof EmailDeliveryError ? error.code : EMAIL_ERROR.INTERNAL
    console.error(`weekly report ${reportId} email failed: ${errorCode}`)
    await db.weeklyReport.updateMany({
      where: { id: reportId, userId, emailStatus: WEEKLY_REPORT_EMAIL_STATUS.SENDING },
      data: {
        emailStatus: WEEKLY_REPORT_EMAIL_STATUS.FAILED,
        emailErrorCode: errorCode,
        emailRecipient: email,
      },
    })
    return {
      success: false,
      reportId,
      emailStatus: WEEKLY_REPORT_EMAIL_STATUS.FAILED,
      errorCode,
      recipient: email,
    }
  }

  await db.weeklyReport.updateMany({
    where: { id: reportId, userId, emailStatus: WEEKLY_REPORT_EMAIL_STATUS.SENDING },
    data: {
      emailStatus: WEEKLY_REPORT_EMAIL_STATUS.SENT,
      emailSentAt: now,
      emailRecipient: email,
      emailErrorCode: null,
    },
  })

  return {
    success: true,
    reportId,
    emailStatus: WEEKLY_REPORT_EMAIL_STATUS.SENT,
    emailSentAt: now,
    recipient: email,
  }
}

