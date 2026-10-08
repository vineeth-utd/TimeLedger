import { z } from 'zod'
import { dateOnlyToString, localDateTimeToUtc, utcToLocalDateTime } from '@/lib/timezone'
import {
  createActivity,
  deleteActivity,
  getActivity,
  listRecentActivities,
  searchActivities,
  updateActivity,
  SEARCH_MAX_LIMIT,
  RECENT_MAX_LIMIT,
} from '@/lib/services/activityService'
import { defineTool, formatEndTime, serializeActivity } from '@/lib/ai/results'

// ---- Shared field schemas ------------------------------------------------

const isRealDate = (value) => {
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}

const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD')
  .refine(isRealDate, 'Not a real calendar date')

const timeString = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Expected HH:mm (00:00-23:59)')

// "24:00" = end of the calendar day (00:00 of the next day). Internal tool-contract value used
// by the agent when splitting a cross-midnight activity (D 22:00-24:00 + D+1 00:00-01:00);
// valid only for end boundaries and never requested from the user.
const endTimeString = z
  .string()
  .regex(/^(([01]\d|2[0-3]):[0-5]\d|24:00)$/, 'Expected HH:mm, or 24:00 for end of day')

const entityId = z.number().int().positive()
const title = z.string()
const notes = z.string()

// ---- getActivities -------------------------------------------------------

const getActivitiesSchema = z
  .strictObject({
    date: dateString.optional(),
    startDate: dateString.optional(),
    endDate: dateString.optional(),
    query: z.string().optional(),
    mainCategoryId: entityId.optional(),
    subCategoryId: entityId.optional(),
    timeFrom: timeString.optional(),
    timeTo: endTimeString.optional(),
    limit: z.number().int().min(1).max(SEARCH_MAX_LIMIT).optional(),
  })
  .superRefine((input, ctx) => {
    const hasRange = input.startDate !== undefined || input.endDate !== undefined
    if (input.date !== undefined && hasRange) {
      ctx.addIssue({ code: 'custom', path: ['date'], message: 'Use either date or startDate + endDate, not both' })
    }
    if ((input.startDate === undefined) !== (input.endDate === undefined)) {
      ctx.addIssue({ code: 'custom', path: ['startDate'], message: 'startDate and endDate must be provided together' })
    }
  })

export const getActivitiesTool = defineTool({
  name: 'getActivities',
  description:
    "Search the authenticated user's activities. Filters are AND-combined: a single date (YYYY-MM-DD) or " +
    'startDate+endDate, a case-insensitive text query over title/notes/category names, exact mainCategoryId or ' +
    'subCategoryId, and an overlapping local time window (timeFrom/timeTo, HH:mm; requires a date or date range). ' +
    'Results are chronological (oldest first), default 20, max 50, with truncation metadata.',
  schema: getActivitiesSchema,
  async handler(ctx, input) {
    const { date, ...filters } = input
    const { activities, totalMatches } = await searchActivities(ctx.userId, {
      ...filters,
      startDate: date ?? input.startDate,
      endDate: date ?? input.endDate,
      timezone: ctx.timezone,
    })
    return {
      activities: activities.map((activity) => serializeActivity(activity, ctx.timezone)),
      totalMatches,
      returned: activities.length,
      truncated: totalMatches > activities.length,
    }
  },
})

// ---- getRecentActivities -------------------------------------------------

export const getRecentActivitiesTool = defineTool({
  name: 'getRecentActivities',
  description:
    "Get the authenticated user's most recent activities, newest first (by date, then start time). " +
    'Default 5, max 20.',
  schema: z.strictObject({ limit: z.number().int().min(1).max(RECENT_MAX_LIMIT).optional() }),
  async handler(ctx, { limit }) {
    const activities = await listRecentActivities(ctx.userId, limit)
    return {
      activities: activities.map((activity) => serializeActivity(activity, ctx.timezone)),
      returned: activities.length,
    }
  },
})

// ---- createActivity ------------------------------------------------------

export const createActivityTool = defineTool({
  name: 'createActivity',
  description:
    'Create one activity on a single calendar date. startTime/endTime are local HH:mm on activityDate; ' +
    'endTime may be "24:00" (internal end-of-day value for the first half of a cross-midnight split; ' +
    'never ask the user for it). Duration is calculated automatically.',
  schema: z.strictObject({
    title,
    activityDate: dateString,
    startTime: timeString,
    endTime: endTimeString,
    subCategoryId: entityId,
    notes: notes.optional(),
  }),
  async handler(ctx, input) {
    const activity = await createActivity(ctx.userId, {
      title: input.title,
      activityDate: input.activityDate,
      subCategoryId: input.subCategoryId,
      startTime: localDateTimeToUtc(input.activityDate, input.startTime, ctx.timezone).toISOString(),
      endTime: localDateTimeToUtc(input.activityDate, input.endTime, ctx.timezone).toISOString(),
      notes: input.notes,
    })
    return { activity: serializeActivity(activity, ctx.timezone) }
  },
})

// ---- updateActivity ------------------------------------------------------

const UPDATABLE_FIELDS = ['title', 'activityDate', 'startTime', 'endTime', 'subCategoryId', 'notes']

const updateActivitySchema = z
  .strictObject({
    activityId: entityId,
    title: title.optional(),
    activityDate: dateString.optional(),
    startTime: timeString.optional(),
    endTime: endTimeString.optional(),
    subCategoryId: entityId.optional(),
    notes: notes.nullable().optional(), // null or "" clears the notes
  })
  .refine((input) => UPDATABLE_FIELDS.some((field) => input[field] !== undefined), {
    message: 'Provide at least one field to update',
  })

export const updateActivityTool = defineTool({
  name: 'updateActivity',
  description:
    'Update one exactly identified activity by activityId. Only provided fields change. Times are local HH:mm ' +
    '(endTime may be the internal end-of-day value "24:00"); notes may be null/"" to clear. ' +
    'Does not search for activities.',
  schema: updateActivitySchema,
  async handler(ctx, input) {
    const patch = {}
    if (input.title !== undefined) patch.title = input.title
    if (input.subCategoryId !== undefined) patch.subCategoryId = input.subCategoryId
    if (input.notes !== undefined) patch.notes = input.notes

    // Date/time changes are re-derived together from the existing row so a partial
    // change (e.g. only endTime) is merged correctly in the user's timezone.
    if ([input.activityDate, input.startTime, input.endTime].some((value) => value !== undefined)) {
      const existing = await getActivity(ctx.userId, input.activityId)
      const activityDate = input.activityDate ?? dateOnlyToString(existing.activityDate)
      const startTime = input.startTime ?? utcToLocalDateTime(existing.startTime, ctx.timezone).time
      const endTime = input.endTime ?? formatEndTime(existing, ctx.timezone)
      patch.activityDate = activityDate
      patch.startTime = localDateTimeToUtc(activityDate, startTime, ctx.timezone).toISOString()
      patch.endTime = localDateTimeToUtc(activityDate, endTime, ctx.timezone).toISOString()
    }

    const activity = await updateActivity(ctx.userId, input.activityId, patch)
    return { activity: serializeActivity(activity, ctx.timezone) }
  },
})

// ---- deleteActivity ------------------------------------------------------

export const deleteActivityTool = defineTool({
  name: 'deleteActivity',
  description: 'Delete one exactly identified activity by activityId.',
  schema: z.strictObject({ activityId: entityId }),
  async handler(ctx, { activityId }) {
    const { id } = await deleteActivity(ctx.userId, activityId)
    return { deletedActivityId: id }
  },
})
