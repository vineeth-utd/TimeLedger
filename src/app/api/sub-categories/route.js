import prisma from '@/lib/prisma'

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const mainCategoryIdParam = searchParams.get('mainCategoryId')
    const isActiveParam = searchParams.get('isActive')

    const where = {}
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
    const body = await request.json()
    const { mainCategoryId, name } = body

    if (mainCategoryId === undefined || mainCategoryId === null || !Number.isFinite(mainCategoryId)) {
      return Response.json(
        { success: false, message: 'mainCategoryId is required and must be a number' },
        { status: 400 }
      )
    }

    if (!name || !name.trim()) {
      return Response.json(
        { success: false, message: 'name is required' },
        { status: 400 }
      )
    }

    const trimmedName = name.trim()

    const parentExists = await prisma.mainCategory.findUnique({ where: { id: mainCategoryId } })
    if (!parentExists) {
      return Response.json(
        { success: false, message: 'Main category not found' },
        { status: 404 }
      )
    }

    const duplicate = await prisma.subCategory.findFirst({
      where: { mainCategoryId, name: trimmedName },
    })
    if (duplicate) {
      return Response.json(
        { success: false, message: 'A sub category with that name already exists in this main category' },
        { status: 409 }
      )
    }

    const subCategory = await prisma.subCategory.create({
      data: { mainCategoryId, name: trimmedName },
      include: { mainCategory: true },
    })

    return Response.json({ success: true, data: subCategory }, { status: 201 })
  } catch (error) {
    console.error('POST /api/sub-categories error:', error)
    return Response.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
}
