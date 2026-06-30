import prisma from '@/lib/prisma'
import { getAuthenticatedUser } from '@/lib/auth'

export async function GET(request) {
  try {
    const user = await getAuthenticatedUser()
    if (!user) {
      return Response.json({ success: false, message: 'Unauthorized' }, { status: 401 })
    }
    const userId = user.id

    const { searchParams } = new URL(request.url)
    const weekStartDateParam = searchParams.get('weekStartDate')

    if (!weekStartDateParam) {
      return Response.json(
        { success: false, message: 'weekStartDate is required' },
        { status: 400 }
      )
    }

    const weekStart = new Date(weekStartDateParam)
    if (isNaN(weekStart.getTime())) {
      return Response.json(
        { success: false, message: 'Invalid weekStartDate format' },
        { status: 400 }
      )
    }

    const weekEnd = new Date(weekStart)
    weekEnd.setUTCDate(weekEnd.getUTCDate() + 6)

    // Use the client-supplied today (local date) if provided, otherwise fall back to UTC
    const todayParam = searchParams.get('today')
    const todayStr = todayParam ?? new Date().toISOString().split('T')[0]
    const today = new Date(todayStr + 'T00:00:00.000Z')

    const prevWeekStart = new Date(weekStart)
    prevWeekStart.setUTCDate(prevWeekStart.getUTCDate() - 7)
    const prevWeekEnd = new Date(weekStart)
    prevWeekEnd.setUTCDate(prevWeekEnd.getUTCDate() - 1)

    const [todayActivities, weekSummaries, todaySummaries, weekTargets, prevWeekSummaries] =
      await Promise.all([
        prisma.activity.findMany({
          where: { userId, activityDate: today },
          include: { subCategory: { include: { mainCategory: true } } },
          orderBy: { startTime: 'asc' },
        }),

        prisma.dailySubCategorySummary.findMany({
          where: { userId, summaryDate: { gte: weekStart, lte: weekEnd } },
          include: { subCategory: { include: { mainCategory: true } } },
        }),

        // Fetch today's summaries independently so they are always correct,
        // regardless of which week the user is viewing.
        prisma.dailySubCategorySummary.findMany({
          where: { userId, summaryDate: today },
          include: { subCategory: { include: { mainCategory: true } } },
        }),

        prisma.weeklyTarget.findMany({
          where: { userId, weekStartDate: weekStart },
          include: { mainCategory: true },
        }),

        prisma.dailySubCategorySummary.findMany({
          where: { userId, summaryDate: { gte: prevWeekStart, lte: prevWeekEnd } },
          include: { subCategory: { select: { mainCategoryId: true } } },
        }),
      ])

    const bySubCategory = todaySummaries.map((s) => ({
      subCategoryId: s.subCategoryId,
      subCategoryName: s.subCategory.name,
      mainCategoryId: s.subCategory.mainCategoryId,
      mainCategoryName: s.subCategory.mainCategory.name,
      totalMinutes: s.totalMinutes,
      totalActivities: s.totalActivities,
    }))

    // Today's main category summary — group sub summaries by mainCategoryId
    const todayMainMap = new Map()
    for (const s of todaySummaries) {
      const mcId = s.subCategory.mainCategoryId
      const mcName = s.subCategory.mainCategory.name
      if (!todayMainMap.has(mcId)) {
        todayMainMap.set(mcId, { mainCategoryId: mcId, mainCategoryName: mcName, totalMinutes: 0, totalActivities: 0 })
      }
      const entry = todayMainMap.get(mcId)
      entry.totalMinutes += s.totalMinutes
      entry.totalActivities += s.totalActivities
    }
    const byMainCategory = Array.from(todayMainMap.values())

    // Weekly spent per main category — group all week summaries by mainCategoryId
    const weekSpentMap = new Map()
    for (const s of weekSummaries) {
      const mcId = s.subCategory.mainCategoryId
      const mcName = s.subCategory.mainCategory.name
      if (!weekSpentMap.has(mcId)) {
        weekSpentMap.set(mcId, { mainCategoryId: mcId, mainCategoryName: mcName, spentMinutes: 0 })
      }
      weekSpentMap.get(mcId).spentMinutes += s.totalMinutes
    }

    // Previous week actual per main category — fallback target source
    const prevWeekActualMap = new Map()
    for (const s of prevWeekSummaries) {
      const mcId = s.subCategory.mainCategoryId
      prevWeekActualMap.set(mcId, (prevWeekActualMap.get(mcId) ?? 0) + s.totalMinutes)
    }

    // Explicit weekly targets lookup
    const explicitTargetMap = new Map()
    for (const t of weekTargets) {
      explicitTargetMap.set(t.mainCategoryId, {
        targetMinutes: t.targetMinutes,
        mainCategoryName: t.mainCategory.name,
      })
    }

    // Union of main categories: those with explicit targets OR activity this week
    const allMainCategoryIds = new Set([
      ...explicitTargetMap.keys(),
      ...weekSpentMap.keys(),
    ])

    const weeklyProgress = Array.from(allMainCategoryIds).map((mcId) => {
      const spent = weekSpentMap.get(mcId)
      const explicit = explicitTargetMap.get(mcId)

      let targetMinutes
      let isTargetFallback
      let mainCategoryName

      if (explicit) {
        targetMinutes = explicit.targetMinutes
        isTargetFallback = false
        mainCategoryName = explicit.mainCategoryName
      } else if (prevWeekActualMap.has(mcId)) {
        targetMinutes = prevWeekActualMap.get(mcId)
        isTargetFallback = true
        mainCategoryName = spent?.mainCategoryName ?? ''
      } else {
        targetMinutes = 0
        isTargetFallback = false
        mainCategoryName = spent?.mainCategoryName ?? ''
      }

      const spentMinutes = spent?.spentMinutes ?? 0
      const remainingMinutes = Math.max(0, targetMinutes - spentMinutes)
      // Return the actual percentage — not capped — so UI can show values above 100%
      const progressPercentage =
        targetMinutes > 0 ? Math.round((spentMinutes / targetMinutes) * 100) : null

      return {
        mainCategoryId: mcId,
        mainCategoryName,
        targetMinutes,
        spentMinutes,
        remainingMinutes,
        progressPercentage,
        isTargetFallback,
      }
    })

    return Response.json({
      success: true,
      data: {
        weekStartDate: weekStart.toISOString().split('T')[0],
        today: todayStr,
        todayTimeline: todayActivities,
        todaySummary: { byMainCategory, bySubCategory },
        weeklyProgress,
      },
    })
  } catch (error) {
    console.error('GET /api/dashboard/weekly error:', error)
    return Response.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
}
