import { z } from 'zod'
import { hasDegenerateWhitespaceRun } from '@/lib/ai/replyGuard'

// Safe, content-free failure codes. Only these are persisted (weekly_reports.error_code).
export const REPORT_ERROR = Object.freeze({
  LLM_RATE_LIMITED: 'LLM_RATE_LIMITED',
  LLM_UNAVAILABLE: 'LLM_UNAVAILABLE',
  TRUNCATED: 'REPORT_TRUNCATED',
  INVALID_JSON: 'REPORT_INVALID_JSON',
  INVALID_SCHEMA: 'REPORT_INVALID_SCHEMA',
  UNSUPPORTED_NUMBERS: 'REPORT_UNSUPPORTED_NUMBERS',
  INTERNAL: 'REPORT_INTERNAL',
})

export class ReportGenerationError extends Error {
  constructor(code, detail) {
    super(detail ?? code)
    this.name = 'ReportGenerationError'
    this.code = code
  }
}

export const REPORT_SCHEMA_VERSION = 1

const text = (max) => z.string().trim().min(1).max(max)
// Models sometimes send "" for "no value"; that is normalized to null before validation.
const emptyToNull = (value) => (typeof value === 'string' && value.trim() === '' ? null : value)
const optionalText = (max) => z.preprocess(emptyToNull, text(max).nullable().default(null))
const id = z.number().int().nullable().default(null)

const mainInsight = z.object({
  mainCategoryId: z.number().int(),
  headline: text(120),
  observed: text(400),
  targetCommentary: optionalText(300),
  possibleExplanation: optionalText(300),
})

const subInsight = z.object({
  subCategoryId: z.number().int(),
  headline: text(120),
  observed: text(400),
  possibleExplanation: optionalText(300),
})

const observation = z.object({
  observed: text(400),
  possibleExplanation: optionalText(300),
})

const recommendation = z.object({
  title: text(120),
  action: text(400),
  rationale: text(400),
  mainCategoryId: id,
  subCategoryId: id,
})

// What the LLM must produce. Unknown keys the model adds are stripped (zod default).
export const llmReportSchema = z.object({
  overview: text(600),
  mainCategoryInsights: z.array(mainInsight).max(6),
  subCategoryInsights: z.array(subInsight).max(6),
  observations: z.array(observation).min(1).max(4),
  recommendations: z.array(recommendation).max(3), // none is valid: never pad to fill the count
  dataNotes: z.array(text(240)).max(2).default([]),
})

// ---- Number guard ---------------------------------------------------------------------------
// Every unit-bearing number in a fact-bearing field must be a value TimeLedger supplied; the model
// must never calculate (sums, ratios, hours, averages). Recommendation title/action are exempt:
// they propose NEW quantities ("add 30 minutes"), which are not facts. All of it is one constant
// set of rules so it can be loosened after live evaluation.

const NUMBER = String.raw`\d[\d,]*(?:\.\d+)?`
const UNITS = [
  ['minutes', String.raw`(?:minutes?|mins?)`],
  ['hours', String.raw`(?:hours?|hrs?)`],
  ['percent', String.raw`(?:%|percent)`],
  ['activities', String.raw`(?:activities|activity|sessions?)`],
  ['days', String.raw`(?:active days?|days?)`],
]
const UNIT_PATTERNS = UNITS.map(([unit, pattern]) => [
  unit,
  // "<n>", or a range "<n>-<m>", directly followed by the unit.
  new RegExp(String.raw`(?<![\w.,])(${NUMBER})(?:\s*(?:-|–|to)\s*(${NUMBER}))?\s*-?\s*${pattern}(?![A-Za-z])`, 'gi'),
])

const abs = (n) => (Number.isFinite(n) ? Math.abs(n) : null)

// Allowed values per unit, derived only from the M1 facts (plus the 7 days of a week).
export function collectAllowedNumbers(facts) {
  const allowed = { minutes: new Set(), hours: new Set(), percent: new Set(), activities: new Set(), days: new Set([7]) }
  const add = (set, ...values) => values.forEach((v) => abs(v) !== null && set.add(abs(v)))
  const addWeek = (w) => {
    add(allowed.minutes, w?.minutes)
    add(allowed.activities, w?.activities)
  }
  const addChange = (c) => {
    add(allowed.minutes, c?.minutes)
    add(allowed.percent, c?.percent)
  }

  const { totals, mainCategories, highlights } = facts
  for (const week of ['report', 'prior']) {
    addWeek(totals[week])
    add(allowed.days, totals[week].activeDays)
  }
  addChange(totals.change)
  for (const main of mainCategories) {
    for (const week of ['report', 'prior']) {
      addWeek(main[week])
      add(allowed.percent, main[week].sharePercent)
      const target = main.target[week]
      if (target) {
        add(allowed.minutes, target.targetMinutes, target.actualMinutes, target.deviationMinutes)
        add(allowed.percent, target.achievementPercent)
      }
    }
    addChange(main.change)
    for (const sub of main.subCategories) {
      addWeek(sub.report)
      addWeek(sub.prior)
      addChange(sub.change)
    }
  }
  for (const group of [highlights.mainCategories, highlights.subCategories]) {
    for (const item of [...group.largestIncreases, ...group.largestDecreases]) {
      add(allowed.minutes, item.changeMinutes)
      add(allowed.percent, item.changePercent)
    }
  }
  return allowed
}

