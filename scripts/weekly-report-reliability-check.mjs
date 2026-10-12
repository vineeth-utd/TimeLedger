// Deterministic reliability and hardening checks for Phase 11, Milestone 7:
// 1. Scheduler continuation after unexpected per-user email failure.
// 2. Safe Supabase Admin lookup/configuration failure (differentiating CONFIG_MISSING vs RECIPIENT_MISSING).
// 3. Phase 11 safe logging audit (verifying no secrets, prompts, report bodies, or recipient emails are logged).
//
//   node scripts/weekly-report-reliability-check.mjs
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { register } from 'node:module'

register('./ai-eval-loader.mjs', import.meta.url)
process.env.DATABASE_URL ??= 'postgresql://unused:unused@localhost:5432/unused'

const { processScheduledWeeklyReports } = await import(
  '@/lib/services/weeklyReportSchedulerService.js'
)
const { sendWeeklyReportEmail } = await import(
  '@/lib/services/weeklyReportEmailService.js'
)
const { EMAIL_ERROR } = await import('@/lib/email/emailErrors.js')
const { WEEKLY_REPORT_STATUS } = await import('@/lib/analytics/reportStatus.js')
const { FIXTURES, VALID_REPLY } = await import('./weekly-report-fixtures.mjs')

let passed = 0
const check = async (name, fn) => {
  await fn()
  passed += 1
  console.log(`ok - ${name}`)
}

const NOW = new Date('2026-10-12T12:00:00.000Z')
const asDate = (s) => new Date(`${s}T00:00:00.000Z`)

