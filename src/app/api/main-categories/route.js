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
    const isActiveParam = searchParams.get('isActive')

    const where =
      isActiveParam === 'true'
        ? { userId, isActive: true }
        : isActiveParam === 'false'
          ? { userId, isActive: false }
          : { userId }

    const mainCategories = await prisma.mainCategory.findMany({
      where,
      orderBy: { name: 'asc' },
    })

    return Response.json({ success: true, data: mainCategories })
  } catch (error) {
    console.error('GET /api/main-categories error:', error)
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
    const { name } = body

    if (!name || !name.trim()) {
      return Response.json(
        { success: false, message: 'name is required' },
        { status: 400 }
      )
    }

    const trimmedName = name.trim()

    const existing = await prisma.mainCategory.findUnique({
      where: { userId_name: { userId, name: trimmedName } },
    })
    if (existing) {
      return Response.json(
        { success: false, message: 'A main category with that name already exists' },
        { status: 409 }
      )
    }

    const mainCategory = await prisma.mainCategory.create({ data: { userId, name: trimmedName } })
    return Response.json({ success: true, data: mainCategory }, { status: 201 })
  } catch (error) {
    console.error('POST /api/main-categories error:', error)
    return Response.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
}
