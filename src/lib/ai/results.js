import { ZodError } from 'zod'
import { ServiceError } from '@/lib/errors'
import { addDaysToDateString, dateOnlyToString, utcToLocalDateTime } from '@/lib/timezone'

// The model hit its output cap without producing a usable answer or a complete tool call.
export class OutputTruncatedError extends Error {
  constructor() {
    super('The model response was truncated by the output token limit')
    this.name = 'OutputTruncatedError'
  }
}

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

function toFailure(name, error) {
  if (error instanceof ZodError) return zodErrorToFailure(error)
  if (error instanceof ServiceError) return fail(error.code, error.message)
  console.error(`AI tool ${name} error:`, error)
  return fail('INTERNAL_ERROR', 'The operation could not be completed.')
}

// Defines a tool in a framework-neutral shape ({ name, description, schema, execute }).
// `schema` is a Zod object, reusable later for LangChain/LangGraph tool definitions.
// `execute(ctx, rawInput)` validates input, runs the handler, and never throws:
// service errors become structured errors; unexpected errors are logged and hidden.
//
// `confirmation` ({ kind, describe(ctx, input), verify?(ctx, input, display) }) marks a tool that
// must not run until the user approves. Such tools expose `prepareConfirmation` (validate + build
// the server-side display, no side effects) and `executeApproved` (re-verify, then execute); the
// graph runs them only after an approved interrupt.
export function defineTool({ name, description, schema, handler, confirmation }) {
  async function execute(ctx, rawInput) {
    try {
      const input = schema.parse(rawInput ?? {})
      return ok(await handler(ctx, input))
    } catch (error) {
      return toFailure(name, error)
    }
  }

  const tool = { name, description, schema, execute }
  if (confirmation) {
    tool.confirmation = { kind: confirmation.kind }
    tool.prepareConfirmation = async (ctx, rawInput) => {
      try {
        const input = schema.parse(rawInput ?? {})
        const display = await confirmation.describe(ctx, input)
        return { success: true, args: input, display }
      } catch (error) {
        return toFailure(name, error)
      }
    }
    tool.executeApproved = async (ctx, input, display) => {
      try {
        await confirmation.verify?.(ctx, input, display)
      } catch (error) {
        return toFailure(name, error)
      }
      return execute(ctx, input)
    }
  }
  return tool
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

// User-facing clock text: "07:00" -> "7:00 AM", end-of-day "24:00" -> "midnight".
export function formatClock(time) {
  if (time === '24:00') return 'midnight'
  const [hour, minute] = time.split(':').map(Number)
  return `${hour % 12 || 12}:${String(minute).padStart(2, '0')} ${hour < 12 ? 'AM' : 'PM'}`
}

export function serializeSubCategory(subCategory) {
  return { id: subCategory.id, name: subCategory.name }
}

export function serializeMainCategory(mainCategory) {
  return { id: mainCategory.id, name: mainCategory.name }
}
