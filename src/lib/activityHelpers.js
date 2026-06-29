export function calculateDurationMinutes(startTime, endTime) {
  return Math.round((new Date(endTime) - new Date(startTime)) / 60000)
}

export async function recalculateDailySummary(prisma, activityDate, categoryId) {
  const result = await prisma.activity.aggregate({
    where: { activityDate, categoryId },
    _sum: { durationMinutes: true },
    _count: { id: true },
  })

  const totalMinutes = result._sum.durationMinutes ?? 0
  const totalActivities = result._count.id

  if (totalActivities === 0) {
    await prisma.dailyCategorySummary.deleteMany({
      where: { summaryDate: activityDate, categoryId },
    })
  } else {
    await prisma.dailyCategorySummary.upsert({
      where: { summaryDate_categoryId: { summaryDate: activityDate, categoryId } },
      update: { totalMinutes, totalActivities },
      create: { summaryDate: activityDate, categoryId, totalMinutes, totalActivities },
    })
  }
}
