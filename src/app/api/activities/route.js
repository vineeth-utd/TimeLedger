import prisma from '@/lib/prisma'
import { calculateDurationMinutes, recalculateDailySummary } from '@/lib/activityHelpers'

export async function GET(request) {
  try {
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
    const body = await request.json()
    const { activityDate, title, subCategoryId, startTime, endTime, notes } = body

    if (!title || !title.trim()) {
      return Response.json(
        { success: false, message: 'title is required' },
        { status: 400 }
      )
    }

    if (!activityDate || !subCategoryId || !startTime || !endTime) {
      return Response.json(
        { success: false, message: 'activityDate, subCategoryId, startTime, and endTime are required' },
        { status: 400 }
      )
    }

    if (new Date(endTime) <= new Date(startTime)) {
      return Response.json(
        { success: false, message: 'endTime must be later than startTime' },
        { status: 400 }
      )
    }

    const subCategory = await prisma.subCategory.findUnique({ where: { id: Number(subCategoryId) } })
    if (!subCategory) {
      return Response.json(
        { success: false, message: 'Sub category not found' },
        { status: 400 }
      )
    }

    const durationMinutes = calculateDurationMinutes(startTime, endTime)
    const parsedActivityDate = new Date(activityDate)

    const activity = await prisma.activity.create({
      data: {
        activityDate: parsedActivityDate,
        title: title.trim(),
        subCategoryId: Number(subCategoryId),
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        durationMinutes,
        notes: notes ?? null,
      },
      include: { subCategory: { include: { mainCategory: true } } },
    })

    await recalculateDailySummary(prisma, parsedActivityDate, Number(subCategoryId))

    return Response.json({ success: true, data: activity }, { status: 201 })
  } catch (error) {
    console.error('POST /api/activities error:', error)
    return Response.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
}
