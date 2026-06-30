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
    const mainCategoryId = Number(id)

    const existing = await prisma.mainCategory.findUnique({ where: { id: mainCategoryId } })
    if (!existing || existing.userId !== userId) {
      return Response.json(
        { success: false, message: 'Main category not found' },
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
      const duplicate = await prisma.mainCategory.findFirst({
        where: { userId, name: trimmedName, id: { not: mainCategoryId } },
      })
      if (duplicate) {
        return Response.json(
          { success: false, message: 'A main category with that name already exists' },
          { status: 409 }
        )
      }
      data.name = trimmedName
    }

    if ('isActive' in body && typeof body.isActive === 'boolean') {
      data.isActive = body.isActive
    }

    const updated = await prisma.mainCategory.update({
      where: { id: mainCategoryId },
      data,
    })

    return Response.json({ success: true, data: updated })
  } catch (error) {
    console.error('PATCH /api/main-categories/[id] error:', error)
    return Response.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
}
