// Deterministic, no-network, no-database checks for Weekly Report Email Delivery (Phase 11,
// Milestone 6): email template rendering, Resend client error mapping, claim & lease transitions,
// bounded retries, unknown outcome handling, manual resend, and scheduler integration.
//
//   node scripts/weekly-report-email-check.mjs
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { register } from 'node:module'

register('./ai-eval-loader.mjs', import.meta.url)
process.env.DATABASE_URL ??= 'postgresql://unused:unused@localhost:5432/unused'

const { renderReportEmail } = await import('@/lib/email/renderReportEmail.js')
const { sendResendEmail } = await import('@/lib/email/resendClient.js')
const { EMAIL_ERROR, isRetryableEmailError } = await import('@/lib/email/emailErrors.js')
const {
  claimReportForEmail,
  sendWeeklyReportEmail,
  MAX_SCHEDULED_EMAIL_ATTEMPTS,
  STALE_EMAIL_TIMEOUT_MS,
} = await import('@/lib/services/weeklyReportEmailService.js')
const { processScheduledWeeklyReports } = await import(
  '@/lib/services/weeklyReportSchedulerService.js'
)
const { FIXTURES, VALID_REPLY } = await import('./weekly-report-fixtures.mjs')
const { WEEKLY_REPORT_EMAIL_STATUS, WEEKLY_REPORT_STATUS } = await import(
  '@/lib/analytics/reportStatus.js'
)

let passed = 0
const check = async (name, fn) => {
  await fn()
  passed += 1
  console.log(`ok - ${name}`)
}

const NOW = new Date('2026-10-12T12:00:00.000Z')
const asDate = (s) => new Date(`${s}T00:00:00.000Z`)

