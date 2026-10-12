// Deterministic, no-network, no-database checks for the Productivity Agent persistence foundation
// (Phase 11, Milestone 2): preference semantics/validation/scoping, plus static checks of
// schema.prisma and the migration SQL (constraints, RLS, policies, status list).
//
//   node scripts/productivity-agent-check.mjs
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { register } from 'node:module'

register('./ai-eval-loader.mjs', import.meta.url)
process.env.DATABASE_URL ??= 'postgresql://unused:unused@localhost:5432/unused' // never connected

const { getPreferences, updatePreferences, listWeeklyReports, getWeeklyReport, requestWeeklyReportGeneration } = await import(
  '@/lib/services/productivityAgentService.js'
)
const { FIXTURES } = await import('./weekly-report-fixtures.mjs')
const { buildInsufficientDataContent } = await import('@/lib/ai/report/generateReportContent.js')
const { WEEKLY_REPORT_STATUSES } = await import('@/lib/analytics/reportStatus.js')

let passed = 0
const check = async (name, fn) => {
  await fn()
  passed += 1
  console.log(`ok - ${name}`)
}

// In-memory stand-in for prisma.userPreference that records every `where`.
function fakeDb(initial = []) {
  const rows = new Map(initial.map((r) => [r.userId, { ...r }]))
  const wheres = []
  const userPreference = {
    findUnique: async ({ where }) => {
      wheres.push(where)
      return rows.get(where.userId) ?? null
    },
    upsert: async ({ where, update, create }) => {
      wheres.push(where)
      const existing = rows.get(where.userId)
      const next = existing
        ? { ...existing, ...update }
        : { productivityAgentEnabled: false, weeklyEmailReportsEnabled: false, timezone: null, ...create }
      rows.set(where.userId, next)
      return next
    },
  }
  return { db: { userPreference }, rows, wheres }
}

await check('defaults when no row exists', async () => {
  const { db } = fakeDb()
  assert.deepEqual(await getPreferences('u1', { db }), {
    productivityAgentEnabled: false,
    weeklyEmailReportsEnabled: false,
    timezone: null,
    scheduledGenerationEnabled: false,
    emailDeliveryEnabled: false,
  })
})

await check('derived behavior for all flag combinations', async () => {
  const cases = [
    [false, false, false, false],
    [false, true, false, false], // Agent OFF + Email ON: nothing generated, nothing sent
    [true, false, true, false], // Agent ON + Email OFF: generate, do not email
    [true, true, true, true], // both ON: generate and email
  ]
  for (const [agent, email, scheduled, emailed] of cases) {
    const { db } = fakeDb([
      { userId: 'u1', productivityAgentEnabled: agent, weeklyEmailReportsEnabled: email, timezone: 'America/Phoenix' },
    ])
    const p = await getPreferences('u1', { db })
    assert.equal(p.scheduledGenerationEnabled, scheduled)
    assert.equal(p.emailDeliveryEnabled, emailed)
  }
})

await check('email preference can be saved while the Agent is off', async () => {
  const { db } = fakeDb()
  const p = await updatePreferences('u1', { weeklyEmailReportsEnabled: true }, { db })
  assert.equal(p.weeklyEmailReportsEnabled, true)
  assert.equal(p.productivityAgentEnabled, false)
  assert.equal(p.emailDeliveryEnabled, false)
})

await check('disabling the Agent keeps the email preference', async () => {
  const { db } = fakeDb()
  await updatePreferences('u1', { productivityAgentEnabled: true, weeklyEmailReportsEnabled: true, timezone: 'UTC' }, { db })
  const p = await updatePreferences('u1', { productivityAgentEnabled: false }, { db })
  assert.equal(p.weeklyEmailReportsEnabled, true)
  assert.equal(p.timezone, 'UTC')
  assert.equal(p.scheduledGenerationEnabled, false)
  assert.equal(p.emailDeliveryEnabled, false)
})

