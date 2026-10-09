// Opt-in behavioral evaluation of the AI assistant against the live LLM (Groq).
// NOT part of build/lint/CI: it makes real model calls and writes (then deletes) data in the
// configured database under disposable user ids.
//
//   node --env-file=.env scripts/ai-eval.mjs --only 4,6,9     (targeted: preferred)
//   node --env-file=.env scripts/ai-eval.mjs                  (all scenarios, one run each)
//   --runs N repeats every scenario N times (reliability comparison only; costly)
//
// Opt-in regression tool: run just the scenarios affected by a change. A full run is ~60k
// tokens against Groq's 200k/day on-demand cap. Stops cleanly if the daily cap is hit.
//
// Requires GROQ_API_KEY (+ DATABASE_URL). Assertions are on tool names/arguments, database
// state and coarse reply properties (asks vs. acts) — never on exact wording.
import { register } from 'node:module'
import { randomUUID } from 'node:crypto'

if (!process.env.GROQ_API_KEY) {
  console.error('GROQ_API_KEY is required (run with: node --env-file=.env scripts/ai-eval.mjs)')
  process.exit(2)
}

// The eval uses an in-process checkpointer so it never writes conversation state to the database.
process.env.AI_CHECKPOINTER ??= 'memory'

register('./ai-eval-loader.mjs', import.meta.url)

const { default: prisma } = await import('@/lib/prisma.js')
const { runAssistant, resumeAssistant } = await import('@/lib/ai/assistant.js')
const { createToolContext } = await import('@/lib/ai/context.js')
const { getAssistantTools } = await import('@/lib/ai/tools/index.js')
const { createMainCategory, createSubCategory } = await import('@/lib/services/categoryService.js')
const { createActivity } = await import('@/lib/services/activityService.js')
const { localDateTimeToUtc, utcToLocalDateTime, dateOnlyToString } = await import('@/lib/timezone.js')

// ---- Config ---------------------------------------------------------------

const args = process.argv.slice(2)
const argValue = (flag) => (args.includes(flag) ? args[args.indexOf(flag) + 1] : undefined)
const RUNS = Number(argValue('--runs')) || 1
const ONLY = argValue('--only')?.split(',').map(Number)
const TPM_BUDGET = Number(process.env.AI_EVAL_TPM_BUDGET) || 6500 // Groq on-demand cap is 8000 tokens/min

const TZ = 'America/Phoenix' // UTC-7, no DST
const NOW = new Date('2026-10-08T16:45:00Z') // Thu 2026-10-08 09:45 Phoenix
const TOOLS = getAssistantTools()

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

// ---- Seed -----------------------------------------------------------------
// Thu 2026-10-08 is "today"; Wed 10-07 "yesterday"; this week = Mon 10-05..Sun 10-11;
// last week = Mon 09-28..Sun 10-04.

const SEED_ACTIVITIES = [
  ['LeetCode - hashing', '2026-09-30', '20:00', '21:30', 'LeetCode'],
  ['LeetCode - trees', '2026-10-01', '10:00', '11:00', 'LeetCode'],
  ['Evening gym', '2026-10-05', '18:00', '19:00', 'Gym'],
  ['LeetCode - dp', '2026-10-06', '14:00', '15:30', 'LeetCode'],
  ['Mock interview', '2026-10-06', '16:00', '17:00', 'Interview Prep'],
  ['Morning gym', '2026-10-07', '07:00', '08:00', 'Gym'],
  ['LeetCode - arrays', '2026-10-07', '13:00', '14:00', 'LeetCode'],
  ['LeetCode - graphs', '2026-10-07', '17:30', '18:45', 'LeetCode'],
  ['Cooking breakfast', '2026-10-08', '08:00', '09:00', 'Cooking'],
]

async function seedUser(userId) {
  const subs = {}
  const taxonomy = {
    Career: ['LeetCode', 'Interview Prep', 'System Design', 'Behavioral Interview Prep'],
    Health: ['Gym'],
    Personal: ['Cooking', 'Reading'],
  }
  for (const [mainName, subNames] of Object.entries(taxonomy)) {
    const main = await createMainCategory(userId, { name: mainName })
    for (const name of subNames) {
      subs[name] = (await createSubCategory(userId, { mainCategoryId: main.id, name })).id
    }
  }
  const ids = {}
  for (const [title, date, start, end, sub] of SEED_ACTIVITIES) {
    const activity = await createActivity(userId, {
      title,
      activityDate: date,
      startTime: localDateTimeToUtc(date, start, TZ).toISOString(),
      endTime: localDateTimeToUtc(date, end, TZ).toISOString(),
      subCategoryId: subs[sub],
    })
    ids[title] = activity.id
  }
  return { subs, ids }
}