// Returns the list of unsupported "<number> <unit>" mentions in one string (empty when clean).
export function findUnsupportedNumbers(value, allowed) {
  const found = []
  for (const [unit, pattern] of UNIT_PATTERNS) {
    for (const match of value.matchAll(pattern)) {
      for (const raw of [match[1], match[2]].filter(Boolean)) {
        const n = Number(raw.replaceAll(',', ''))
        // Hours are never supplied: the model must write whole minutes.
        if (unit === 'hours' || !allowed[unit].has(n)) found.push(`${raw} ${unit}`)
      }
    }
  }
  return found
}

// Fact-bearing strings of a validated report (recommendation title/action are exempt, see above).
function factBearingStrings(report) {
  return [
    report.overview,
    ...report.mainCategoryInsights.flatMap((i) => [i.headline, i.observed, i.targetCommentary, i.possibleExplanation]),
    ...report.subCategoryInsights.flatMap((i) => [i.headline, i.observed, i.possibleExplanation]),
    ...report.observations.flatMap((o) => [o.observed, o.possibleExplanation]),
    ...report.recommendations.map((r) => r.rationale),
    ...report.dataNotes,
  ].filter((s) => typeof s === 'string')
}

function allStrings(report) {
  return [...factBearingStrings(report), ...report.recommendations.flatMap((r) => [r.title, r.action])]
}

// ---- Validation -----------------------------------------------------------------------------

function referenceSets(facts) {
  const mains = new Map()
  const subs = new Map()
  for (const main of facts.mainCategories) {
    mains.set(main.mainCategoryId, main)
    for (const sub of main.subCategories) subs.set(sub.subCategoryId, main.mainCategoryId)
  }
  return { mains, subs }
}

const hasDuplicates = (values) => new Set(values).size !== values.length

// Parses the model's JSON object against the schema and the supplied facts.
// Throws ReportGenerationError(INVALID_SCHEMA | UNSUPPORTED_NUMBERS).
export function validateLlmReport(candidate, facts) {
  const parsed = llmReportSchema.safeParse(candidate)
  if (!parsed.success) {
    throw new ReportGenerationError(REPORT_ERROR.INVALID_SCHEMA, parsed.error.issues[0]?.message)
  }
  const report = parsed.data
  const invalid = (detail) => new ReportGenerationError(REPORT_ERROR.INVALID_SCHEMA, detail)
  const { mains, subs } = referenceSets(facts)

  const mainIds = report.mainCategoryInsights.map((i) => i.mainCategoryId)
  const subIds = report.subCategoryInsights.map((i) => i.subCategoryId)
  if (hasDuplicates(mainIds) || hasDuplicates(subIds)) throw invalid('duplicate insight')
  if (mainIds.some((x) => !mains.has(x))) throw invalid('unknown main category reference')
  if (subIds.some((x) => !subs.has(x))) throw invalid('unknown sub category reference')
  for (const rec of report.recommendations) {
    if (rec.mainCategoryId !== null && !mains.has(rec.mainCategoryId)) throw invalid('unknown main category reference')
    if (rec.subCategoryId !== null) {
      if (!subs.has(rec.subCategoryId)) throw invalid('unknown sub category reference')
      if (rec.mainCategoryId !== null && subs.get(rec.subCategoryId) !== rec.mainCategoryId) {
        throw invalid('sub category does not belong to the referenced main category')
      }
    }
  }
  if (allStrings(report).some(hasDegenerateWhitespaceRun)) throw invalid('malformed text')

  const allowed = collectAllowedNumbers(facts)
  const unsupported = factBearingStrings(report).flatMap((s) => findUnsupportedNumbers(s, allowed))
  if (unsupported.length) {
    throw new ReportGenerationError(REPORT_ERROR.UNSUPPORTED_NUMBERS, `${unsupported.length} unsupported number(s)`)
  }
  return report
}

// ---- Unicode normalization (weekly-report pipeline only) -----------------------------------------
// Models emit typographic spaces and hyphens ("850<U+202F>min", "75<U+2011>minute"). They are mapped
// to ASCII before the number guard and duration humanization so both see what the reader sees.
// Deliberately NOT applied to en/em dashes or zero-width characters.
const UNICODE_SPACES = /[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/g
const UNICODE_HYPHENS = /[\u2010\u2011\u2012\u2212]/g

export function normalizeReportText(value) {
  if (typeof value === 'string') return value.replace(UNICODE_SPACES, ' ').replace(UNICODE_HYPHENS, '-')
  if (Array.isArray(value)) return value.map(normalizeReportText)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, inner]) => [key, normalizeReportText(inner)]))
  }
  return value
}

// Extracts the outermost JSON object from model text (tolerates code fences / surrounding prose).
export function extractJsonObject(raw) {
  if (typeof raw !== 'string') throw new ReportGenerationError(REPORT_ERROR.INVALID_JSON)
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start === -1 || end <= start) throw new ReportGenerationError(REPORT_ERROR.INVALID_JSON)
  try {
    return JSON.parse(raw.slice(start, end + 1))
  } catch {
    throw new ReportGenerationError(REPORT_ERROR.INVALID_JSON)
  }
}
