import prisma from '@/lib/prisma'

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const isActiveParam = searchParams.get('isActive')

    const where =
      isActiveParam === 'true'
        ? { isActive: true }
        : isActiveParam === 'false'
          ? { isActive: false }
          : {}

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
    const body = await request.json()
    const { name } = body

    if (!name || !name.trim()) {
      return Response.json(
        { success: false, message: 'name is required' },
        { status: 400 }
      )
    }

    const trimmedName = name.trim()

    const existing = await prisma.mainCategory.findUnique({ where: { name: trimmedName } })
    if (existing) {
      return Response.json(
        { success: false, message: 'A main category with that name already exists' },
        { status: 409 }
      )
    }

    const mainCategory = await prisma.mainCategory.create({ data: { name: trimmedName } })
    return Response.json({ success: true, data: mainCategory }, { status: 201 })
  } catch (error) {
    console.error('POST /api/main-categories error:', error)
    return Response.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
}