function fakeDb({ preferences = [], reports = [] } = {}) {
  const prefRows = preferences.map((p) => ({ ...p }))
  const reportRows = reports.map((r) => ({ ...r }))
  let nextId = 100

  const db = {
    userPreference: {
      findMany: async ({ where }) =>
        prefRows
          .filter((p) => {
            if (where.productivityAgentEnabled !== undefined && p.productivityAgentEnabled !== where.productivityAgentEnabled) return false
            if (where.timezone?.not === null && !p.timezone) return false
            return true
          })
          .map((p) => ({ ...p })),
    },
    weeklyReport: {
      findUnique: async ({ where }) => {
        const { userId, weekStartDate } = where.userId_weekStartDate
        const found = reportRows.find(
          (r) => r.userId === userId && new Date(r.weekStartDate).getTime() === new Date(weekStartDate).getTime()
        )
        return found ? { ...found } : null
      },
      findFirst: async ({ where }) => {
        const found = reportRows.find((r) => {
          if (where.id !== undefined && r.id !== where.id) return false
          if (where.userId !== undefined && r.userId !== where.userId) return false
          return true
        })
        return found ? { ...found } : null
      },
      create: async ({ data }) => {
        const row = {
          id: nextId++,
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
          const matchEmailStatus = where.emailStatus === undefined || row.emailStatus === where.emailStatus

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
    dailySubCategorySummary: { findMany: async () => [] },
    weeklyTarget: { findMany: async () => [] },
  }
  return { db, prefRows, reportRows }
}

// ---- 1. Scheduler Continuation After Unexpected Email Failure ---------------------------------

await check('scheduler resilience: unexpected email crash for User 1 does not abort User 2 processing', async () => {
  const { db, reportRows } = fakeDb({
    preferences: [
      { id: 1, userId: 'u1-crash', productivityAgentEnabled: true, weeklyEmailReportsEnabled: true, timezone: 'America/Phoenix' },
      { id: 2, userId: 'u2-ok', productivityAgentEnabled: true, weeklyEmailReportsEnabled: true, timezone: 'America/Phoenix' },
    ],
  })

  const model = {
    invoke: async () => ({
      content: JSON.stringify(VALID_REPLY),
      response_metadata: {},
      usage_metadata: { input_tokens: 1500, output_tokens: 400 },
    }),
  }

  const emailClient = {
    send: async ({ to }) => {
      if (to.includes('u1-crash')) {
        throw new Error('Unexpected fatal socket crash')
      }
      return { success: true, messageId: 'msg-ok' }
    },
  }

  const adminClient = {
    auth: {
      admin: {
        getUserById: async (id) => ({ data: { user: { email: `${id}@example.com` } } }),
      },
    },
  }

  const summary = await processScheduledWeeklyReports({
    db,
    now: NOW,
    model,
    emailClient,
    adminClient,
  })

  assert.equal(summary.processed, 2, 'Both users must be processed')
  assert.equal(summary.completed, 2, 'Both reports must be generated and completed')
  assert.equal(summary.emailsSent, 1, 'User 2 email must succeed')
  assert.equal(summary.emailsFailed, 1, 'User 1 email must be counted as failed')

  const report1 = reportRows.find((r) => r.userId === 'u1-crash')
  const report2 = reportRows.find((r) => r.userId === 'u2-ok')
  assert.equal(report1.status, WEEKLY_REPORT_STATUS.COMPLETED, 'Report 1 remains completed despite email error')
  assert.equal(report2.status, WEEKLY_REPORT_STATUS.COMPLETED)
  assert.equal(report2.emailStatus, 'sent')
})

// ---- 2. Safe Supabase Admin Lookup & Configuration Error Differentiation -----------------------

await check('admin lookup safety: missing admin credentials fails safe with CONFIG_MISSING', async () => {
  const { db, reportRows } = fakeDb({
    reports: [
      {
        id: 1,
        userId: 'u1',
        weekStartDate: asDate('2026-10-05'),
        status: WEEKLY_REPORT_STATUS.COMPLETED,
        facts: FIXTURES.typical,
        content: { schemaVersion: 1, kind: 'ai_report', overview: 'text' },
      },
    ],
  })

  const origKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  delete process.env.SUPABASE_SERVICE_ROLE_KEY

  try {
    const result = await sendWeeklyReportEmail(1, {
      userId: 'u1',
      db,
      // No recipientEmail, no adminClient: triggers getSupabaseAdminClient() with missing key
    })

    assert.equal(result.success, false)
    assert.equal(result.errorCode, EMAIL_ERROR.CONFIG_MISSING)
    assert.equal(reportRows[0].emailStatus, 'failed')
    assert.equal(reportRows[0].emailErrorCode, EMAIL_ERROR.CONFIG_MISSING)
  } finally {
    process.env.SUPABASE_SERVICE_ROLE_KEY = origKey
  }
})

await check('admin lookup safety: user without email address fails safe with RECIPIENT_MISSING', async () => {
  const { db, reportRows } = fakeDb({
    reports: [
      {
        id: 2,
        userId: 'u-no-email',
        weekStartDate: asDate('2026-10-05'),
        status: WEEKLY_REPORT_STATUS.COMPLETED,
        facts: FIXTURES.typical,
        content: { schemaVersion: 1, kind: 'ai_report', overview: 'text' },
      },
    ],
  })

  const mockAdminClient = {
    auth: {
      admin: {
        getUserById: async () => ({ data: { user: { email: null } } }),
      },
    },
  }

  const result = await sendWeeklyReportEmail(2, {
    userId: 'u-no-email',
    db,
    adminClient: mockAdminClient,
  })

  assert.equal(result.success, false)
  assert.equal(result.errorCode, EMAIL_ERROR.RECIPIENT_MISSING)
  assert.equal(reportRows[0].emailStatus, 'failed')
  assert.equal(reportRows[0].emailErrorCode, EMAIL_ERROR.RECIPIENT_MISSING)
})

// ---- 3. Phase 11 Safe Logging Static Audit -----------------------------------------------------

await check('safe logging audit: Phase 11 code never logs credentials, prompts, facts or emails', () => {
  const PHASE_11_FILES = [
    'src/lib/services/weeklyReportEmailService.js',
    'src/lib/services/weeklyReportGenerationService.js',
    'src/lib/services/weeklyReportSchedulerService.js',
    'src/lib/services/productivityAgentService.js',
    'src/lib/email/resendClient.js',
    'src/lib/email/renderReportEmail.js',
    'src/lib/email/emailErrors.js',
    'src/lib/supabase/admin.js',
    'src/app/api/productivity-agent/preferences/route.js',
    'src/app/api/productivity-agent/reports/route.js',
    'src/app/api/productivity-agent/reports/[id]/route.js',
    'src/app/api/productivity-agent/reports/[id]/email/route.js',
    'src/app/api/cron/weekly-reports/route.js',
  ]

  const DISALLOWED_TOKENS = [
    'apiKey',
    'serviceRoleKey',
    'secret',
    'password',
    'prompt',
    'rawFacts',
    'facts',
    'content',
    'recipientEmail',
    'user.email',
  ]

  for (const file of PHASE_11_FILES) {
    if (!existsSync(file)) continue
    const source = readFileSync(file, 'utf8')
    const lines = source.split('\n')

    lines.forEach((line, index) => {
      const trimmed = line.trim()
      if (trimmed.startsWith('//') || trimmed.startsWith('*')) return

      if (trimmed.includes('console.log') || trimmed.includes('console.error') || trimmed.includes('console.warn')) {
        for (const token of DISALLOWED_TOKENS) {
          assert.ok(
            !line.includes(`\${${token}`) && !line.includes(`\${error.message`),
            `Potential unsafe logging in ${file}:${index + 1}: contains "${token}"`
          )
        }
      }
    })
  }
})

console.log(`\n${passed} reliability checks passed`)
process.exit(0)

