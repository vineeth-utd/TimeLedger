import { getAuthenticatedUser } from '@/lib/auth'
import { handleRouteError, ServiceError } from '@/lib/errors'
import { getPreferences, updatePreferences } from '@/lib/services/productivityAgentService'

export async function GET() {
  try {
    const user = await getAuthenticatedUser()
    if (!user) {
      return Response.json({ success: false, message: 'Unauthorized' }, { status: 401 })
    }
    return Response.json({ success: true, data: await getPreferences(user.id) })
  } catch (error) {
    return handleRouteError(error, 'GET /api/productivity-agent/preferences')
  }
}

export async function PATCH(request) {
  try {
    const user = await getAuthenticatedUser()
    if (!user) {
      return Response.json({ success: false, message: 'Unauthorized' }, { status: 401 })
    }
    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      throw new ServiceError('VALIDATION_ERROR', 'A JSON object body is required')
    }
    return Response.json({ success: true, data: await updatePreferences(user.id, body) })
  } catch (error) {
    return handleRouteError(error, 'PATCH /api/productivity-agent/preferences')
  }
}
