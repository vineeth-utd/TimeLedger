import prisma from '@/lib/prisma'
import { getAuthenticatedUser } from '@/lib/auth'

export async function GET(request) {
  try {
    const user = await getAuthenticatedUser()
    if (!user) {
      return Response.json({ success: false, message: 'Unauthorized' }, { status: 401 })
    }
    const userId = user.id

    const { searchParams } = new URL(request.url)
    const weekStartDateParam = searchParams.get('weekStartDate')

    if (!weekStartDateParam) {
      return Response.json(
        { success: false, message: 'weekStartDate is required' },
        { status: 400 }
      )
    }

    const weekStart = new Date(weekStartDateParam)
    if (isNaN(weekStart.getTime())) {
      return Response.json(
        { success: false, message: 'Invalid weekStartDate format' },
        { status: 400 }
      )
    }

    const targets = await prisma.weeklyTarget.findMany({
      where: { userId, weekStartDate: weekStart },
      include: { mainCategory: true },
      orderBy: { mainCategory: { name: 'asc' } },
    })

    return Response.json({ success: true, data: targets })
  } catch (error) {
    console.error('GET /api/weekly-targets error:', error)
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
    const userId = user.id

    const body = await request.json()
    const { weekStartDate, mainCategoryId, targetMinutes } = body

    if (!weekStartDate) {
      return Response.json(
        { success: false, message: 'weekStartDate is required' },
        { status: 400 }
      )
    }

    const weekStart = new Date(weekStartDate)
    if (isNaN(weekStart.getTime())) {
      return Response.json(
        { success: false, message: 'Invalid weekStartDate format' },
        { status: 400 }
      )
    }

    if (mainCategoryId === undefined || mainCategoryId === null || !Number.isFinite(Number(mainCategoryId))) {
      return Response.json(
        { success: false, message: 'mainCategoryId is required and must be a number' },
        { status: 400 }
      )
    }

    const mcId = Number(mainCategoryId)

    if (targetMinutes === undefined || targetMinutes === null || !Number.isInteger(Number(targetMinutes)) || Number(targetMinutes) < 0) {
      return Response.json(
        { success: false, message: 'targetMinutes must be a non-negative integer' },
        { status: 400 }
      )
    }

    const mins = Number(targetMinutes)

    const parentExists = await prisma.mainCategory.findUnique({ where: { id: mcId } })
    if (!parentExists || parentExists.userId !== userId) {
      return Response.json(
        { success: false, message: 'Main category not found' },
        { status: 404 }
      )
    }

    const existing = await prisma.weeklyTarget.findUnique({
      where: { userId_weekStartDate_mainCategoryId: { userId, weekStartDate: weekStart, mainCategoryId: mcId } },
    })
    if (existing) {
      return Response.json(
        { success: false, message: 'A weekly target already exists for this category and week' },
        { status: 409 }
      )
    }

    const target = await prisma.weeklyTarget.create({
      data: { userId, weekStartDate: weekStart, mainCategoryId: mcId, targetMinutes: mins },
      include: { mainCategory: true },
    })

    return Response.json({ success: true, data: target }, { status: 201 })
  } catch (error) {
    console.error('POST /api/weekly-targets error:', error)
    return Response.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
}