await check('enabling requires a timezone (supplied or stored)', async () => {
  const { db } = fakeDb()
  await assert.rejects(() => updatePreferences('u1', { productivityAgentEnabled: true }, { db }), { code: 'VALIDATION_ERROR' })
  const p = await updatePreferences('u1', { productivityAgentEnabled: true, timezone: 'America/Phoenix' }, { db })
  assert.equal(p.scheduledGenerationEnabled, true)
  const again = await updatePreferences('u1', { productivityAgentEnabled: false }, { db })
  const reenabled = await updatePreferences('u1', { productivityAgentEnabled: true }, { db }) // uses stored timezone
  assert.equal(again.productivityAgentEnabled, false)
  assert.equal(reenabled.scheduledGenerationEnabled, true)
})

await check('timezone updates only through an explicit update; latest value wins', async () => {
  const { db, rows } = fakeDb([{ userId: 'u1', productivityAgentEnabled: true, weeklyEmailReportsEnabled: false, timezone: 'UTC' }])
  await getPreferences('u1', { db })
  assert.equal(rows.get('u1').timezone, 'UTC') // reading never mutates
  const p = await updatePreferences('u1', { timezone: 'Europe/Paris' }, { db })
  assert.equal(p.timezone, 'Europe/Paris')
})

await check('invalid input is rejected without writing', async () => {
  const { db, rows } = fakeDb()
  for (const bad of [
    { timezone: 'Not/AZone' },
    { timezone: '' },
    { timezone: null },
    { productivityAgentEnabled: 'true' },
    { weeklyEmailReportsEnabled: 1 },
  ]) {
    await assert.rejects(() => updatePreferences('u1', bad, { db }), { code: 'VALIDATION_ERROR' })
  }
  await assert.rejects(() => updatePreferences('', {}, { db }), { code: 'VALIDATION_ERROR' })
  assert.equal(rows.size, 0)
})

await check('queries are scoped by the authenticated userId; input userId is ignored', async () => {
  const { db, rows, wheres } = fakeDb()
  await updatePreferences('u1', { userId: 'attacker', timezone: 'UTC', weeklyEmailReportsEnabled: true }, { db })
  await getPreferences('u1', { db })
  assert.ok(wheres.length >= 3 && wheres.every((w) => w.userId === 'u1'))
  assert.deepEqual([...rows.keys()], ['u1'])
})

// --- static checks: schema.prisma + migration SQL ---
const schema = readFileSync(new URL('../prisma/schema.prisma', import.meta.url), 'utf8')
const migrationsDir = new URL('../prisma/migrations/', import.meta.url)
const folder = readdirSync(migrationsDir).find((n) => n.endsWith('_add_productivity_agent_tables'))
const sql = folder ? readFileSync(new URL(`${folder}/migration.sql`, migrationsDir), 'utf8') : ''
const model = (name) => schema.match(new RegExp(`model ${name} \\{[\\s\\S]*?\\n\\}`))?.[0] ?? ''

await check('schema: preferences model (unique user, defaults off, nullable timezone)', () => {
  const m = model('UserPreference')
  assert.match(m, /userId\s+String\s+@unique @db\.Uuid @map\("user_id"\)/)
  assert.match(m, /productivityAgentEnabled\s+Boolean\s+@default\(false\)/)
  assert.match(m, /weeklyEmailReportsEnabled\s+Boolean\s+@default\(false\)/)
  assert.match(m, /timezone\s+String\?/)
  assert.match(m, /@@map\("user_preferences"\)/)
})

await check('schema: weekly reports model (one report per user/week, no relations)', () => {
  const m = model('WeeklyReport')
  assert.match(m, /@@unique\(\[userId, weekStartDate\]\)/)
  assert.match(m, /weekStartDate\s+DateTime\s+@db\.Date/)
  assert.match(m, /facts\s+Json\?/)
  assert.match(m, /content\s+Json\?/)
  assert.doesNotMatch(m, /@relation/)
  assert.match(m, /@@map\("weekly_reports"\)/)
})

