// Deterministic, no-network, no-database checks for Scheduled Weekly Generation (Phase 11,
// Milestone 5): cron authentication, user eligibility, catch-up semantics, stale claim lease
// recovery, bounded retries, batch limits, and manual recovery.
//
//   node scripts/weekly-report-scheduler-check.mjs
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { register } from 'node:module'

register('./ai-eval-loader.mjs', import.meta.url)
process.env.DATABASE_URL ??= 'postgresql://unused:unused@localhost:5432/unused'

const {
  findEligibleScheduledUsers,
  processScheduledWeeklyReports,
} = await import('@/lib/services/weeklyReportSchedulerService.js')
const {
  claimReport,
  generateWeeklyReport,
  MAX_SCHEDULED_ATTEMPTS,
  STALE_CLAIM_TIMEOUT_MS,
} = await import('@/lib/services/weeklyReportGenerationService.js')
const { isAuthorizedCronRequest, GET: cronGetRoute } = await import(
  '@/app/api/cron/weekly-reports/route.js'
)
const { VALID_REPLY } = await import('./weekly-report-fixtures.mjs')
const { WEEKLY_REPORT_STATUS } = await import('@/lib/analytics/reportStatus.js')
const { REPORT_ERROR } = await import('@/lib/ai/report/reportSchema.js')

let passed = 0
const check = async (name, fn) => {
  await fn()
  passed += 1
  console.log(`ok - ${name}`)
}

const NOW = new Date('2026-10-12T12:00:00.000Z') // Monday 12:00 UTC
const asDate = (s) => new Date(`${s}T00:00:00.000Z`)

const modelReturning = (value) => ({
  calls: 0,
  invoke: async () => {
    return {
      content: typeof value === 'string' ? value : JSON.stringify(value),
      response_metadata: {},
      usage_metadata: { input_tokens: 1500, output_tokens: 400 },
    }
  },
})

// In-memory fake database for preferences and weekly reports
function fakeSchedulerDb({ preferences = [], reports = [], summaries = [], targets = [] } = {}) {
  const prefRows = preferences.map((p) => ({ ...p }))
  const reportRows = reports.map((r) => ({ ...r }))
  let nextReportId = 100

  const db = {
    userPreference: {
      findMany: async ({ where }) => {
        return prefRows
          .filter((p) => {
            if (where.productivityAgentEnabled !== undefined && p.productivityAgentEnabled !== where.productivityAgentEnabled) {
              return false
            }
            if (where.timezone?.not === null && (p.timezone === null || p.timezone === undefined)) {
              return false
            }
            return true
          })
          .map((p) => ({ ...p }))
      },
      findUnique: async ({ where }) => {
        const found = prefRows.find((p) => p.userId === where.userId)
        return found ? { ...found } : null
      },
    },
    weeklyReport: {
      findUnique: async ({ where }) => {
        const { userId, weekStartDate } = where.userId_weekStartDate
        const found = reportRows.find(
          (r) => r.userId === userId && new Date(r.weekStartDate).getTime() === new Date(weekStartDate).getTime()
        )
        return found ? { ...found } : null
      },
      create: async ({ data }) => {
        if (
          reportRows.some(
            (r) => r.userId === data.userId && new Date(r.weekStartDate).getTime() === new Date(data.weekStartDate).getTime()
          )
        ) {
          throw Object.assign(new Error('unique constraint'), { code: 'P2002' })
        }
        const row = {
          id: nextReportId++,
          facts: null,
          content: null,
          generatedAt: null,
          errorCode: null,
          ...data,
        }
        reportRows.push(row)
        return { ...row }
      },
      updateMany: async ({ where, data }) => {
        let count = 0
        for (const row of reportRows) {
          const matchId = where.id === undefined || row.id === where.id
          const matchUser = where.userId === undefined || row.userId === where.userId
          const matchStatus = where.status === undefined || row.status === where.status
          const matchStartedAt =
            where.generationStartedAt === undefined ||
            (row.generationStartedAt && new Date(row.generationStartedAt).getTime() === new Date(where.generationStartedAt).getTime())

          if (matchId && matchUser && matchStatus && matchStartedAt) {
            count += 1
            for (const [k, v] of Object.entries(data)) {
              if (v && typeof v === 'object' && 'increment' in v) {
                row[k] = (row[k] ?? 0) + v.increment
              } else {
                row[k] = v
              }
            }
          }
        }
        return { count }
      },
    },
    dailySubCategorySummary: {
      findMany: async () => summaries.map((s) => ({ ...s, summaryDate: asDate(s.summaryDate) })),
    },
    weeklyTarget: {
      findMany: async () => targets.map((t) => ({ ...t, weekStartDate: asDate(t.weekStartDate) })),
    },
  }
  return { db, prefRows, reportRows }
}

