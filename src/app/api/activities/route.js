import prisma from '@/lib/prisma'
import { getAuthenticatedUser } from '@/lib/auth'
import { handleRouteError } from '@/lib/errors'
import { createActivity } from '@/lib/services/activityService'

export async function GET(request) {
  try {
    const user = await getAuthenticatedUser()
    if (!user) {
      return Response.json({ success: false, message: 'Unauthorized' }, { status: 401 })
    }
    const userId = user.id

    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const subCategoryId = searchParams.get('subCategoryId')
    const mainCategoryId = searchParams.get('mainCategoryId')

    if (!startDate || !endDate) {
      return Response.json(
        { success: false, message: 'startDate and endDate are required' },
        { status: 400 }
      )
    }

    const start = new Date(startDate)
    const end = new Date(endDate)

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return Response.json(
        { success: false, message: 'Invalid date format' },
        { status: 400 }
      )
    }

    const where = {
      userId,
      activityDate: { gte: start, lte: end },
    }

    if (subCategoryId) {
      where.subCategoryId = Number(subCategoryId)
    }

    if (mainCategoryId) {
      where.subCategory = { mainCategoryId: Number(mainCategoryId) }
    }

    const activities = await prisma.activity.findMany({
      where,
      include: { subCategory: { include: { mainCategory: true } } },
      orderBy: [{ activityDate: 'desc' }, { startTime: 'desc' }],
    })

    return Response.json({ success: true, data: activities })
  } catch (error) {
    console.error('GET /api/activities error:', error)
    return Response.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request) {
  try {
    const user = await getAuthenticatedUser()
    if (!user) {
      return Response.json({ success: false, message: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

    const activity = await createActivity(user.id, body)
    return Response.json({ success: true, data: activity }, { status: 201 })
  } catch (error) {
    return handleRouteError(error, 'POST /api/activities')
  }
}
