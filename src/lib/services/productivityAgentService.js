import prisma from '@/lib/prisma'
import { ServiceError } from '@/lib/errors'
import { isValidTimeZone } from '@/lib/timezone'

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