// ---- 1. Cron Authentication & Route Checks ----------------------------------------------------

await check('cron auth: missing CRON_SECRET env fails safe', () => {
  const original = process.env.CRON_SECRET
  delete process.env.CRON_SECRET
  try {
    const req = new Request('http://localhost:3000/api/cron/weekly-reports', {
      headers: { authorization: 'Bearer some-token' },
    })
    assert.equal(isAuthorizedCronRequest(req), false)
  } finally {
    process.env.CRON_SECRET = original
  }
})

await check('cron auth: missing or invalid authorization header fails', () => {
  process.env.CRON_SECRET = 'super-secret-token'
  const noHeader = new Request('http://localhost:3000/api/cron/weekly-reports')
  assert.equal(isAuthorizedCronRequest(noHeader), false)

  const wrongHeader = new Request('http://localhost:3000/api/cron/weekly-reports', {
    headers: { authorization: 'Bearer wrong-token' },
  })
  assert.equal(isAuthorizedCronRequest(wrongHeader), false)

  const wrongScheme = new Request('http://localhost:3000/api/cron/weekly-reports', {
    headers: { authorization: 'Basic super-secret-token' },
  })
  assert.equal(isAuthorizedCronRequest(wrongScheme), false)
})

await check('cron auth: matching Bearer token succeeds', () => {
  process.env.CRON_SECRET = 'super-secret-token'
  const req = new Request('http://localhost:3000/api/cron/weekly-reports', {
    headers: { authorization: 'Bearer super-secret-token' },
  })
  assert.equal(isAuthorizedCronRequest(req), true)
})

await check('cron route GET: returns 500 when CRON_SECRET is unconfigured', async () => {
  const original = process.env.CRON_SECRET
  delete process.env.CRON_SECRET
  try {
    const req = new Request('http://localhost:3000/api/cron/weekly-reports')
    const res = await cronGetRoute(req)
    assert.equal(res.status, 500)
    const body = await res.json()
    assert.equal(body.success, false)
    assert.equal(body.message, 'Server misconfiguration')
  } finally {
    process.env.CRON_SECRET = original
  }
})

await check('cron route GET: returns 401 when unauthorized', async () => {
  process.env.CRON_SECRET = 'valid-cron-secret'
  const req = new Request('http://localhost:3000/api/cron/weekly-reports', {
    headers: { authorization: 'Bearer invalid-token' },
  })
  const res = await cronGetRoute(req)
  assert.equal(res.status, 401)
  const body = await res.json()
  assert.equal(body.success, false)
  assert.equal(body.message, 'Unauthorized')
})

// ---- 2. User Eligibility & Timezone Resolution ------------------------------------------------

await check('eligibility: filters users by Agent enabled and valid timezone', async () => {
  const { db } = fakeSchedulerDb({
    preferences: [
      { id: 1, userId: 'u-disabled', productivityAgentEnabled: false, timezone: 'America/New_York' },
      { id: 2, userId: 'u-no-tz', productivityAgentEnabled: true, timezone: null },
      { id: 3, userId: 'u-invalid-tz', productivityAgentEnabled: true, timezone: 'Invalid/Zone' },
      { id: 4, userId: 'u-active-1', productivityAgentEnabled: true, timezone: 'America/Phoenix' },
      { id: 5, userId: 'u-active-2', productivityAgentEnabled: true, timezone: 'Asia/Tokyo' },
    ],
  })

  const eligible = await findEligibleScheduledUsers({ db, now: NOW })
  assert.equal(eligible.length, 2)
  assert.deepEqual(
    eligible.map((u) => u.userId),
    ['u-active-1', 'u-active-2']
  )
})

