import prisma from '@/lib/prisma'
import { calculateDurationMinutes, recalculateDailySummary } from '@/lib/activityHelpers'
import { ServiceError } from '@/lib/errors'
import { localDateTimeToUtc, addDaysToDateString } from '@/lib/timezone'

const ACTIVITY_INCLUDE = { subCategory: { include: { mainCategory: true } } }

export const SEARCH_DEFAULT_LIMIT = 20
export const SEARCH_MAX_LIMIT = 50
export const RECENT_DEFAULT_LIMIT = 5
export const RECENT_MAX_LIMIT = 20
const MAX_DAYS_WITH_TIME_WINDOW = 31

function clampLimit(limit, defaultLimit, maxLimit) {
  if (!Number.isFinite(limit)) return defaultLimit
  return Math.min(Math.max(Math.floor(limit), 1), maxLimit)
}

async function assertOwnedSubCategory(userId, subCategoryId) {
  const subCategory = await prisma.subCategory.findUnique({ where: { id: subCategoryId } })
  if (!subCategory || subCategory.userId !== userId) {
    throw new ServiceError('SUBCATEGORY_NOT_FOUND', 'Sub category not found', 400)
  }
}

async function findOwnedActivity(userId, activityId) {
  const existing = await prisma.activity.findUnique({ where: { id: activityId } })
  if (!existing || existing.userId !== userId) {
    throw new ServiceError('ACTIVITY_NOT_FOUND', 'Activity not found', 404)
  }
  return existing
}

export async function getActivity(userId, activityId) {
  await findOwnedActivity(userId, activityId)
  return prisma.activity.findUnique({ where: { id: activityId }, include: ACTIVITY_INCLUDE })
}

export async function createActivity(userId, input) {
  const { activityDate, title, subCategoryId, startTime, endTime, notes } = input

  if (!title || !title.trim()) {
    throw new ServiceError('VALIDATION_ERROR', 'title is required')
  }

  if (!activityDate || !subCategoryId || !startTime || !endTime) {
    throw new ServiceError(
      'VALIDATION_ERROR',
      'activityDate, subCategoryId, startTime, and endTime are required'
    )
  }

  if (new Date(endTime) <= new Date(startTime)) {
    throw new ServiceError('INVALID_TIME_RANGE', 'endTime must be later than startTime')
  }

  await assertOwnedSubCategory(userId, Number(subCategoryId))

  const durationMinutes = calculateDurationMinutes(startTime, endTime)
  const parsedActivityDate = new Date(activityDate)

  const activity = await prisma.activity.create({
    data: {
      userId,
      activityDate: parsedActivityDate,
      title: title.trim(),
      subCategoryId: Number(subCategoryId),
      startTime: new Date(startTime),
      endTime: new Date(endTime),
      durationMinutes,
      notes: notes ?? null,
    },
    include: ACTIVITY_INCLUDE,
  })

  await recalculateDailySummary(prisma, parsedActivityDate, Number(subCategoryId), userId)

  return activity
}

// `input` is a partial update: only keys that are present are changed.
export async function updateActivity(userId, activityId, input) {
  const existing = await findOwnedActivity(userId, activityId)

  const mergedTitle = 'title' in input ? input.title : existing.title
  const mergedActivityDate = 'activityDate' in input ? new Date(input.activityDate) : existing.activityDate
  const mergedSubCategoryId = 'subCategoryId' in input ? Number(input.subCategoryId) : existing.subCategoryId
  const mergedStartTime = 'startTime' in input ? new Date(input.startTime) : existing.startTime
  const mergedEndTime = 'endTime' in input ? new Date(input.endTime) : existing.endTime
  const mergedNotes = 'notes' in input ? input.notes : existing.notes

  if (!mergedTitle || !mergedTitle.trim()) {
    throw new ServiceError('VALIDATION_ERROR', 'title cannot be empty')
  }

  if (mergedEndTime <= mergedStartTime) {
    throw new ServiceError('INVALID_TIME_RANGE', 'endTime must be later than startTime')
  }

  if ('subCategoryId' in input) {
    await assertOwnedSubCategory(userId, mergedSubCategoryId)
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
    include: ACTIVITY_INCLUDE,
  })

  await recalculateDailySummary(prisma, mergedActivityDate, mergedSubCategoryId, userId)

  const dateChanged = existing.activityDate.getTime() !== mergedActivityDate.getTime()
  const subCategoryChanged = existing.subCategoryId !== mergedSubCategoryId

  if (dateChanged || subCategoryChanged) {
    await recalculateDailySummary(prisma, existing.activityDate, existing.subCategoryId, userId)
  }

  return updated
}