function fakeEmailDb({ preferences = [], reports = [] } = {}) {
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
      findFirst: async ({ where }) => {
        return reportRows.find((r) => {
          const matchId = where.id === undefined || r.id === where.id
          const matchUser = where.userId === undefined || r.userId === where.userId
          return matchId && matchUser
        }) ?? null
      },
      findUnique: async ({ where }) => {
        const { userId, weekStartDate } = where.userId_weekStartDate
        return reportRows.find(
          (r) => r.userId === userId && new Date(r.weekStartDate).getTime() === new Date(weekStartDate).getTime()
        ) ?? null
      },
      create: async ({ data }) => {
        const row = {
          id: nextReportId++,
          facts: null,
          content: null,
          generatedAt: null,
          errorCode: null,
          emailStatus: null,
          emailSentAt: null,
          emailAttemptCount: 0,
          emailErrorCode: null,
          emailRecipient: null,
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
          const matchEmailStatus =
            where.emailStatus === undefined || row.emailStatus === where.emailStatus

          if (matchId && matchUser && matchStatus && matchEmailStatus) {
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
      findMany: async () => [],
    },
    weeklyTarget: {
      findMany: async () => [],
    },
  }
  return { db, prefRows, reportRows }
}

const mockEmailClient = (outcome = { success: true, messageId: 'msg-123' }) => {
  const client = {
    calls: [],
    send: async (payload) => {
      client.calls.push(payload)
      if (outcome.error) {
        throw outcome.error
      }
      return outcome
    },
  }
  return client
}

// ---- 1. Email Template Rendering ---------------------------------------------------------------

await check('render: formats completed ai_report with subject, HTML and plain text', () => {
  const report = {
    id: 1,
    weekStartDate: '2026-10-05',
    facts: FIXTURES.typical,
    content: {
      schemaVersion: 1,
      kind: 'ai_report',
      overview: 'You logged 45 hrs 45 mins this week across 5 active days.',
      mainCategoryInsights: [
        { mainCategoryId: 10, headline: 'Work stayed steady', observed: 'Work logged 25 hrs 50 mins.', targetCommentary: 'Target met.', possibleExplanation: null },
      ],
      subCategoryInsights: [],
      observations: [{ observed: 'Active days were consistent.', possibleExplanation: null }],
      recommendations: [{ title: 'Schedule gym', action: 'Block two gym sessions', rationale: 'Help balance workload' }],
      dataNotes: [],
    },
  }

  const rendered = renderReportEmail({ report })
  assert.match(rendered.subject, /Weekly Productivity Report — Week of/i)
  assert.ok(rendered.html.includes('45 hrs 45 mins'))
  assert.ok(rendered.html.includes('Work stayed steady'))
  assert.ok(rendered.html.includes('Schedule gym'))
  assert.ok(rendered.text.includes('TimeLedger — Weekly Productivity Report'))
  assert.ok(rendered.text.includes('Total Time'))
})

await check('render: formats insufficient_data report without broken tables', () => {
  const report = {
    id: 2,
    weekStartDate: '2026-10-05',
    facts: FIXTURES.emptyWeek,
    content: {
      schemaVersion: 1,
      kind: 'insufficient_data',
      overview: 'No activity was logged from 2026-10-05 to 2026-10-11.',
      mainCategoryInsights: [],
      subCategoryInsights: [],
      observations: [],
      recommendations: [],
      dataNotes: [],
    },
  }

  const rendered = renderReportEmail({ report })
  assert.match(rendered.subject, /Weekly Productivity Report/i)
  assert.ok(rendered.html.includes('No activity was logged'))
  assert.ok(!rendered.html.includes('Target vs Actual'))
  assert.ok(rendered.text.includes('No activity was logged'))
})

await check('render: escapes user-generated text in HTML output', () => {
  const report = {
    id: 3,
    weekStartDate: '2026-10-05',
    facts: FIXTURES.typical,
    content: {
      schemaVersion: 1,
      kind: 'ai_report',
      overview: '<script>alert("xss")</script> & "quotes"',
      mainCategoryInsights: [],
      subCategoryInsights: [],
      observations: [],
      recommendations: [],
      dataNotes: [],
    },
  }

  const rendered = renderReportEmail({ report })
  assert.ok(!rendered.html.includes('<script>'))
  assert.ok(rendered.html.includes('&lt;script&gt;'))
  assert.ok(rendered.html.includes('&amp;'))
})

// ---- 2. Resend Client Error Mapping ------------------------------------------------------------

await check('resendClient: missing API key or from address fails with CONFIG_MISSING', async () => {
  await assert.rejects(
    () => sendResendEmail({ to: 'u@example.com', subject: 's', html: 'h', text: 't', apiKey: '', from: 'a@b.com' }),
    (e) => e.code === EMAIL_ERROR.CONFIG_MISSING
  )
  await assert.rejects(
    () => sendResendEmail({ to: 'u@example.com', subject: 's', html: 'h', text: 't', apiKey: 'key', from: '' }),
    (e) => e.code === EMAIL_ERROR.CONFIG_MISSING
  )
})

await check('resendClient: maps HTTP status codes to safe error codes', async () => {
  const makeFetch = (status, body = {}) => async () => ({
    status,
    json: async () => body,
  })

  await assert.rejects(
    () => sendResendEmail({ to: 'u@example.com', subject: 's', html: 'h', text: 't', apiKey: 'k', from: 'f@a.com', fetchFn: makeFetch(429) }),
    (e) => e.code === EMAIL_ERROR.RATE_LIMITED
  )
  await assert.rejects(
    () => sendResendEmail({ to: 'u@example.com', subject: 's', html: 'h', text: 't', apiKey: 'k', from: 'f@a.com', fetchFn: makeFetch(422) }),
    (e) => e.code === EMAIL_ERROR.INVALID_RECIPIENT
  )
  await assert.rejects(
    () => sendResendEmail({ to: 'u@example.com', subject: 's', html: 'h', text: 't', apiKey: 'k', from: 'f@a.com', fetchFn: makeFetch(502) }),
    (e) => e.code === EMAIL_ERROR.PROVIDER_UNAVAILABLE
  )
})

await check('resendClient: request timeout maps to UNKNOWN_OUTCOME', async () => {
  const timeoutFetch = async () => {
    const err = new Error('The operation was aborted')
    err.name = 'AbortError'
    throw err
  }

  await assert.rejects(
    () => sendResendEmail({ to: 'u@example.com', subject: 's', html: 'h', text: 't', apiKey: 'k', from: 'f@a.com', fetchFn: timeoutFetch }),
    (e) => e.code === EMAIL_ERROR.UNKNOWN_OUTCOME
  )
})

// ---- 3. Claiming, Leases & Retries -------------------------------------------------------------

await check('claimReportForEmail: rejects non-completed report', async () => {
  const { db } = fakeEmailDb({
    reports: [{ id: 1, userId: 'u1', weekStartDate: asDate('2026-10-05'), status: 'generating' }],
  })
  await assert.rejects(
    () => claimReportForEmail(db, 1, 'u1'),
    (e) => e.code === 'REPORT_NOT_COMPLETED' && e.status === 409
  )
})

await check('claimReportForEmail: rejects already sent report unless forced', async () => {
  const { db } = fakeEmailDb({
    reports: [
      {
        id: 1,
        userId: 'u1',
        weekStartDate: asDate('2026-10-05'),
        status: 'completed',
        emailStatus: 'sent',
        emailSentAt: NOW,
        emailAttemptCount: 1,
      },
    ],
  })

  await assert.rejects(
    () => claimReportForEmail(db, 1, 'u1'),
    (e) => e.code === 'EMAIL_ALREADY_SENT' && e.status === 409
  )

  // Force (manual resend) succeeds
  const claimed = await claimReportForEmail(db, 1, 'u1', { force: true })
  assert.equal(claimed.id, 1)
})

await check('claimReportForEmail: active sending lease rejects; stale lease (> 5m) reclaims', async () => {
  const recentTime = new Date(NOW.getTime() - 2 * 60 * 1000) // 2 mins ago
  const { db } = fakeEmailDb({
    reports: [
      {
        id: 1,
        userId: 'u1',
        weekStartDate: asDate('2026-10-05'),
        status: 'completed',
        emailStatus: 'sending',
        emailSentAt: recentTime,
        emailAttemptCount: 1,
      },
    ],
  })

  await assert.rejects(
    () => claimReportForEmail(db, 1, 'u1', { now: NOW }),
    (e) => e.code === 'EMAIL_IN_PROGRESS'
  )

  const staleTime = new Date(NOW.getTime() - 6 * 60 * 1000) // 6 mins ago
  const { db: staleDb } = fakeEmailDb({
    reports: [
      {
        id: 1,
        userId: 'u1',
        weekStartDate: asDate('2026-10-05'),
        status: 'completed',
        emailStatus: 'sending',
        emailSentAt: staleTime,
        emailAttemptCount: 1,
      },
    ],
  })

  const claimed = await claimReportForEmail(staleDb, 1, 'u1', { now: NOW })
  assert.equal(claimed.id, 1)
})

await check('claimReportForEmail: blocks automatic retry on UNKNOWN_OUTCOME', async () => {
  const { db } = fakeEmailDb({
    reports: [
      {
        id: 1,
        userId: 'u1',
        weekStartDate: asDate('2026-10-05'),
        status: 'completed',
        emailStatus: 'failed',
        emailErrorCode: EMAIL_ERROR.UNKNOWN_OUTCOME,
        emailAttemptCount: 1,
      },
    ],
  })

  // Automatic scheduler claim fails
  await assert.rejects(
    () => claimReportForEmail(db, 1, 'u1'),
    (e) => e.code === 'EMAIL_UNKNOWN_OUTCOME'
  )

  // Manual user claim succeeds
  const claimed = await claimReportForEmail(db, 1, 'u1', { force: true })
  assert.equal(claimed.id, 1)
})

await check('claimReportForEmail: bounds scheduled attempts to 3; manual resend bypasses cap', async () => {
  const { db } = fakeEmailDb({
    reports: [
      {
        id: 1,
        userId: 'u1',
        weekStartDate: asDate('2026-10-05'),
        status: 'completed',
        emailStatus: 'failed',
        emailErrorCode: EMAIL_ERROR.PROVIDER_UNAVAILABLE,
        emailAttemptCount: 3,
      },
    ],
  })

  // Scheduled attempt rejects
  await assert.rejects(
    () => claimReportForEmail(db, 1, 'u1', { maxAttempts: 3 }),
    (e) => e.code === 'EMAIL_ATTEMPTS_EXCEEDED'
  )

  // Manual resend bypasses cap
  const claimed = await claimReportForEmail(db, 1, 'u1', { force: true, maxAttempts: 3 })
  assert.equal(claimed.id, 1)
})

// ---- 4. Delivery Service End to End ------------------------------------------------------------

await check('delivery service: missing recipient records failure without calling provider', async () => {
  const { db, reportRows } = fakeEmailDb({
    reports: [{ id: 1, userId: 'u1', weekStartDate: asDate('2026-10-05'), status: 'completed' }],
  })
  const client = mockEmailClient()
  const result = await sendWeeklyReportEmail(1, {
    userId: 'u1',
    recipientEmail: null,
    db,
    emailClient: client,
    adminClient: { auth: { admin: { getUserById: async () => ({ data: { user: null } }) } } },
  })

  assert.equal(result.success, false)
  assert.equal(result.errorCode, EMAIL_ERROR.RECIPIENT_MISSING)
  assert.equal(reportRows[0].emailStatus, 'failed')
  assert.equal(reportRows[0].emailErrorCode, EMAIL_ERROR.RECIPIENT_MISSING)
  assert.equal(client.calls.length, 0)
})

await check('delivery service: successful send updates email fields and keeps report completed', async () => {
  const { db, reportRows } = fakeEmailDb({
    reports: [
      {
        id: 1,
        userId: 'u1',
        weekStartDate: '2026-10-05',
        status: 'completed',
        facts: FIXTURES.typical,
        content: { schemaVersion: 1, kind: 'ai_report', overview: 'overview text' },
      },
    ],
  })
  const client = mockEmailClient()
  const result = await sendWeeklyReportEmail(1, {
    userId: 'u1',
    recipientEmail: 'user@example.com',
    db,
    emailClient: client,
    now: NOW,
  })

  assert.equal(result.success, true)
  assert.equal(result.emailStatus, 'sent')
  assert.equal(reportRows[0].status, 'completed') // Report generation status untouched
  assert.equal(reportRows[0].emailStatus, 'sent')
  assert.equal(reportRows[0].emailRecipient, 'user@example.com')
  assert.equal(reportRows[0].emailAttemptCount, 1)
  assert.equal(client.calls.length, 1)
  assert.equal(client.calls[0].to, 'user@example.com')
})

await check('delivery service: provider failure records failed email status without altering report status', async () => {
  const { db, reportRows } = fakeEmailDb({
    reports: [
      {
        id: 1,
        userId: 'u1',
        weekStartDate: '2026-10-05',
        status: 'completed',
        facts: FIXTURES.typical,
        content: { schemaVersion: 1, kind: 'ai_report', overview: 'overview text' },
      },
    ],
  })
  const failingClient = mockEmailClient({ error: new Error('Resend 502 Bad Gateway') })
  const result = await sendWeeklyReportEmail(1, {
    userId: 'u1',
    recipientEmail: 'user@example.com',
    db,
    emailClient: failingClient,
    now: NOW,
  })

  assert.equal(result.success, false)
  assert.equal(result.emailStatus, 'failed')
  assert.equal(reportRows[0].status, 'completed') // Still completed!
  assert.equal(reportRows[0].emailStatus, 'failed')
  assert.equal(reportRows[0].emailErrorCode, EMAIL_ERROR.INTERNAL)
})

// ---- 5. Scheduler Integration ------------------------------------------------------------------

await check('scheduler: sends email only when weeklyEmailReportsEnabled is true', async () => {
  const { db, reportRows } = fakeEmailDb({
    preferences: [
      { id: 1, userId: 'u-no-email', productivityAgentEnabled: true, weeklyEmailReportsEnabled: false, timezone: 'America/Phoenix' },
      { id: 2, userId: 'u-email', productivityAgentEnabled: true, weeklyEmailReportsEnabled: true, timezone: 'America/Phoenix' },
    ],
  })

  const model = {
    invoke: async () => ({
      content: JSON.stringify(VALID_REPLY),
      response_metadata: {},
      usage_metadata: { input_tokens: 1500, output_tokens: 400 },
    }),
  }
  const client = mockEmailClient()
  const adminClient = {
    auth: {
      admin: {
        getUserById: async (id) => ({ data: { user: { email: `${id}@example.com` } } }),
      },
    },
  }

  const result = await processScheduledWeeklyReports({
    db,
    now: NOW,
    model,
    emailClient: client,
    adminClient,
  })

  assert.equal(result.completed, 2)
  assert.equal(result.emailsSent, 1)
  assert.equal(client.calls.length, 1)
  assert.equal(client.calls[0].to, 'u-email@example.com')

  const noEmailReport = reportRows.find((r) => r.userId === 'u-no-email')
  const emailReport = reportRows.find((r) => r.userId === 'u-email')
  assert.equal(noEmailReport.emailStatus, null)
  assert.equal(emailReport.emailStatus, 'sent')
})

await check('scheduler: delivers email for existing completed report without calling model again', async () => {
  const { db } = fakeEmailDb({
    preferences: [
      { id: 1, userId: 'u1', productivityAgentEnabled: true, weeklyEmailReportsEnabled: true, timezone: 'America/Phoenix' },
    ],
    reports: [
      {
        id: 10,
        userId: 'u1',
        weekStartDate: asDate('2026-10-05'),
        status: 'completed',
        emailStatus: null,
        facts: FIXTURES.typical,
        content: { schemaVersion: 1, kind: 'ai_report', overview: 'persisted text' },
      },
    ],
  })

  const model = { invoke: async () => assert.fail('Model must never be called for email delivery') }
  const client = mockEmailClient()
  const adminClient = { auth: { admin: { getUserById: async () => ({ data: { user: { email: 'u1@example.com' } } }) } } }

  const result = await processScheduledWeeklyReports({
    db,
    now: NOW,
    model,
    emailClient: client,
    adminClient,
  })

  assert.equal(result.emailsSent, 1)
  assert.equal(client.calls.length, 1)
})

// ---- 6. Manual Resend Scoping & Validation ---------------------------------------------------

await check('manual resend: enforces user scoping and rejects other user reports', async () => {
  const { db } = fakeEmailDb({
    reports: [
      { id: 1, userId: 'owner-user', weekStartDate: asDate('2026-10-05'), status: 'completed' },
    ],
  })
  await assert.rejects(
    () => sendWeeklyReportEmail(1, { userId: 'attacker-user', recipientEmail: 'attacker@example.com', force: true, db }),
    (e) => e.code === 'NOT_FOUND' && e.status === 404
  )
})

await check('manual resend: rejects non-existent or invalid report IDs', async () => {
  const { db } = fakeEmailDb()
  await assert.rejects(
    () => sendWeeklyReportEmail(999, { userId: 'u1', recipientEmail: 'u1@example.com', force: true, db }),
    (e) => e.code === 'NOT_FOUND' && e.status === 404
  )
})

// ---- 7. Static Migration Check -----------------------------------------------------------------

await check('migration SQL: adds email columns and check constraint to weekly_reports', () => {
  const sql = readFileSync(
    'prisma/migrations/20261012130000_add_weekly_report_email_delivery/migration.sql',
    'utf8'
  )
  assert.ok(sql.includes('ADD COLUMN "email_status" TEXT'))
  assert.ok(sql.includes('ADD COLUMN "email_sent_at" TIMESTAMPTZ'))
  assert.ok(sql.includes('ADD COLUMN "email_attempt_count" INTEGER'))
  assert.ok(sql.includes('ADD COLUMN "email_error_code" TEXT'))
  assert.ok(sql.includes('ADD COLUMN "email_recipient" TEXT'))
  assert.ok(sql.includes('CHECK ("email_status" IS NULL OR "email_status" IN (\'sending\', \'sent\', \'failed\'))'))
})

console.log(`\n${passed} email delivery checks passed`)
process.exit(0)
