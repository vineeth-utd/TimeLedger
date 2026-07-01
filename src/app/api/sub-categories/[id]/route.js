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

export async function DELETE(_request, ctx) {
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

    const [activityCount, summaryCount] = await Promise.all([
      prisma.activity.count({ where: { userId, subCategoryId } }),
      prisma.dailySubCategorySummary.count({ where: { userId, subCategoryId } }),
    ])

    const blockers = [
      activityCount > 0 ? pluralize(activityCount, 'activity', 'activities') : null,
      summaryCount > 0 ? pluralize(summaryCount, 'daily summary', 'daily summaries') : null,
    ].filter(Boolean)

    if (blockers.length > 0) {
      return Response.json(
        {
          success: false,
          message: `Cannot delete sub category because it has ${formatList(blockers)}. Delete the dependent data first.`,
        },
        { status: 409 }
      )
    }

    await prisma.subCategory.delete({ where: { id: subCategoryId } })

    return Response.json({ success: true, data: { id: subCategoryId } })
  } catch (error) {
    console.error('DELETE /api/sub-categories/[id] error:', error)
    return Response.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
}
