import { getAuthenticatedUser } from '@/lib/auth'
import { handleRouteError } from '@/lib/errors'
import { getWeeklyReport } from '@/lib/services/productivityAgentService'

export async function GET(_request, ctx) {
  try {
    const user = await getAuthenticatedUser()
    if (!user) {
      return Response.json({ success: false, message: 'Unauthorized' }, { status: 401 })
    }
    const { id } = await ctx.params
    return Response.json({ success: true, data: await getWeeklyReport(user.id, Number(id)) })
  } catch (error) {
    return handleRouteError(error, 'GET /api/productivity-agent/reports/[id]')
  }
}