await check('eligibility: resolves latest completed week across timezones (catch-up semantics)', async () => {
  const { db } = fakeSchedulerDb({
    preferences: [
      { id: 1, userId: 'u-ny', productivityAgentEnabled: true, timezone: 'America/New_York' },
      { id: 2, userId: 'u-tokyo', productivityAgentEnabled: true, timezone: 'Asia/Tokyo' },
      { id: 3, userId: 'u-london', productivityAgentEnabled: true, timezone: 'Europe/London' },
    ],
  })

  // At 2026-10-12 12:00 UTC (Monday 12:00 UTC):
  // NY is Monday 08:00; Tokyo is Monday 21:00; London is Monday 13:00.
  // In all three, the week ending Sunday 2026-10-11 has completed.
  const eligibleMonday = await findEligibleScheduledUsers({ db, now: NOW })
  for (const u of eligibleMonday) {
    assert.equal(u.weekStartDate, '2026-10-05') // Monday of last week
  }

  // At 2026-10-15 12:00 UTC (Thursday 12:00 UTC) catch-up:
  const thursNow = new Date('2026-10-15T12:00:00.000Z')
  const eligibleThurs = await findEligibleScheduledUsers({ db, now: thursNow })
  for (const u of eligibleThurs) {
    assert.equal(u.weekStartDate, '2026-10-05') // Still the latest completed week
  }
})

// ---- 3. Idempotency & Claims ------------------------------------------------------------------

await check('scheduler: skips completed reports idempotently (zero LLM calls)', async () => {
  const { db } = fakeSchedulerDb({
    preferences: [{ id: 1, userId: 'u1', productivityAgentEnabled: true, timezone: 'America/Phoenix' }],
    reports: [
      {
        id: 10,
        userId: 'u1',
        weekStartDate: asDate('2026-10-05'),
        status: WEEKLY_REPORT_STATUS.COMPLETED,
        attemptCount: 1,
        content: { kind: 'ai_report' },
      },
    ],
  })

  const model = modelReturning(VALID_REPLY)
  const result = await processScheduledWeeklyReports({ db, now: NOW, model })
  assert.equal(result.processed, 0)
  assert.equal(result.completed, 0)
  assert.equal(result.skipped, 1)
  assert.equal(result.details[0].outcome, 'skipped')
  assert.equal(result.details[0].reason, 'already_completed')
  assert.equal(model.calls, 0)
})

await check('scheduler: skips active in-progress generating row (lease <= 10m)', async () => {
  const recentStartedAt = new Date(NOW.getTime() - 2 * 60 * 1000) // 2 minutes ago
  const { db } = fakeSchedulerDb({
    preferences: [{ id: 1, userId: 'u1', productivityAgentEnabled: true, timezone: 'America/Phoenix' }],
    reports: [
      {
        id: 10,
        userId: 'u1',
        weekStartDate: asDate('2026-10-05'),
        status: WEEKLY_REPORT_STATUS.GENERATING,
        attemptCount: 1,
        generationStartedAt: recentStartedAt,
      },
    ],
  })

  const model = modelReturning(VALID_REPLY)
  const result = await processScheduledWeeklyReports({ db, now: NOW, model })
  assert.equal(result.processed, 0)
  assert.equal(result.skipped, 1)
  assert.equal(result.details[0].reason, 'in_progress')
  assert.equal(model.calls, 0)
})

// ---- 4. Stale-Claim Lease Recovery ------------------------------------------------------------

await check('scheduler: reclaims stale generating row (> 10m) and retries when attempt < 3', async () => {
  const staleStartedAt = new Date(NOW.getTime() - 15 * 60 * 1000) // 15 minutes ago
  const { db, reportRows } = fakeSchedulerDb({
    preferences: [{ id: 1, userId: 'u1', productivityAgentEnabled: true, timezone: 'America/Phoenix' }],
    reports: [
      {
        id: 10,
        userId: 'u1',
        weekStartDate: asDate('2026-10-05'),
        status: WEEKLY_REPORT_STATUS.GENERATING,
        attemptCount: 1,
        generationStartedAt: staleStartedAt,
      },
    ],
  })

  const model = modelReturning(VALID_REPLY)
  const result = await processScheduledWeeklyReports({ db, now: NOW, model })
  assert.equal(result.processed, 1)
  assert.equal(result.completed, 1)
  assert.equal(reportRows[0].status, WEEKLY_REPORT_STATUS.COMPLETED)
  assert.equal(reportRows[0].attemptCount, 2) // Incremented
})