async function wipeUser(userId) {
  await prisma.activity.deleteMany({ where: { userId } })
  await prisma.dailySubCategorySummary.deleteMany({ where: { userId } })
  await prisma.subCategory.deleteMany({ where: { userId } })
  await prisma.mainCategory.deleteMany({ where: { userId } })
}

// Restores seeded activities to their original state between scenarios.
async function resetActivities(userId, seed) {
  await prisma.activity.deleteMany({ where: { userId } })
  await prisma.dailySubCategorySummary.deleteMany({ where: { userId } })
  seed.ids = {}
  for (const [title, date, start, end, sub] of SEED_ACTIVITIES) {
    const activity = await createActivity(userId, {
      title,
      activityDate: date,
      startTime: localDateTimeToUtc(date, start, TZ).toISOString(),
      endTime: localDateTimeToUtc(date, end, TZ).toISOString(),
      subCategoryId: seed.subs[sub],
    })
    seed.ids[title] = activity.id
  }
}

// ---- Assertion helpers ----------------------------------------------------

const names = (turns) => turns.flatMap((turn) => turn.calls.map((call) => call.name))
const callsNamed = (turns, name) => turns.flatMap((turn) => turn.calls).filter((call) => call.name === name)
const lastReply = (turns) => turns[turns.length - 1].reply
const asks = (reply) => reply.includes('?')

function localView(row, timezone = TZ) {
  const start = utcToLocalDateTime(row.startTime, timezone)
  const end = utcToLocalDateTime(row.endTime, timezone)
  return { date: dateOnlyToString(row.activityDate), start: start.time, end: end.time, endDate: end.date }
}

const isNextDayMidnight = (view) => view.end === '00:00'

async function newRows(userId, seed) {
  const seeded = new Set(Object.values(seed.ids))
  const rows = await prisma.activity.findMany({
    where: { userId, id: { notIn: [...seeded] } },
    include: { subCategory: true },
    orderBy: { startTime: 'asc' },
  })
  return rows
}

async function row(id) {
  return prisma.activity.findUnique({ where: { id }, include: { subCategory: true } })
}

async function unchanged(userId, seed) {
  const rows = await prisma.activity.findMany({ where: { userId } })
  return rows.length === SEED_ACTIVITIES.length && (await newRows(userId, seed)).length === 0
}

function check(failures, condition, message) {
  if (!condition) failures.push(message)
}

// ---- Scenarios ------------------------------------------------------------
// check(ctx) -> array of failure messages. ctx = { turns, userId, seed }.