export async function deleteActivity(userId, activityId) {
  const existing = await findOwnedActivity(userId, activityId)
  const { activityDate, subCategoryId } = existing

  await prisma.activity.delete({ where: { id: activityId } })
  await recalculateDailySummary(prisma, activityDate, subCategoryId, userId)

  return { id: activityId }
}

// One OR branch per calendar day: the activity must overlap [timeFrom, timeTo) on that day.
function buildTimeWindowFilter({ startDate, endDate, timeFrom, timeTo, timezone }) {
  const from = timeFrom ?? '00:00'
  const to = timeTo ?? '24:00'
  const branches = []
  for (let day = startDate; day <= endDate; day = addDaysToDateString(day, 1)) {
    branches.push({
      activityDate: new Date(day),
      startTime: { lt: localDateTimeToUtc(day, to, timezone) },
      endTime: { gt: localDateTimeToUtc(day, from, timezone) },
    })
  }
  return { OR: branches }
}

// Filters (all optional, AND-combined):
//   startDate/endDate "YYYY-MM-DD" inclusive, query, mainCategoryId, subCategoryId,
//   timeFrom/timeTo "HH:mm" (needs a date range and `timezone`), limit.
// Ordered chronologically (activityDate ASC, startTime ASC).
export async function searchActivities(userId, filters) {
  const { startDate, endDate, query, mainCategoryId, subCategoryId, timeFrom, timeTo, timezone } = filters
  const limit = clampLimit(filters.limit, SEARCH_DEFAULT_LIMIT, SEARCH_MAX_LIMIT)

  if (startDate && endDate && startDate > endDate) {
    throw new ServiceError('VALIDATION_ERROR', 'startDate must not be after endDate')
  }

  const and = []
  const where = { userId, AND: and }

  if (startDate || endDate) {
    where.activityDate = {
      ...(startDate && { gte: new Date(startDate) }),
      ...(endDate && { lte: new Date(endDate) }),
    }
  }

  if (subCategoryId) where.subCategoryId = subCategoryId
  if (mainCategoryId) where.subCategory = { mainCategoryId }

  const trimmedQuery = query?.trim()
  if (trimmedQuery) {
    const contains = { contains: trimmedQuery, mode: 'insensitive' }
    and.push({
      OR: [
        { title: contains },
        { notes: contains },
        { subCategory: { name: contains } },
        { subCategory: { mainCategory: { name: contains } } },
      ],
    })
  }

  if (timeFrom || timeTo) {
    if (!startDate || !endDate) {
      throw new ServiceError('VALIDATION_ERROR', 'A time window requires a date or date range')
    }
    const days = (new Date(endDate) - new Date(startDate)) / 86400000 + 1
    if (days > MAX_DAYS_WITH_TIME_WINDOW) {
      throw new ServiceError(
        'VALIDATION_ERROR',
        `A time window can span at most ${MAX_DAYS_WITH_TIME_WINDOW} days`
      )
    }
    and.push(buildTimeWindowFilter({ startDate, endDate, timeFrom, timeTo, timezone }))
  }

  const [totalMatches, activities] = await Promise.all([
    prisma.activity.count({ where }),
    prisma.activity.findMany({
      where,
      include: ACTIVITY_INCLUDE,
      orderBy: [{ activityDate: 'asc' }, { startTime: 'asc' }],
      take: limit,
    }),
  ])

  return { activities, totalMatches }
}

export async function listRecentActivities(userId, limit) {
  return prisma.activity.findMany({
    where: { userId },
    include: ACTIVITY_INCLUDE,
    orderBy: [{ activityDate: 'desc' }, { startTime: 'desc' }],
    take: clampLimit(limit, RECENT_DEFAULT_LIMIT, RECENT_MAX_LIMIT),
  })
}
