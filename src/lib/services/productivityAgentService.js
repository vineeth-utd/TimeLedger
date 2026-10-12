import prisma from '@/lib/prisma'
import { ServiceError } from '@/lib/errors'
import { dateOnlyToString, isValidTimeZone } from '@/lib/timezone'
import { generateWeeklyReport } from '@/lib/services/weeklyReportGenerationService'
import { resolveReportPeriods } from '@/lib/services/weeklyReportService'

// Both features are off until the user opts in; the row is created on the first update.
const DEFAULTS = Object.freeze({
  productivityAgentEnabled: false,
  weeklyEmailReportsEnabled: false,
  timezone: null,
})

const isBoolean = (value) => typeof value === 'boolean'

// Stored flags plus the effective behavior derived from them. The email preference is kept
// independently of the parent feature: it only takes effect while the Agent is enabled.
function toPreferences(row) {
  const { productivityAgentEnabled, weeklyEmailReportsEnabled, timezone } = row ?? DEFAULTS
  return {
    productivityAgentEnabled,
    weeklyEmailReportsEnabled,
    timezone,
    scheduledGenerationEnabled: productivityAgentEnabled && isValidTimeZone(timezone),
    emailDeliveryEnabled: productivityAgentEnabled && weeklyEmailReportsEnabled,
  }
}

export async function getPreferences(userId, { db = prisma } = {}) {
  requireUserId(userId)
  return toPreferences(await db.userPreference.findUnique({ where: { userId } }))
}

function requireUserId(userId) {
  if (!userId || typeof userId !== 'string') {
    throw new ServiceError('VALIDATION_ERROR', 'userId is required')
  }
}

// Explicit authenticated operation (never called while merely rendering a page). `timezone` is the
// browser IANA timezone; the latest value replaces the stored one. Only the three preference
// fields are read from the input, so identity always comes from the `userId` argument.
export async function updatePreferences(userId, input = {}, { db = prisma } = {}) {
  requireUserId(userId)
  const { productivityAgentEnabled, weeklyEmailReportsEnabled, timezone } = input ?? {}

  for (const [name, value] of [
    ['productivityAgentEnabled', productivityAgentEnabled],
    ['weeklyEmailReportsEnabled', weeklyEmailReportsEnabled],
  ]) {
    if (value !== undefined && !isBoolean(value)) {
      throw new ServiceError('VALIDATION_ERROR', `${name} must be a boolean`)
    }
  }
  if (timezone !== undefined && !isValidTimeZone(timezone)) {
    throw new ServiceError('VALIDATION_ERROR', 'timezone must be a valid IANA timezone')
  }

  const current = await db.userPreference.findUnique({ where: { userId } })
  const nextTimezone = timezone ?? current?.timezone ?? null
  if (productivityAgentEnabled === true && !nextTimezone) {
    throw new ServiceError('VALIDATION_ERROR', 'A valid timezone is required to enable the AI Productivity Agent')
  }

  const changes = {}
  if (productivityAgentEnabled !== undefined) changes.productivityAgentEnabled = productivityAgentEnabled
  if (weeklyEmailReportsEnabled !== undefined) changes.weeklyEmailReportsEnabled = weeklyEmailReportsEnabled
  if (timezone !== undefined) changes.timezone = timezone

  const row = await db.userPreference.upsert({
    where: { userId },
    update: changes,
    create: { userId, ...changes },
  })
  return toPreferences(row)
}

const HISTORY_LIMIT = 52

const toReportSummary = (row) => ({
  id: row.id,
  weekStartDate: dateOnlyToString(row.weekStartDate),
  status: row.status,
  errorCode: row.errorCode,
  generatedAt: row.generatedAt,
})

// Report history (metadata only, newest first) plus the week a manual generation would target
// (the latest completed week in the stored timezone; null until a timezone is stored). Reports are
// listed regardless of the Agent preference: history survives disabling.
export async function listWeeklyReports(userId, { db = prisma, now = new Date() } = {}) {
  requireUserId(userId)
  const [rows, preferences] = await Promise.all([
    db.weeklyReport.findMany({
      where: { userId },
      orderBy: { weekStartDate: 'desc' },
      take: HISTORY_LIMIT,
      select: { id: true, weekStartDate: true, status: true, errorCode: true, generatedAt: true },
    }),
    getPreferences(userId, { db }),
  ])
  const targetWeekStartDate = isValidTimeZone(preferences.timezone)
    ? resolveReportPeriods({ timezone: preferences.timezone, now }).report.weekStartDate
    : null
  return { reports: rows.map(toReportSummary), targetWeekStartDate }
}

// One persisted report owned by the user (facts + content for rendering). Another user's id is
// indistinguishable from a missing one. Generation metadata (provider, model, usage) is not returned.
export async function getWeeklyReport(userId, id, { db = prisma } = {}) {
  requireUserId(userId)
  const notFound = () => new ServiceError('NOT_FOUND', 'Report not found', 404)
  if (!Number.isInteger(id) || id <= 0) throw notFound()
  const row = await db.weeklyReport.findFirst({
    where: { id, userId },
    select: { id: true, weekStartDate: true, status: true, errorCode: true, generatedAt: true, facts: true, content: true },
  })
  if (!row) throw notFound()
  const { meta: _meta, ...content } = row.content ?? {}
  return { ...toReportSummary(row), facts: row.facts, content: row.content ? content : null }
}

// Manual generation for the latest completed week, using the stored timezone (never client input).
// Blocked while the Agent is disabled. Completed reports are never regenerated (M3 REPORT_EXISTS);
// a failed one is retried. Returns the generation outcome; failures to even start throw ServiceError.
export async function requestWeeklyReportGeneration(userId, { db = prisma, model, now } = {}) {
  requireUserId(userId)
  const preferences = await getPreferences(userId, { db })
  if (!preferences.productivityAgentEnabled) {
    throw new ServiceError('AGENT_DISABLED', 'Enable the AI Productivity Agent to generate reports', 409)
  }
  if (!isValidTimeZone(preferences.timezone)) {
    throw new ServiceError('VALIDATION_ERROR', 'A valid timezone is required to generate reports')
  }
  return generateWeeklyReport(userId, { timezone: preferences.timezone, db, model, now })
}
