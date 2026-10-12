import { getAuthenticatedUser } from '@/lib/auth'
import { handleRouteError } from '@/lib/errors'
import { listWeeklyReports, requestWeeklyReportGeneration } from '@/lib/services/productivityAgentService'

// Generation calls the LLM once (typically 10-15 s).
export const maxDuration = 60

const FAILURE_RESPONSES = {
  LLM_RATE_LIMITED: [429, 'The AI provider is busy. Please try again in a few minutes.'],
  LLM_UNAVAILABLE: [502, 'The AI provider is unavailable. Please try again later.'],
}
const DEFAULT_FAILURE = [500, 'The report could not be generated. Please try again.']

export async function GET() {
  try {
    const user = await getAuthenticatedUser()
    if (!user) {
      return Response.json({ success: false, message: 'Unauthorized' }, { status: 401 })
    }
    return Response.json({ success: true, data: await listWeeklyReports(user.id) })
  } catch (error) {
    return handleRouteError(error, 'GET /api/productivity-agent/reports')
  }
}

// Manual generation. No body: the server picks the week (latest completed) and the stored timezone.
export async function POST() {
  try {
    const user = await getAuthenticatedUser()
    if (!user) {
      return Response.json({ success: false, message: 'Unauthorized' }, { status: 401 })
    }
    const result = await requestWeeklyReportGeneration(user.id)
    if (!result.success) {
      const [status, message] = FAILURE_RESPONSES[result.errorCode] ?? DEFAULT_FAILURE
      return Response.json({ success: false, message, errorCode: result.errorCode }, { status })
    }
    return Response.json({ success: true, data: { reportId: result.reportId, weekStartDate: result.weekStartDate } })
  } catch (error) {
    return handleRouteError(error, 'POST /api/productivity-agent/reports')
  }
}