await check('migration: tables, unique indexes, CHECK constraints', () => {
  assert.ok(folder, 'migration folder exists')
  assert.match(sql, /CREATE TABLE "user_preferences"/)
  assert.match(sql, /CREATE TABLE "weekly_reports"/)
  assert.match(sql, /CREATE UNIQUE INDEX "user_preferences_user_id_key"/)
  assert.match(sql, /CREATE UNIQUE INDEX "weekly_reports_user_id_week_start_date_key"/)
  assert.match(sql, /"productivity_agent_enabled" BOOLEAN NOT NULL DEFAULT false/)
  assert.match(sql, /"weekly_email_reports_enabled" BOOLEAN NOT NULL DEFAULT false/)
  assert.match(sql, /ISODOW FROM "week_start_date"\) = 1/)
  const completed = sql.match(/weekly_reports_completed_check"\s*CHECK \(([^;]*)\);/)?.[1] ?? ''
  for (const col of ['facts', 'content', 'generated_at']) assert.match(completed, new RegExp(`"${col}" IS NOT NULL`))
})

await check('migration: status CHECK matches the status constants', () => {
  const list = sql.match(/"status" IN \(([^)]*)\)/)?.[1] ?? ''
  const inSql = [...list.matchAll(/'([^']+)'/g)].map((m) => m[1])
  assert.deepEqual([...inSql].sort(), [...WEEKLY_REPORT_STATUSES].sort())
})

