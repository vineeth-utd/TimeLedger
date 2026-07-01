import prisma from '@/lib/prisma'
import { getAuthenticatedUser } from '@/lib/auth'

function pluralize(count, singular, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`
}

function formatList(items) {
  if (items.length === 1) return items[0]
  if (items.length === 2) return `${items[0]} and ${items[1]}`
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`
}

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

export async function DELETE(_request, ctx) {
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

    const [subCategoryCount, activityCount, weeklyTargetCount] = await Promise.all([
      prisma.subCategory.count({ where: { userId, mainCategoryId } }),
      prisma.activity.count({ where: { userId, subCategory: { mainCategoryId } } }),
      prisma.weeklyTarget.count({ where: { userId, mainCategoryId } }),
    ])

    const blockers = [
      subCategoryCount > 0 ? pluralize(subCategoryCount, 'sub category', 'sub categories') : null,
      activityCount > 0 ? pluralize(activityCount, 'activity', 'activities') : null,
      weeklyTargetCount > 0 ? pluralize(weeklyTargetCount, 'weekly target') : null,
    ].filter(Boolean)

    if (blockers.length > 0) {
      return Response.json(
        {
          success: false,
          message: `Cannot delete main category because it has ${formatList(blockers)}. Delete the dependent data first.`,
        },
        { status: 409 }
      )
    }

    await prisma.mainCategory.delete({ where: { id: mainCategoryId } })

    return Response.json({ success: true, data: { id: mainCategoryId } })
  } catch (error) {
    console.error('DELETE /api/main-categories/[id] error:', error)
    return Response.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
}
