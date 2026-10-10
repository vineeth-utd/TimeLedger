import prisma from '@/lib/prisma'
import { getAuthenticatedUser } from '@/lib/auth'
import { handleRouteError } from '@/lib/errors'
import { createMainCategory } from '@/lib/services/categoryService'

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

    const body = await request.json()

    const mainCategory = await createMainCategory(user.id, body)
    return Response.json({ success: true, data: mainCategory }, { status: 201 })
  } catch (error) {
    return handleRouteError(error, 'POST /api/main-categories')
  }
}
