import prisma from '@/lib/prisma'

export async function GET() {
  try {
    const categories = await prisma.category.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    })
    return Response.json({ success: true, data: categories })
  } catch (error) {
    console.error('GET /api/categories error:', error)
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

    const existing = await prisma.category.findUnique({ where: { name: trimmedName } })
    if (existing) {
      return Response.json(
        { success: false, message: 'A category with that name already exists' },
        { status: 409 }
      )
    }

    const category = await prisma.category.create({ data: { name: trimmedName } })
    return Response.json({ success: true, data: category }, { status: 201 })
  } catch (error) {
    console.error('POST /api/categories error:', error)
    return Response.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
}
