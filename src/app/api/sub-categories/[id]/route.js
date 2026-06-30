import prisma from '@/lib/prisma'
import { getAuthenticatedUser } from '@/lib/auth'

export async function PATCH(request, ctx) {
  try {
    const user = await getAuthenticatedUser()
    if (!user) {
      return Response.json({ success: false, message: 'Unauthorized' }, { status: 401 })
    }
    const userId = user.id

    const { id } = await ctx.params
    const subCategoryId = Number(id)

    const existing = await prisma.subCategory.findUnique({ where: { id: subCategoryId } })
    if (!existing || existing.userId !== userId) {
      return Response.json(
        { success: false, message: 'Sub category not found' },
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
      const duplicate = await prisma.subCategory.findFirst({
        where: {
          mainCategoryId: existing.mainCategoryId,
          name: trimmedName,
          id: { not: subCategoryId },
        },
      })
      if (duplicate) {
        return Response.json(
          { success: false, message: 'A sub category with that name already exists in this main category' },
          { status: 409 }
        )
      }
      data.name = trimmedName
    }

    if ('isActive' in body && typeof body.isActive === 'boolean') {
      data.isActive = body.isActive
    }

    const updated = await prisma.subCategory.update({
      where: { id: subCategoryId },
      data,
    })

    return Response.json({ success: true, data: updated })
  } catch (error) {
    console.error('PATCH /api/sub-categories/[id] error:', error)
    return Response.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
}
