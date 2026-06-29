import prisma from '@/lib/prisma'
import { calculateDurationMinutes, recalculateDailySummary } from '@/lib/activityHelpers'

export async function PATCH(request, ctx) {
  try {
    const { id } = await ctx.params
    const activityId = Number(id)

    const existing = await prisma.activity.findUnique({ where: { id: activityId } })
    if (!existing) {
      return Response.json(
        { success: false, message: 'Activity not found' },
        { status: 404 }
      )
    }

    const body = await request.json()

    const mergedTitle = 'title' in body ? body.title : existing.title
    const mergedActivityDate = 'activityDate' in body ? new Date(body.activityDate) : existing.activityDate
    const mergedSubCategoryId = 'subCategoryId' in body ? Number(body.subCategoryId) : existing.subCategoryId
    const mergedStartTime = 'startTime' in body ? new Date(body.startTime) : existing.startTime
    const mergedEndTime = 'endTime' in body ? new Date(body.endTime) : existing.endTime
    const mergedNotes = 'notes' in body ? body.notes : existing.notes

    if (!mergedTitle || !mergedTitle.trim()) {
      return Response.json(
        { success: false, message: 'title cannot be empty' },
        { status: 400 }
      )
    }

    if (mergedEndTime <= mergedStartTime) {
      return Response.json(
        { success: false, message: 'endTime must be later than startTime' },
        { status: 400 }
      )
    }

    if ('subCategoryId' in body) {
      const subCategory = await prisma.subCategory.findUnique({ where: { id: mergedSubCategoryId } })
      if (!subCategory) {
        return Response.json(
          { success: false, message: 'Sub category not found' },
          { status: 400 }
        )
      }
    }

    const durationMinutes = calculateDurationMinutes(mergedStartTime, mergedEndTime)

    const updated = await prisma.activity.update({
      where: { id: activityId },
      data: {
        activityDate: mergedActivityDate,
        title: mergedTitle.trim(),
        subCategoryId: mergedSubCategoryId,
        startTime: mergedStartTime,
        endTime: mergedEndTime,
        durationMinutes,
        notes: mergedNotes,
      },
      include: { subCategory: { include: { mainCategory: true } } },
    })

    await recalculateDailySummary(prisma, mergedActivityDate, mergedSubCategoryId)

    const dateChanged = existing.activityDate.getTime() !== mergedActivityDate.getTime()
    const subCategoryChanged = existing.subCategoryId !== mergedSubCategoryId

    if (dateChanged || subCategoryChanged) {
      await recalculateDailySummary(prisma, existing.activityDate, existing.subCategoryId)
    }

    return Response.json({ success: true, data: updated })
  } catch (error) {
    console.error('PATCH /api/activities/[id] error:', error)
    return Response.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(_request, ctx) {
  try {
    const { id } = await ctx.params
    const activityId = Number(id)

    const existing = await prisma.activity.findUnique({ where: { id: activityId } })
    if (!existing) {
      return Response.json(
        { success: false, message: 'Activity not found' },
        { status: 404 }
      )
    }

    const { activityDate, subCategoryId } = existing

    await prisma.activity.delete({ where: { id: activityId } })
    await recalculateDailySummary(prisma, activityDate, subCategoryId)

    return Response.json({ success: true, data: { id: activityId } })
  } catch (error) {
    console.error('DELETE /api/activities/[id] error:', error)
    return Response.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
}
