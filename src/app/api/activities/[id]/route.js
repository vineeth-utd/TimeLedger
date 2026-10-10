import { getAuthenticatedUser } from '@/lib/auth'
import { handleRouteError } from '@/lib/errors'
import { updateActivity, deleteActivity } from '@/lib/services/activityService'

export async function PATCH(request, ctx) {
  try {
    const user = await getAuthenticatedUser()
    if (!user) {
      return Response.json({ success: false, message: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await ctx.params
    const body = await request.json()

    const updated = await updateActivity(user.id, Number(id), body)
    return Response.json({ success: true, data: updated })
  } catch (error) {
    return handleRouteError(error, 'PATCH /api/activities/[id]')
  }
}

export async function DELETE(_request, ctx) {
  try {
    const user = await getAuthenticatedUser()
    if (!user) {
      return Response.json({ success: false, message: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await ctx.params

    const deleted = await deleteActivity(user.id, Number(id))
    return Response.json({ success: true, data: deleted })
  } catch (error) {
    return handleRouteError(error, 'DELETE /api/activities/[id]')
  }
}
