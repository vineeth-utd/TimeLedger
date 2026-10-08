import { ZodError } from 'zod'
import { ServiceError } from '@/lib/errors'
import { addDaysToDateString, dateOnlyToString, utcToLocalDateTime } from '@/lib/timezone'

// ---- Structured results -------------------------------------------------

export function ok(data = {}) {
  return { success: true, ...data }
}

export function fail(code, message) {
  return { success: false, error: { code, message } }
}

const DATE_FIELDS = new Set(['date', 'startDate', 'endDate', 'activityDate'])
const TIME_FIELDS = new Set(['timeFrom', 'timeTo', 'startTime', 'endTime'])

function zodErrorToFailure(error) {
  const [first] = error.issues
  const field = first?.path?.[0]
  const code = DATE_FIELDS.has(field) ? 'INVALID_DATE' : TIME_FIELDS.has(field) ? 'INVALID_TIME' : 'VALIDATION_ERROR'
  const message = error.issues
    .map((issue) => (issue.path.length ? `${issue.path.join('.')}: ${issue.message}` : issue.message))
    .join('; ')
  return fail(code, message)
}

// Defines a tool in a framework-neutral shape ({ name, description, schema, execute }).
// `schema` is a Zod object, reusable later for LangChain/LangGraph tool definitions.
// `execute(ctx, rawInput)` validates input, runs the handler, and never throws:
// service errors become structured errors; unexpected errors are logged and hidden.
export function defineTool({ name, description, schema, handler }) {
  async function execute(ctx, rawInput) {
    try {
      const input = schema.parse(rawInput ?? {})
      return ok(await handler(ctx, input))
    } catch (error) {
      if (error instanceof ZodError) return zodErrorToFailure(error)
      if (error instanceof ServiceError) return fail(error.code, error.message)
      console.error(`AI tool ${name} error:`, error)
      return fail('INTERNAL_ERROR', 'The operation could not be completed.')
    }
  }
  return { name, description, schema, execute }
}

// ---- Sanitized serializers (no raw Prisma records) -----------------------

// An end time at local midnight of the following day is exposed as "24:00" so
// split cross-midnight activities round-trip without gaps or double-counting.
export function formatEndTime(activity, timezone) {
  const end = utcToLocalDateTime(activity.endTime, timezone)
  const activityDate = dateOnlyToString(activity.activityDate)
  if (end.time === '00:00' && end.date === addDaysToDateString(activityDate, 1)) return '24:00'
  return end.time
}

export function serializeActivity(activity, timezone) {
  return {
    id: activity.id,
    title: activity.title,
    activityDate: dateOnlyToString(activity.activityDate),
    startTime: utcToLocalDateTime(activity.startTime, timezone).time,
    endTime: formatEndTime(activity, timezone),
    durationMinutes: activity.durationMinutes,
    notes: activity.notes,
    subCategory: { id: activity.subCategory.id, name: activity.subCategory.name },
    mainCategory: {
      id: activity.subCategory.mainCategory.id,
      name: activity.subCategory.mainCategory.name,
    },
  }
}

export function serializeSubCategory(subCategory) {
  return { id: subCategory.id, name: subCategory.name }
}

export function serializeMainCategory(mainCategory) {
  return { id: mainCategory.id, name: mainCategory.name }
}
