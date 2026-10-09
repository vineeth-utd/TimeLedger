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
import { defineTool, formatClock, formatEndTime, serializeActivity } from '@/lib/ai/results'
import { ServiceError } from '@/lib/errors'

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
    'Prefer narrow filters. Results are chronological (oldest first), default 20, max 50. totalMinutes is the ' +
    'authoritative total duration of ALL matches (even if truncated).',
  schema: getActivitiesSchema,
  async handler(ctx, input) {
    const { date, ...filters } = input
    const { activities, totalMatches, totalMinutes } = await searchActivities(ctx.userId, {
      ...filters,
      startDate: date ?? input.startDate,
      endDate: date ?? input.endDate,
      timezone: ctx.timezone,
    })
    return {
      activities: activities.map((activity) => serializeActivity(activity, ctx.timezone)),
      totalMatches,
      totalMinutes,
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
    'Use for "latest/last/previous activity". Default 5, max 20.',
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
    'Create a NEW activity (add/log/record) on one calendar date. startTime/endTime are local HH:mm on ' +
    'activityDate; endTime may be "24:00" (internal end-of-day value for cross-midnight splits; never ask ' +
    'the user for it). Duration is automatic.',
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
    'Change an EXISTING activity (update/extend/move/rename) by activityId; never use it to add a new activity. ' +
    'Send ONLY the changed fields. Times are local HH:mm (endTime may be "24:00"); notes null/"" clears. ' +
    'Does not search.',
  schema: updateActivitySchema,
  async handler(ctx, input) {
    const patch = {}
    if (input.title !== undefined) patch.title = input.title
    if (input.subCategoryId !== undefined) patch.subCategoryId = input.subCategoryId
    if (input.notes !== undefined) patch.notes = input.notes

    // The values before the change are returned so the reply can say exactly what changed.
    const existing = await getActivity(ctx.userId, input.activityId)
    const previous = serializeActivity(existing, ctx.timezone)

    // Date/time changes are re-derived together from the existing row so a partial
    // change (e.g. only endTime) is merged correctly in the user's timezone.
    if ([input.activityDate, input.startTime, input.endTime].some((value) => value !== undefined)) {
      const activityDate = input.activityDate ?? dateOnlyToString(existing.activityDate)
      const startTime = input.startTime ?? utcToLocalDateTime(existing.startTime, ctx.timezone).time
      const endTime = input.endTime ?? formatEndTime(existing, ctx.timezone)
      patch.activityDate = activityDate
      patch.startTime = localDateTimeToUtc(activityDate, startTime, ctx.timezone).toISOString()
      patch.endTime = localDateTimeToUtc(activityDate, endTime, ctx.timezone).toISOString()
    }

    const activity = await updateActivity(ctx.userId, input.activityId, patch)
    return { activity: serializeActivity(activity, ctx.timezone), previous }
  },
})

// ---- deleteActivity ------------------------------------------------------

// Gated: runs only after the user approves the confirmation the workflow raises (see graph.js).
const SNAPSHOT_FIELDS = (activity) => [
  activity.title,
  activity.activityDate,
  activity.startTime,
  activity.endTime,
  activity.subCategory.id,
]

export const deleteActivityTool = defineTool({
  name: 'deleteActivity',
  description:
    'Delete one exactly identified activity by activityId. Requires user confirmation: the system asks the ' +
    'user automatically, so call this directly with the exact id (do not ask for confirmation in text).',
  schema: z.strictObject({ activityId: entityId }),
  confirmation: {
    kind: 'DELETE_ACTIVITY',
    async describe(ctx, { activityId }) {
      const activity = serializeActivity(await getActivity(ctx.userId, activityId), ctx.timezone)
      return {
        summary:
          `Delete activity "${activity.title}" on ${activity.activityDate}, ` +
          `${formatClock(activity.startTime)}\u2013${formatClock(activity.endTime)} ` +
          `(${activity.mainCategory.name} > ${activity.subCategory.name})`,
        activity,
      }
    },
    // The activity must still be what the user was shown.
    async verify(ctx, { activityId }, display) {
      const current = serializeActivity(await getActivity(ctx.userId, activityId), ctx.timezone)
      if (JSON.stringify(SNAPSHOT_FIELDS(current)) !== JSON.stringify(SNAPSHOT_FIELDS(display.activity))) {
        throw new ServiceError('ACTION_STALE', 'The activity changed after it was proposed; nothing was deleted.', 409)
      }
    },
  },
  async handler(ctx, { activityId }) {
    const { id } = await deleteActivity(ctx.userId, activityId)
    return { deletedActivityId: id }
  },
})