await check('migration: RLS enabled with own-row policies on both tables', () => {
  for (const table of ['user_preferences', 'weekly_reports']) {
    assert.match(sql, new RegExp(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`))
    for (const op of ['select', 'insert', 'update', 'delete']) {
      assert.match(sql, new RegExp(`CREATE POLICY "${table}_${op}_own"\\s+ON "${table}"`))
    }
  }
  assert.equal((sql.match(/CREATE POLICY/g) ?? []).length, 8)
  assert.equal((sql.match(/auth\.uid\(\) = "user_id"/g) ?? []).length, 10) // select/insert/delete: 1 each, update: 2, per table
})

// ---- Milestone 4: report history, single-report read, manual generation gating ----------------
const NOW = new Date('2026-10-14T12:00:00Z') // latest completed week: 2026-10-05..11
const asDate = (d) => new Date(`${d}T00:00:00.000Z`)
const PHOENIX = { productivityAgentEnabled: true, weeklyEmailReportsEnabled: false, timezone: 'America/Phoenix' }

function reportDb({ preferences = [], reports = [] } = {}) {
  const prefs = fakeDb(preferences)
  const rows = reports.map((r) => ({ ...r }))
  const calls = []
  const matches = (row, where) => Object.entries(where).every(([k, v]) => row[k] === v)
  const weeklyReport = {
    findMany: async ({ where, orderBy, take, select }) => {
      calls.push({ op: 'findMany', where, orderBy, take, select })
      return rows
        .filter((r) => matches(r, where))
        .sort((a, b) => b.weekStartDate - a.weekStartDate)
        .slice(0, take)
        .map((r) => Object.fromEntries(Object.keys(select).map((k) => [k, r[k]])))
    },
    findFirst: async ({ where, select }) => {
      calls.push({ op: 'findFirst', where, select })
      const row = rows.find((r) => matches(r, where))
      return row ? Object.fromEntries(Object.keys(select).map((k) => [k, row[k]])) : null
    },
    create: async ({ data }) => {
      calls.push({ op: 'create' })
      if (rows.some((r) => r.userId === data.userId && r.weekStartDate.getTime() === data.weekStartDate.getTime())) {
        throw Object.assign(new Error('unique'), { code: 'P2002' })
      }
      const row = { id: 900 + rows.length, facts: null, content: null, generatedAt: null, errorCode: null, ...data }
      rows.push(row)
      return { ...row }
    },
    findUnique: async ({ where }) => {
      calls.push({ op: 'findUnique' })
      const { userId, weekStartDate } = where.userId_weekStartDate
      const row = rows.find((r) => r.userId === userId && r.weekStartDate.getTime() === weekStartDate.getTime())
      return row ? { ...row } : null
    },
    updateMany: async ({ where, data }) => {
      calls.push({ op: 'updateMany', where })
      const row = rows.find((r) => matches(r, where))
      if (!row) return { count: 0 }
      for (const [k, v] of Object.entries(data)) row[k] = v && typeof v === 'object' && 'increment' in v ? row[k] + v.increment : v
      return { count: 1 }
    },
  }
  const empty = { findMany: async () => [] }
  return { db: { ...prefs.db, weeklyReport, dailySubCategorySummary: empty, weeklyTarget: empty }, rows, calls }
}

const report = (id, userId, week, extra = {}) => ({
  id, userId, weekStartDate: asDate(week), status: 'completed', errorCode: null, generatedAt: new Date('2026-10-12T10:00:00Z'),
  facts: { schemaVersion: 1, facts: {} }, content: { schemaVersion: 1, kind: 'ai_report', overview: 'x', meta: { provider: 'p', model: 'm', usage: null } }, ...extra,
})
const quiet = async (fn) => {
  const original = console.error
  console.error = () => {}
  try {
    return await fn()
  } finally {
    console.error = original
  }
}

await check('report history: own reports only, newest first, metadata only, bounded', async () => {
  const { db, calls } = reportDb({
    preferences: [{ userId: 'u1', ...PHOENIX }],
    reports: [report(1, 'u1', '2026-09-28'), report(2, 'u1', '2026-10-05'), report(3, 'u2', '2026-10-05')],
  })
  const { reports, targetWeekStartDate } = await listWeeklyReports('u1', { db, now: NOW })
  assert.deepEqual(reports.map((r) => [r.id, r.weekStartDate]), [[2, '2026-10-05'], [1, '2026-09-28']])
  assert.equal(targetWeekStartDate, '2026-10-05')
  assert.deepEqual(calls[0].where, { userId: 'u1' })
  assert.ok(calls[0].take <= 52)
  for (const r of reports) {
    assert.deepEqual(
      Object.keys(r).sort(),
      ['emailErrorCode', 'emailRecipient', 'emailSentAt', 'emailStatus', 'errorCode', 'generatedAt', 'id', 'status', 'weekStartDate']
    )
  }
})

await check('report history survives disabling; no timezone means no generation target', async () => {
  const { db } = reportDb({
    preferences: [{ userId: 'u1', productivityAgentEnabled: false, weeklyEmailReportsEnabled: false, timezone: null }],
    reports: [report(1, 'u1', '2026-10-05')],
  })
  const result = await listWeeklyReports('u1', { db, now: NOW })
  assert.equal(result.reports.length, 1)
  assert.equal(result.targetWeekStartDate, null)
})

await check('single report: scoped to the user, other ids look missing, metadata stripped', async () => {
  const { db, calls } = reportDb({ reports: [report(7, 'u1', '2026-10-05'), report(8, 'u2', '2026-10-05')] })
  const own = await getWeeklyReport('u1', 7, { db })
  assert.equal(own.weekStartDate, '2026-10-05')
  assert.equal('meta' in own.content, false)
  assert.equal('userId' in own, false)
  assert.deepEqual(calls[0].where, { id: 7, userId: 'u1' })
  for (const id of [8, 999, 0, -1, 1.5, NaN]) {
    await assert.rejects(() => getWeeklyReport('u1', id, { db }), (e) => e.code === 'NOT_FOUND' && e.status === 404)
  }
})

await check('manual generation is blocked while the Agent is disabled or has no timezone', async () => {
  const model = { invoke: async () => assert.fail('model must not be called') }
  for (const [pref, code] of [
    [{ userId: 'u1', productivityAgentEnabled: false, weeklyEmailReportsEnabled: false, timezone: 'America/Phoenix' }, 'AGENT_DISABLED'],
    [undefined, 'AGENT_DISABLED'],
    [{ userId: 'u1', productivityAgentEnabled: false, weeklyEmailReportsEnabled: true, timezone: 'America/Phoenix' }, 'AGENT_DISABLED'],
    [{ userId: 'u1', productivityAgentEnabled: true, weeklyEmailReportsEnabled: false, timezone: null }, 'VALIDATION_ERROR'],
  ]) {
    const { db, calls } = reportDb({ preferences: pref ? [pref] : [] })
    await assert.rejects(() => requestWeeklyReportGeneration('u1', { db, model, now: NOW }), (e) => e.code === code)
    assert.equal(calls.length, 0, 'no report row may be claimed')
  }
})

await check('manual generation: uses the stored timezone/week, never regenerates completed, retries failed', async () => {
  const model = { invoke: async () => assert.fail('no activity: model must not be called') }
  const base = { preferences: [{ userId: 'u1', ...PHOENIX }] }

  const created = reportDb(base)
  const ok = await requestWeeklyReportGeneration('u1', { db: created.db, model, now: NOW })
  assert.equal(ok.success, true)
  assert.equal(ok.weekStartDate, '2026-10-05')
  assert.equal(created.rows[0].status, 'completed')

  const done = reportDb({ ...base, reports: [report(1, 'u1', '2026-10-05')] })
  await assert.rejects(() => requestWeeklyReportGeneration('u1', { db: done.db, model, now: NOW }), (e) => e.code === 'REPORT_EXISTS' && e.status === 409)
  assert.equal(done.rows[0].content.overview, 'x') // untouched

  const failed = reportDb({ ...base, reports: [report(1, 'u1', '2026-10-05', { status: 'failed', errorCode: 'LLM_UNAVAILABLE', facts: null, content: null, generatedAt: null, attemptCount: 1 })] })
  const retried = await requestWeeklyReportGeneration('u1', { db: failed.db, model, now: NOW })
  assert.equal(retried.success, true)
  assert.equal(failed.rows[0].status, 'completed')
  assert.equal(failed.rows[0].attemptCount, 2)

  const inProgress = reportDb({ ...base, reports: [report(1, 'u1', '2026-10-05', { status: 'generating', facts: null, content: null, generatedAt: null })] })
  await quiet(() => assert.rejects(() => requestWeeklyReportGeneration('u1', { db: inProgress.db, model, now: NOW }), (e) => e.code === 'REPORT_IN_PROGRESS'))
})

await check('another user cannot be targeted: generation only ever claims the caller', async () => {
  const model = { invoke: async () => assert.fail('unused') }
  const { db, rows } = reportDb({ preferences: [{ userId: 'u1', ...PHOENIX }, { userId: 'u2', ...PHOENIX }], reports: [report(1, 'u2', '2026-10-05')] })
  const ok = await requestWeeklyReportGeneration('u1', { db, model, now: NOW })
  assert.equal(ok.success, true)
  assert.equal(rows.filter((r) => r.userId === 'u1').length, 1)
  assert.equal(rows.find((r) => r.userId === 'u2').content.overview, 'x')
})

await check('report view contract: fixtures carry every field the page reads', () => {
  for (const [name, reportData] of Object.entries(FIXTURES)) {
    const { totals, mainCategories } = reportData.facts
    for (const week of ['report', 'prior']) for (const k of ['minutes', 'activities', 'activeDays']) assert.equal(typeof totals[week][k], 'number', `${name} totals.${week}.${k}`)
    assert.equal(typeof totals.change.minutes, 'number', `${name} totals.change`)
    for (const m of mainCategories) {
      assert.equal(typeof m.name, 'string')
      assert.equal(typeof m.change.minutes, 'number')
      assert.ok(Array.isArray(m.subCategories))
      const t = m.target?.report
      if (t) for (const k of ['targetMinutes', 'actualMinutes', 'achievementPercent', 'status']) assert.ok(t[k] !== undefined, `${name} target.${k}`)
    }
    const insufficient = buildInsufficientDataContent(reportData.facts)
    assert.equal(insufficient.kind, 'insufficient_data')
    assert.equal(insufficient.schemaVersion, 1)
    assert.equal(typeof insufficient.overview, 'string')
  }
})

console.log(`\n${passed} checks passed`)
process.exit(0)