await check('scheduler: stale generating row with attemptCount >= 3 is transitioned to failed without model call', async () => {
  const staleStartedAt = new Date(NOW.getTime() - 15 * 60 * 1000)
  const { db, reportRows } = fakeSchedulerDb({
    preferences: [{ id: 1, userId: 'u1', productivityAgentEnabled: true, timezone: 'America/Phoenix' }],
    reports: [
      {
        id: 10,
        userId: 'u1',
        weekStartDate: asDate('2026-10-05'),
        status: WEEKLY_REPORT_STATUS.GENERATING,
        attemptCount: 3,
        generationStartedAt: staleStartedAt,
      },
    ],
  })

  const model = modelReturning(VALID_REPLY)
  const result = await processScheduledWeeklyReports({ db, now: NOW, model })
  assert.equal(result.processed, 0)
  assert.equal(result.attemptsExceeded, 1)
  assert.equal(reportRows[0].status, WEEKLY_REPORT_STATUS.FAILED)
  assert.equal(reportRows[0].errorCode, REPORT_ERROR.INTERNAL)
  assert.equal(model.calls, 0)
})

// ---- 5. Bounded Retries ------------------------------------------------------------------------

await check('scheduler: retries failed report if attemptCount < 3', async () => {
  const { db, reportRows } = fakeSchedulerDb({
    preferences: [{ id: 1, userId: 'u1', productivityAgentEnabled: true, timezone: 'America/Phoenix' }],
    reports: [
      {
        id: 10,
        userId: 'u1',
        weekStartDate: asDate('2026-10-05'),
        status: WEEKLY_REPORT_STATUS.FAILED,
        attemptCount: 2,
        errorCode: REPORT_ERROR.LLM_RATE_LIMITED,
      },
    ],
  })

  const model = modelReturning(VALID_REPLY)
  const result = await processScheduledWeeklyReports({ db, now: NOW, model })
  assert.equal(result.processed, 1)
  assert.equal(result.completed, 1)
  assert.equal(reportRows[0].status, WEEKLY_REPORT_STATUS.COMPLETED)
  assert.equal(reportRows[0].attemptCount, 3)
})

await check('scheduler: skips failed report if attemptCount >= 3 (bounded retries)', async () => {
  const { db, reportRows } = fakeSchedulerDb({
    preferences: [{ id: 1, userId: 'u1', productivityAgentEnabled: true, timezone: 'America/Phoenix' }],
    reports: [
      {
        id: 10,
        userId: 'u1',
        weekStartDate: asDate('2026-10-05'),
        status: WEEKLY_REPORT_STATUS.FAILED,
        attemptCount: 3,
        errorCode: REPORT_ERROR.LLM_RATE_LIMITED,
      },
    ],
  })

  const model = modelReturning(VALID_REPLY)
  const result = await processScheduledWeeklyReports({ db, now: NOW, model })
  assert.equal(result.processed, 0)
  assert.equal(result.attemptsExceeded, 1)
  assert.equal(reportRows[0].status, WEEKLY_REPORT_STATUS.FAILED)
  assert.equal(model.calls, 0) // No LLM generation
})

// ---- 6. Manual User Recovery -------------------------------------------------------------------

await check('manual recovery: manual generation can retry even when scheduled attempts >= 3', async () => {
  const { db, reportRows } = fakeSchedulerDb({
    preferences: [{ id: 1, userId: 'u1', productivityAgentEnabled: true, timezone: 'America/Phoenix' }],
    reports: [
      {
        id: 10,
        userId: 'u1',
        weekStartDate: asDate('2026-10-05'),
        status: WEEKLY_REPORT_STATUS.FAILED,
        attemptCount: 3,
        errorCode: REPORT_ERROR.LLM_UNAVAILABLE,
      },
    ],
  })

  const model = modelReturning(VALID_REPLY)
  // Manual call (no maxAttempts passed)
  const result = await generateWeeklyReport('u1', {
    timezone: 'America/Phoenix',
    now: NOW,
    model,
    db,
  })
  assert.equal(result.success, true)
  assert.equal(result.status, WEEKLY_REPORT_STATUS.COMPLETED)
  assert.equal(reportRows[0].status, WEEKLY_REPORT_STATUS.COMPLETED)
  assert.equal(reportRows[0].attemptCount, 4) // Successfully incremented beyond 3
})