const SCENARIOS = [
  {
    id: 1,
    name: 'create: explicit date/time/category',
    turns: ['Log "Reading" today from 8 PM to 9 PM under Reading.'],
    async check({ turns, userId, seed }) {
      const f = []
      const rows = await newRows(userId, seed)
      check(f, rows.length === 1, `expected 1 new activity, got ${rows.length}`)
      const [a] = rows
      if (a) {
        const v = localView(a)
        check(f, v.date === '2026-10-08' && v.start === '20:00' && v.end === '21:00', `wrong date/time ${JSON.stringify(v)}`)
        check(f, a.subCategoryId === seed.subs.Reading, 'wrong sub category')
        check(f, a.durationMinutes === 60, `duration ${a.durationMinutes}`)
      }
      return f
    },
  },
  {
    id: 2,
    name: 'create: genuinely missing times -> asks, no write',
    turns: ['Log some time at the gym today.'],
    async check({ turns, userId, seed }) {
      const f = []
      check(f, callsNamed(turns, 'createActivity').length === 0, 'created without times')
      check(f, asks(lastReply(turns)), 'did not ask for the missing times')
      check(f, await unchanged(userId, seed), 'data changed')
      return f
    },
  },
  {
    id: 3,
    name: 'read: yesterday',
    turns: ['What did I do yesterday?'],
    async check({ turns }) {
      const f = []
      const calls = callsNamed(turns, 'getActivities')
      check(f, calls.some((c) => c.args?.date === '2026-10-07' || (c.args?.startDate === '2026-10-07' && c.args?.endDate === '2026-10-07')), 'no getActivities for 2026-10-07')
      check(f, calls.every((c) => !c.args?.query), 'unnecessary query filter')
      const r = lastReply(turns)
      check(f, /morning gym/i.test(r) && /arrays/i.test(r) && /graphs/i.test(r), 'reply missing yesterday activities')
      return f
    },
  },
  {
    id: 4,
    name: 'read: text + this-week range',
    turns: ['Show my gym activities this week.'],
    async check({ turns, seed }) {
      const f = []
      const calls = callsNamed(turns, 'getActivities')
      check(f, calls.some((c) => (/gym/i.test(c.args?.query ?? '') || c.args?.subCategoryId === seed.subs.Gym) && c.args?.startDate === '2026-10-05' && ['2026-10-08', '2026-10-11'].includes(c.args?.endDate)), 'no gym query over Mon 10-05..')
      const r = lastReply(turns)
      check(f, /evening gym/i.test(r) && /morning gym/i.test(r), 'reply missing gym activities')
      return f
    },
  },
  {
    id: 5,
    name: 'read: exact date + time window',
    turns: ['What did I do on Tuesday between 2 PM and 5 PM?'],
    async check({ turns }) {
      const f = []
      const calls = callsNamed(turns, 'getActivities')
      check(f, calls.some((c) => (c.args?.date === '2026-10-06' || c.args?.startDate === '2026-10-06') && c.args?.timeFrom === '14:00' && c.args?.timeTo === '17:00'), 'no time-window search for 10-06 14:00-17:00')
      check(f, /dp/i.test(lastReply(turns)) && /mock interview/i.test(lastReply(turns)), 'reply missing activities')
      return f
    },
  },
  {
    id: 6,
    name: 'read: total time uses authoritative minutes',
    turns: ['How much time did I spend on LeetCode last week?'],
    async check({ turns, seed }) {
      const f = []
      const calls = callsNamed(turns, 'getActivities')
      check(f, calls.some((c) => (/leetcode/i.test(c.args?.query ?? '') || c.args?.subCategoryId === seed.subs.LeetCode) && c.args?.startDate === '2026-09-28' && c.args?.endDate === '2026-10-04'), 'no LeetCode search over 09-28..10-04')
      check(f, /\b150\b|2\s*(h|hr|hrs|hours?)\b[^0-9]{0,15}30|2\.5/i.test(lastReply(turns)), `wrong/missing total (expect 150 min): ${lastReply(turns).slice(0, 160)}`)
      return f
    },
  },
  {
    id: 7,
    name: 'read: latest then previous activity',
    turns: ['What was my last activity?', 'And the one before that?'],
    async check({ turns }) {
      const f = []
      check(f, /cooking/i.test(turns[0].reply), 'latest should be Cooking breakfast')
      check(f, /graphs/i.test(turns[1].reply), 'previous should be LeetCode - graphs')
      return f
    },
  },
  {
    id: 8,
    name: "update: narrow search then partial update",
    turns: ["Change yesterday's gym to end at 8:30 AM."],
    async check({ turns, seed }) {
      const f = []
      const order = names(turns)
      check(f, order.indexOf('getActivities') !== -1 && order.indexOf('getActivities') < order.indexOf('updateActivity'), 'did not search before update')
      const updates = callsNamed(turns, 'updateActivity')
      check(f, updates.length === 1 && updates[0].args?.activityId === seed.ids['Morning gym'], 'wrong/missing update target')
      const extra = Object.keys(updates[0]?.args ?? {}).filter((k) => !['activityId', 'endTime'].includes(k))
      check(f, extra.length === 0, `sent unchanged fields: ${extra.join(',')}`)
      const r = await row(seed.ids['Morning gym'])
      check(f, r.durationMinutes === 90, `duration ${r.durationMinutes}`)
      return f
    },
  },
  {
    id: 9,
    name: 'update: ambiguous (2 matches) -> asks, no write',
    turns: ["Change yesterday's LeetCode activity to end at 6 PM."],
    async check({ turns, userId, seed }) {
      const f = []
      check(f, callsNamed(turns, 'updateActivity').length === 0, 'updated despite ambiguity')
      check(f, asks(lastReply(turns)), 'did not ask which one')
      check(f, /arrays/i.test(lastReply(turns)) && /graphs/i.test(lastReply(turns)), 'did not list both candidates')
      check(f, await unchanged(userId, seed), 'data changed')
      return f
    },
  },
  {
    id: 10,
    name: 'update: no match -> reports none, bounded search, no write',
    turns: ["Change yesterday's meditation session to end at 6 PM."],
    async check({ turns, userId, seed }) {
      const f = []
      check(f, callsNamed(turns, 'updateActivity').length === 0, 'updated something')
      const searches = callsNamed(turns, 'getActivities')
      check(f, searches.length >= 1, 'did not search')
      check(f, searches.every((c) => c.args?.date || c.args?.startDate), 'unbounded (no date) search')
      check(f, searches.length <= 3, `too many searches (${searches.length})`)
      check(f, await unchanged(userId, seed), 'data changed')
      return f
    },
  },
  {
    id: 11,
    name: 'update: extend latest (no taxonomy fetch)',
    turns: ['Extend my latest activity until 9:30 AM.'],
    async check({ turns, seed }) {
      const f = []
      check(f, !names(turns).includes('getCategories'), 'fetched taxonomy unnecessarily')
      const updates = callsNamed(turns, 'updateActivity')
      check(f, updates.length === 1 && updates[0].args?.activityId === seed.ids['Cooking breakfast'], 'wrong/missing update target')
      const r = await row(seed.ids['Cooking breakfast'])
      check(f, r.durationMinutes === 90, `duration ${r.durationMinutes}`)
      return f
    },
  },
  {
    id: 12,
    name: 'delete intent (ambiguous target) -> asks, nothing pending/deleted',
    turns: ['Delete my LeetCode activity from yesterday.'],
    async check({ turns, userId, seed }) {
      const f = []
      check(f, callsNamed(turns, 'getActivities').length >= 1, 'did not resolve the target')
      check(f, turns[0].status === 'complete' && asks(lastReply(turns)), 'did not ask which one')
      check(f, await unchanged(userId, seed), 'data changed')
      return f
    },
  },
  {
    id: 13,
    name: 'delete intent (unique target) -> confirmation for the exact activity, nothing deleted yet',
    turns: ['Delete my latest activity.'],
    async check({ turns, userId, seed }) {
      const f = []
      const action = turns[0].pendingAction?.actions?.[0]
      check(f, turns[0].status === 'needs_confirmation' && action?.kind === 'DELETE_ACTIVITY', `no delete confirmation (status ${turns[0].status})`)
      check(f, /cooking/i.test(action?.display?.summary ?? ''), 'confirmation is not for Cooking breakfast')
      check(f, await unchanged(userId, seed), 'data changed before approval')
      return f
    },
  },
  {
    id: 14,
    name: 'create: cross-midnight split',
    turns: ['Log "Late coding" from 10 PM last night to 1 AM today under LeetCode.'],
    async check({ turns, userId, seed }) {
      const f = []
      const rows = await newRows(userId, seed)
      check(f, rows.length === 2, `expected 2 activities, got ${rows.length}`)
      if (rows.length === 2) {
        const [a, b] = rows.map((r) => localView(r))
        check(f, a.date === '2026-10-07' && a.start === '22:00' && isNextDayMidnight(a), `first half wrong ${JSON.stringify(a)}`)
        check(f, b.date === '2026-10-08' && b.start === '00:00' && b.end === '01:00', `second half wrong ${JSON.stringify(b)}`)
        check(f, rows[0].durationMinutes + rows[1].durationMinutes === 180, 'total not 180')
      }
      check(f, !lastReply(turns).includes('24:00'), 'showed 24:00 to the user')
      return f
    },
  },
  {
    id: 15,
    name: 'create: until midnight is a single activity',
    turns: ['Log "Wind down" tonight from 11 PM until midnight under Reading.'],
    async check({ turns, userId, seed }) {
      const f = []
      const rows = await newRows(userId, seed)
      check(f, rows.length === 1, `expected 1 activity, got ${rows.length}`)
      if (rows[0]) {
        const v = localView(rows[0])
        check(f, v.date === '2026-10-08' && v.start === '23:00' && isNextDayMidnight(v) && rows[0].durationMinutes === 60, `wrong ${JSON.stringify(v)}`)
      }
      check(f, !lastReply(turns).includes('24:00'), 'showed 24:00 to the user')
      return f
    },
  },
  {
    id: 16,
    name: 'multi-step: end latest now, start a new activity',
    turns: ['I just finished cooking. End my latest activity now and start Reading at 9:45 AM for an hour.'],
    async check({ turns, userId, seed }) {
      const f = []
      const order = names(turns)
      check(f, order.indexOf('updateActivity') !== -1 && order.indexOf('createActivity') > order.indexOf('updateActivity'), `unexpected call order: ${order.join(',')}`)
      const cooking = await row(seed.ids['Cooking breakfast'])
      check(f, localView(cooking).end === '09:45', `cooking end ${localView(cooking).end}`)
      const rows = await newRows(userId, seed)
      check(f, rows.length === 1 && localView(rows[0]).start === '09:45' && rows[0].durationMinutes === 60, 'new Reading activity wrong')
      return f
    },
  },
  {
    id: 17,
    name: 'multi-step: two activities in one request',
    turns: ['Log two things today: "Stretching" 6 to 6:30 AM under Gym, and "Journaling" 6:30 to 7 AM under Reading.'],
    async check({ userId, seed }) {
      const f = []
      const rows = await newRows(userId, seed)
      check(f, rows.length === 2, `expected 2 activities, got ${rows.length}`)
      if (rows.length === 2) {
        const [a, b] = rows
        check(f, /stretching/i.test(a.title) && localView(a).start === '06:00' && localView(a).end === '06:30' && a.subCategoryId === seed.subs.Gym, 'Stretching wrong')
        check(f, /journaling/i.test(b.title) && localView(b).start === '06:30' && localView(b).end === '07:00' && b.subCategoryId === seed.subs.Reading, 'Journaling wrong')
      }
      return f
    },
  },
  {
    id: 18,
    name: 'timezone: browser timezone honored (Asia/Kolkata)',
    timezone: 'Asia/Kolkata',
    turns: ['Log "Deep reading" today from 9 AM to 10 AM under Reading.'],
    async check({ userId, seed }) {
      const f = []
      const rows = await newRows(userId, seed)
      check(f, rows.length === 1, `expected 1 activity, got ${rows.length}`)
      if (rows[0]) {
        check(f, rows[0].startTime.toISOString() === '2026-10-08T03:30:00.000Z', `start ${rows[0].startTime.toISOString()}`)
        check(f, dateOnlyToString(rows[0].activityDate) === '2026-10-08', 'wrong activity date')
      }
      return f
    },
  },
  {
    id: 19,
    name: 'follow-up on the same thread (no re-search)',
    turns: ['Log "Review" today from 8 PM to 9 PM under Reading.', 'Actually make that end at 9:30 PM.'],
    async check({ turns, userId, seed }) {
      const f = []
      const rows = await newRows(userId, seed)
      check(f, rows.length === 1 && rows[0].durationMinutes === 90, 'activity not updated to 90 min / duplicated')
      const updates = callsNamed(turns, 'updateActivity')
      check(f, updates.length === 1 && rows[0] && updates[0].args?.activityId === rows[0].id, 'update not targeting the created activity')
      return f
    },
  },
  {
    id: 20,
    name: 'bare hour inferred from context (no needless question)',
    turns: ['Change my latest activity to end at 10.'],
    async check({ turns, seed }) {
      const f = []
      const updates = callsNamed(turns, 'updateActivity')
      check(f, updates.length === 1 && updates[0].args?.activityId === seed.ids['Cooking breakfast'], 'did not update the latest activity')
      check(f, updates[0]?.args?.endTime === '10:00', `endTime ${updates[0]?.args?.endTime} (expected 10:00)`)
      return f
    },
  },
  // ---- Milestone 4: category resolution ----
  {
    id: 21,
    name: 'category: clear match used silently',
    turns: ['Add LeetCode today from 9 to 10 AM.'],
    async check({ turns, userId, seed }) {
      const f = []
      const rows = await newRows(userId, seed)
      check(f, rows.length === 1 && rows[0].subCategoryId === seed.subs.LeetCode, 'not logged under LeetCode')
      check(f, callsNamed(turns, 'getCategories').length === 1, 'expected exactly one getCategories')
      return f
    },
  },
  {
    id: 22,
    name: 'category: ambiguous -> asks with options, no write',
    turns: ['Add interview preparation today from 9 to 10 AM.'],
    async check({ turns, userId, seed }) {
      const f = []
      check(f, callsNamed(turns, 'createActivity').length === 0, 'created without asking')
      check(f, asks(lastReply(turns)), 'did not ask')
      const options = [/interview prep/i, /behavioral/i, /system design/i].filter((re) => re.test(lastReply(turns)))
      check(f, options.length >= 2, 'did not list the plausible options')
      check(f, await unchanged(userId, seed), 'data changed')
      return f
    },
  },
  {
    id: 23,
    name: 'category: no match -> sub category confirmation, nothing created yet',
    turns: ['Add Kubernetes study today from 8 to 9 PM.'],
    async check({ turns, userId, seed }) {
      const f = []
      const action = turns[0].pendingAction?.actions?.[0]
      check(f, turns[0].status === 'needs_confirmation' && action?.kind === 'CREATE_SUB_CATEGORY', `no sub-category confirmation (status ${turns[0].status})`)
      check(f, /kubernetes/i.test(action?.display?.summary ?? ''), 'confirmation does not name Kubernetes')
      check(f, callsNamed(turns, 'createActivity').length === 0, 'created an activity before the category existed')
      check(f, (await prisma.subCategory.count({ where: { userId } })) === Object.keys(seed.subs).length, 'taxonomy changed before approval')
      check(f, await unchanged(userId, seed), 'data changed')
      return f
    },
  },
  {
    id: 24,
    name: 'category: follow-up choice reuses thread (no re-fetch)',
    turns: ['Add interview preparation today from 9 to 10 AM.', 'Use System Design instead.'],
    async check({ turns, userId, seed }) {
      const f = []
      const rows = await newRows(userId, seed)
      check(f, rows.length === 1 && rows[0].subCategoryId === seed.subs['System Design'], 'not logged under System Design')
      if (rows[0]) check(f, localView(rows[0]).start === '09:00' && localView(rows[0]).end === '10:00', 'times lost across turns')
      check(f, !turns[1].calls.some((c) => c.name === 'getCategories'), 'refetched taxonomy on follow-up')
      return f
    },
  },
  {
    id: 25,
    name: 'category: explicit category honored',
    turns: ['Log stretching today from 6 to 6:30 AM under Gym.'],
    async check({ turns, userId, seed }) {
      const f = []
      const rows = await newRows(userId, seed)
      check(f, rows.length === 1 && rows[0].subCategoryId === seed.subs.Gym, 'not logged under Gym')
      return f
    },
  },
  // ---- Milestone 5: confirmation workflow ----
  {
    id: 26,
    name: 'confirm: approve delete executes exactly the proposed activity',
    turns: ['Delete my latest activity.', { decision: 'approve' }],
    async check({ turns, userId, seed }) {
      const f = []
      check(f, turns[0].status === 'needs_confirmation', 'no confirmation raised')
      check(f, !(await row(seed.ids['Cooking breakfast'])), 'Cooking breakfast not deleted after approval')
      check(f, (await prisma.activity.count({ where: { userId } })) === SEED_ACTIVITIES.length - 1, 'wrong number of activities deleted')
      check(f, turns[1].status === 'complete', 'did not complete after approval')
      return f
    },
  },
  {
    id: 27,
    name: 'confirm: approved sub category, then the original activity is created',
    turns: ['Add Kubernetes study today from 8 to 9 PM.', { decision: 'approve' }],
    async check({ turns, userId, seed }) {
      const f = []
      const sub = await prisma.subCategory.findFirst({ where: { userId, name: { equals: 'Kubernetes', mode: 'insensitive' } } })
      check(f, Boolean(sub), 'Kubernetes sub category not created')
      const rows = await newRows(userId, seed)
      check(f, rows.length === 1 && sub && rows[0].subCategoryId === sub.id, 'activity not created under the new sub category')
      if (rows[0]) check(f, localView(rows[0]).start === '20:00' && localView(rows[0]).end === '21:00', 'wrong times')
      return f
    },
  },
  {
    id: 28,
    name: 'confirm: reject -> nothing deleted, not retried',
    turns: ['Delete my latest activity.', { decision: 'reject' }],
    async check({ turns, userId, seed }) {
      const f = []
      check(f, turns[1].status === 'complete' && !turns[1].pendingAction, 'proposed the action again after rejection')
      check(f, await unchanged(userId, seed), 'data changed')
      return f
    },
  },
  // ---- Milestone 6 manual-testing regression ----
  {
    id: 29,
    name: 'extend current task to 8:59 PM (own end time is not a conflict; no 9:59 PM)',
    // Found manually: with an existing 8:14-8:34 PM activity, the model claimed that extending it
    // would overlap its own end time and suggested 9:59 PM.
    async setup({ userId, seed }) {
      const activity = await createActivity(userId, {
        title: 'Assistant UI',
        activityDate: '2026-10-08',
        startTime: localDateTimeToUtc('2026-10-08', '20:14', TZ).toISOString(),
        endTime: localDateTimeToUtc('2026-10-08', '20:34', TZ).toISOString(),
        subCategoryId: seed.subs.Reading,
      })
      seed.ids['Assistant UI'] = activity.id
    },
    now: new Date('2026-10-09T03:40:00Z'), // Thu 2026-10-08 8:40 PM Phoenix
    turns: ['Extend the current task to 8:59 PM'],
    async check({ turns, seed }) {
      const f = []
      const updated = await row(seed.ids['Assistant UI'])
      const v = updated && localView(updated)
      check(f, v && v.start === '20:14' && v.end === '20:59', `wrong times ${JSON.stringify(v)}`)
      check(f, callsNamed(turns, 'updateActivity').length === 1, 'expected exactly one updateActivity call')
      const reply = lastReply(turns)
      check(f, !/overlap|9:59|21:59/i.test(reply), 'claimed an overlap or mentioned 9:59 PM')
      check(f, /8:59\s*PM/i.test(reply), 'reply does not state the new end time')
      return f
    },
  },
  {
    id: 30,
    name: 'replies never show database ids',
    turns: ['What did I do yesterday and which categories were they in?'],
    async check({ turns }) {
      const f = []
      check(f, !/\bid\b\W{0,3}\d+|#\d{2,}|\(\s*\d{2,}\s*\)/i.test(lastReply(turns)), 'reply shows an internal id')
      return f
    },
  },
  // ---- Category deletion (confirmed, dependency-checked) ----
  {
    id: 31,
    name: 'delete an empty sub category: confirmation, then deleted on approve',
    turns: ['Delete the System Design sub category.', { decision: 'approve' }],
    async check({ turns, userId, seed }) {
      const f = []
      check(f, turns[0].status === 'needs_confirmation', 'no confirmation raised')
      check(f, !(await prisma.subCategory.findUnique({ where: { id: seed.subs['System Design'] } })), 'sub category still exists after approval')
      check(f, !/\bid\b\W{0,3}\d+/i.test(lastReply(turns)), 'reply shows an id')
      return f
    },
  },
  {
    id: 32,
    name: 'delete a sub category that has activities: refused with the reason, no confirmation',
    turns: ['Delete the Gym sub category.'],
    async check({ turns, seed }) {
      const f = []
      check(f, turns[0].status === 'complete' && !turns[0].pendingAction, 'raised a confirmation for a blocked deletion')
      check(f, Boolean(await prisma.subCategory.findUnique({ where: { id: seed.subs.Gym } })), 'Gym was deleted')
      check(f, /activit/i.test(lastReply(turns)), 'reply does not explain the activity blocker')
      return f
    },
  },
]

// ---- Runner ---------------------------------------------------------------

// Pacing uses real token usage: a turn waits only until the last 60s of usage plus an estimate
// of this turn's cost (the largest turn seen so far) fits under the per-minute budget.
const usageLog = [] // { at, tokens }
let estimatedTurnTokens = 3000
let totalTokens = 0

class DailyLimitError extends Error {}

async function waitForRateHeadroom() {
  for (;;) {
    const now = Date.now()
    while (usageLog.length && now - usageLog[0].at >= 60000) usageLog.shift()
    const used = usageLog.reduce((sum, entry) => sum + entry.tokens, 0)
    if (used + estimatedTurnTokens <= TPM_BUDGET) return
    await sleep(Math.max(usageLog[0].at + 60000 - now, 500) + 250)
  }
}

// "Please try again in 1m42.8s" / "45.79s" -> milliseconds
function retryDelayMs(message) {
  const match = /try again in (?:(\d+)m)?(?:(\d+(?:\.\d+)?)s)?/i.exec(message)
  if (!match) return 15000
  return ((Number(match[1]) || 0) * 60 + (Number(match[2]) || 0)) * 1000 + 1000
}

async function runTurn(ctx, threadId, message, previous) {
  for (let attempt = 0; ; attempt++) {
    await waitForRateHeadroom()
    try {
      const startedAt = Date.now()
      const result =
        typeof message === 'string'
          ? await runAssistant({ ctx, threadId, message, tools: TOOLS })
          : await resumeAssistant({
              ctx,
              threadId,
              actionId: previous?.pendingAction?.actionId,
              decision: message.decision,
              tools: TOOLS,
            })
      const tokens = result.tokensUsed || estimatedTurnTokens // fall back if usage is not reported
      usageLog.push({ at: Date.now(), tokens })
      totalTokens += tokens
      estimatedTurnTokens = Math.max(estimatedTurnTokens, tokens)
      return {
        message: typeof message === 'string' ? message : `[${message.decision}]`,
        status: result.status,
        pendingAction: result.pendingAction ?? null,
        reply: result.reply ?? '',
        ms: Date.now() - startedAt,
        tokens,
        calls: (result.toolCalls ?? []).map((call) => ({ ...call, parsed: safeParse(call.result) })),
      }
    } catch (error) {
      if (error.status !== 429) throw error
      if (/per day|\(TPD\)/i.test(error.message)) {
        throw new DailyLimitError(`Groq daily token limit reached: ${error.message.slice(0, 200)}`)
      }
      if (attempt >= 3) throw error
      const delay = Math.min(retryDelayMs(error.message), 70000)
      console.log(`    (429, backing off ${Math.round(delay / 1000)}s)`)
      usageLog.push({ at: Date.now(), tokens: TPM_BUDGET }) // window is full: wait for it to drain
      await sleep(delay)
      usageLog.length = 0
    }
  }
}

function safeParse(text) {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

async function runScenario(scenario, run, userId, seed) {
  await resetActivities(userId, seed)
  if (scenario.setup) await scenario.setup({ userId, seed })
  const ctx = createToolContext({ userId, timezone: scenario.timezone ?? TZ, now: scenario.now ?? NOW })
  const threadId = `eval-${scenario.id}-${run}-${randomUUID().slice(0, 8)}`
  const turns = []
  const failures = []
  try {
    for (const message of scenario.turns) {
      const turn = await runTurn(ctx, threadId, message, turns[turns.length - 1])
      turns.push(turn)
      console.log(`    > ${turn.message}  (${turn.status})`)
      console.log(`      tools: ${turn.calls.map((c) => `${c.name}${c.success === false ? '✗' : ''}${JSON.stringify(c.args)}`).join(' ; ') || '(none)'}  [${turn.ms}ms, ${turn.tokens} tok]`)
      console.log(`      reply: ${turn.reply.replace(/\s+/g, ' ').slice(0, 220)}`)
    }
    failures.push(...(await scenario.check({ turns, userId, seed })))
    if (turns.some((t) => t.reply.includes('24:00'))) failures.push('showed 24:00 to the user')
  } catch (error) {
    if (error instanceof DailyLimitError) throw error
    failures.push(`error: ${error.message}`)
  }
  return { failures, turns }
}

async function cleanupAndExit(code) {
  try {
    await wipeUser(userId)
  } finally {
    process.exit(code)
  }
}
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => cleanupAndExit(130))

const selected = SCENARIOS.filter((s) => !ONLY || ONLY.includes(s.id))
const userId = randomUUID()
const results = new Map(selected.map((s) => [s.id, []]))
let fatal = false
let abortReason = null

try {
  const seed = await seedUser(userId)
  for (let run = 1; run <= RUNS; run++) {
    for (const scenario of selected) {
      console.log(`\n[run ${run}] #${scenario.id} ${scenario.name}`)
      let failures
      try {
        ;({ failures } = await runScenario(scenario, run, userId, seed))
      } catch (error) {
        if (!(error instanceof DailyLimitError)) throw error
        abortReason = error.message
        throw error
      }
      results.get(scenario.id).push(failures)
      console.log(failures.length ? `    FAIL: ${failures.join(' | ')}` : '    PASS')
    }
  }
} catch (error) {
  fatal = true
  console.error(abortReason ? `Evaluation aborted: ${abortReason}` : error)
} finally {
  await wipeUser(userId)
  const leftover =
    (await prisma.activity.count({ where: { userId } })) + (await prisma.mainCategory.count({ where: { userId } }))
  console.log(`\nCleanup: ${leftover === 0 ? 'ok (no leftover rows)' : `LEFTOVER ROWS: ${leftover}`}`)
  await prisma.$disconnect()
}

console.log(`\n==== Summary (passes / runs; ${totalTokens} tokens used) ====`)
let weak = 0
for (const scenario of selected) {
  const runs = results.get(scenario.id)
  if (runs.length === 0) {
    console.log(`skip #${String(scenario.id).padStart(2)} not run  ${scenario.name}`)
    continue
  }
  const passes = runs.filter((f) => f.length === 0).length
  if (passes < runs.length) weak++
  console.log(`${passes === runs.length ? 'ok  ' : 'WEAK'} #${String(scenario.id).padStart(2)} ${passes}/${runs.length}  ${scenario.name}`)
  for (const failures of runs.filter((f) => f.length)) console.log(`        - ${failures.join(' | ')}`)
}
process.exit(fatal || weak ? 1 : 0)
