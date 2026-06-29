import prisma from '@/lib/prisma'

export async function PATCH(request, ctx) {
  try {
    const { id } = await ctx.params
    const targetId = Number(id)

    const existing = await prisma.weeklyTarget.findUnique({ where: { id: targetId } })
    if (!existing) {
      return Response.json(
        { success: false, message: 'Weekly target not found' },
        { status: 404 }
      )
    }

    const body = await request.json()
    const { targetMinutes } = body

    if (targetMinutes === undefined || targetMinutes === null || !Number.isInteger(Number(targetMinutes)) || Number(targetMinutes) < 0) {
      return Response.json(
        { success: false, message: 'targetMinutes must be a non-negative integer' },
        { status: 400 }
      )
    }

    const updated = await prisma.weeklyTarget.update({
      where: { id: targetId },
      data: { targetMinutes: Number(targetMinutes) },
      include: { mainCategory: true },
    })

    return Response.json({ success: true, data: updated })
  } catch (error) {
    console.error('PATCH /api/weekly-targets/[id] error:', error)
    return Response.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(request, ctx) {
  try {
    const { id } = await ctx.params
    const targetId = Number(id)

    const existing = await prisma.weeklyTarget.findUnique({ where: { id: targetId } })
    if (!existing) {
      return Response.json(
        { success: false, message: 'Weekly target not found' },
        { status: 404 }
      )
    }

    await prisma.weeklyTarget.delete({ where: { id: targetId } })

    return Response.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/weekly-targets/[id] error:', error)
    return Response.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
}
