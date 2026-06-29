import prisma from '@/lib/prisma'

export async function PATCH(request, ctx) {
  try {
    const { id } = await ctx.params
    const categoryId = Number(id)

    const existing = await prisma.category.findUnique({ where: { id: categoryId } })
    if (!existing) {
      return Response.json(
        { success: false, message: 'Category not found' },
        { status: 404 }
      )
    }

    const body = await request.json()
    const data = {}

    if ('name' in body) {
      if (!body.name || !body.name.trim()) {
        return Response.json(
          { success: false, message: 'name cannot be empty' },
          { status: 400 }
        )
      }
      const trimmedName = body.name.trim()
      const duplicate = await prisma.category.findFirst({
        where: { name: trimmedName, id: { not: categoryId } },
      })
      if (duplicate) {
        return Response.json(
          { success: false, message: 'A category with that name already exists' },
          { status: 409 }
        )
      }
      data.name = trimmedName
    }

    if ('isActive' in body && typeof body.isActive === 'boolean') {
      data.isActive = body.isActive
    }

    const updated = await prisma.category.update({
      where: { id: categoryId },
      data,
    })

    return Response.json({ success: true, data: updated })
  } catch (error) {
    console.error('PATCH /api/categories/[id] error:', error)
    return Response.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
}
