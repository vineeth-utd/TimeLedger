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

const { getPreferences, updatePreferences } = await import('@/lib/services/productivityAgentService.js')
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

console.log(`\n${passed} checks passed`)
process.exit(0)
