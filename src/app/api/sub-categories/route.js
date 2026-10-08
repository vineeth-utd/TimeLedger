import prisma from '@/lib/prisma'
import { getAuthenticatedUser } from '@/lib/auth'
import { handleRouteError } from '@/lib/errors'
import { createSubCategory } from '@/lib/services/categoryService'

export async function GET(request) {
  try {
    const user = await getAuthenticatedUser()
    if (!user) {
      return Response.json({ success: false, message: 'Unauthorized' }, { status: 401 })
    }
    const userId = user.id

    const { searchParams } = new URL(request.url)
    const mainCategoryIdParam = searchParams.get('mainCategoryId')
    const isActiveParam = searchParams.get('isActive')

    const where = { userId }
    if (mainCategoryIdParam !== null) where.mainCategoryId = Number(mainCategoryIdParam)
    if (isActiveParam === 'true') where.isActive = true
    else if (isActiveParam === 'false') where.isActive = false

    const subCategories = await prisma.subCategory.findMany({
      where,
      include: { mainCategory: true },
      orderBy: { name: 'asc' },
    })

    return Response.json({ success: true, data: subCategories })
  } catch (error) {
    console.error('GET /api/sub-categories error:', error)
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

    const subCategory = await createSubCategory(user.id, body)
    return Response.json({ success: true, data: subCategory }, { status: 201 })
  } catch (error) {
    return handleRouteError(error, 'POST /api/sub-categories')
  }
}
