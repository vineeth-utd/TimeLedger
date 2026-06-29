export function calculateDurationMinutes(startTime, endTime) {
  return Math.round((new Date(endTime) - new Date(startTime)) / 60000)
}

export async function recalculateDailySummary(prisma, activityDate, subCategoryId) {
  const result = await prisma.activity.aggregate({
    where: { activityDate, subCategoryId },
    _sum: { durationMinutes: true },
    _count: { id: true },
  })

  const totalMinutes = result._sum.durationMinutes ?? 0
  const totalActivities = result._count.id

  if (totalActivities === 0) {
    await prisma.dailySubCategorySummary.deleteMany({
      where: { summaryDate: activityDate, subCategoryId },
    })
  } else {
    await prisma.dailySubCategorySummary.upsert({
      where: { summaryDate_subCategoryId: { summaryDate: activityDate, subCategoryId } },
      update: { totalMinutes, totalActivities },
      create: { summaryDate: activityDate, subCategoryId, totalMinutes, totalActivities },
    })
  }
}
