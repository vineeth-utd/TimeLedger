import { getAuthenticatedUser } from '@/lib/auth'
import { handleRouteError, ServiceError } from '@/lib/errors'
import { sendWeeklyReportEmail } from '@/lib/services/weeklyReportEmailService'

export const maxDuration = 30

const EMAIL_FAILURE_RESPONSES = {
  EMAIL_RATE_LIMITED: [429, 'The email service is busy. Please try again in a few minutes.'],
  EMAIL_PROVIDER_UNAVAILABLE: [502, 'The email service is unavailable. Please try again later.'],
  EMAIL_INVALID_RECIPIENT: [400, 'Invalid email recipient address.'],
  EMAIL_CONFIG_MISSING: [500, 'Email delivery is not properly configured.'],
  EMAIL_UNKNOWN_OUTCOME: [504, 'Email delivery timed out with uncertain outcome. Please verify your inbox before resending.'],
}
const DEFAULT_EMAIL_FAILURE = [500, 'Failed to send report email. Please try again.']

export async function POST(request, context) {
  try {
    const user = await getAuthenticatedUser()
    if (!user) {
      return Response.json({ success: false, message: 'Unauthorized' }, { status: 401 })
    }

    const { id: rawId } = await context.params
    const reportId = Number.parseInt(rawId, 10)
    if (!Number.isInteger(reportId) || reportId <= 0) {
      throw new ServiceError('NOT_FOUND', 'Report not found', 404)
    }

    const result = await sendWeeklyReportEmail(reportId, {
      userId: user.id,
      recipientEmail: user.email,
      force: true, // Manual user-initiated resend allows overriding previous sent/failed state
    })

    if (!result.success) {
      const [status, message] = EMAIL_FAILURE_RESPONSES[result.errorCode] ?? DEFAULT_EMAIL_FAILURE
      return Response.json(
        { success: false, message, errorCode: result.errorCode },
        { status }
      )
    }

    return Response.json({
      success: true,
      data: {
        reportId,
        emailStatus: result.emailStatus,
        emailSentAt: result.emailSentAt,
        recipient: result.recipient,
      },
    })
  } catch (error) {
    return handleRouteError(error, 'POST /api/productivity-agent/reports/:id/email')
  }
}