await check('manual recovery: manual generation recovers stale generating row', async () => {
  const staleStartedAt = new Date(NOW.getTime() - 20 * 60 * 1000)
  const { db, reportRows } = fakeSchedulerDb({
    preferences: [{ id: 1, userId: 'u1', productivityAgentEnabled: true, timezone: 'America/Phoenix' }],
    reports: [
      {
        id: 10,
        userId: 'u1',
        weekStartDate: asDate('2026-10-05'),
        status: WEEKLY_REPORT_STATUS.GENERATING,
        attemptCount: 1,
        generationStartedAt: staleStartedAt,
      },
    ],
  })

  const model = modelReturning(VALID_REPLY)
  const result = await generateWeeklyReport('u1', {
    timezone: 'America/Phoenix',
    now: NOW,
    model,
    db,
  })
  assert.equal(result.success, true)
  assert.equal(reportRows[0].status, WEEKLY_REPORT_STATUS.COMPLETED)
  assert.equal(reportRows[0].attemptCount, 2)
})

// ---- 7. Batching & Time Budgeting -------------------------------------------------------------

await check('batching: stops when maxBatchSize is reached', async () => {
  const { db } = fakeSchedulerDb({
    preferences: [
      { id: 1, userId: 'u1', productivityAgentEnabled: true, timezone: 'America/Phoenix' },
      { id: 2, userId: 'u2', productivityAgentEnabled: true, timezone: 'America/Phoenix' },
      { id: 3, userId: 'u3', productivityAgentEnabled: true, timezone: 'America/Phoenix' },
      { id: 4, userId: 'u4', productivityAgentEnabled: true, timezone: 'America/Phoenix' },
    ],
  })

  const model = modelReturning(VALID_REPLY)
  const result = await processScheduledWeeklyReports({
    db,
    now: NOW,
    model,
    maxBatchSize: 2, // Only 2 users
  })
  assert.equal(result.processed, 2)
  assert.equal(result.completed, 2)
  assert.equal(result.skipped, 2)
  assert.equal(result.details[2].reason, 'batch_or_time_budget_exhausted')
  assert.equal(result.details[3].reason, 'batch_or_time_budget_exhausted')
})

await check('budgeting: stops when execution time budget is exhausted', async () => {
  const { db } = fakeSchedulerDb({
    preferences: [
      { id: 1, userId: 'u1', productivityAgentEnabled: true, timezone: 'America/Phoenix' },
      { id: 2, userId: 'u2', productivityAgentEnabled: true, timezone: 'America/Phoenix' },
    ],
  })

  const model = modelReturning(VALID_REPLY)
  const result = await processScheduledWeeklyReports({
    db,
    now: NOW,
    model,
    maxExecutionMs: 0, // Instant timeout
  })
  assert.equal(result.processed, 0)
  assert.equal(result.skipped, 2)
  assert.equal(result.details[0].reason, 'batch_or_time_budget_exhausted')
})

// ---- 8. Concurrent Scheduler Invocations ------------------------------------------------------

await check('concurrency: concurrent callers for the same user yield exactly one completed report', async () => {
  const { db, reportRows } = fakeSchedulerDb({
    preferences: [{ id: 1, userId: 'u1', productivityAgentEnabled: true, timezone: 'America/Phoenix' }],
  })

  const model = modelReturning(VALID_REPLY)
  const [res1, res2] = await Promise.all([
    processScheduledWeeklyReports({ db, now: NOW, model }),
    processScheduledWeeklyReports({ db, now: NOW, model }),
  ])

  const totalCompleted = res1.completed + res2.completed
  assert.equal(totalCompleted, 1)
  assert.equal(reportRows.length, 1)
  assert.equal(reportRows[0].status, WEEKLY_REPORT_STATUS.COMPLETED)
})

// ---- 9. vercel.json Static Check --------------------------------------------------------------

await check('vercel.json: configures crons path and daily schedule for Hobby deployment', () => {
  const content = JSON.parse(readFileSync('vercel.json', 'utf8'))
  assert.ok(Array.isArray(content.crons))
  const cron = content.crons.find((c) => c.path === '/api/cron/weekly-reports')
  assert.ok(cron, 'must define /api/cron/weekly-reports')
  assert.equal(cron.schedule, '0 12 * * *')
})

console.log(`\n${passed} scheduler checks passed`)
process.exit(0)

