// Development-only diagnostics for the opt-in live weekly report evaluation. Never imported by the
// application: production validation, logging and persistence are unchanged. It re-examines the
// raw model text the way the production validator would, to explain a rejection.
const { contentText } = await import('@/lib/ai/replyGuard.js')
const { collectAllowedNumbers, extractJsonObject, findUnsupportedNumbers, llmReportSchema, normalizeReportText } = await import(
  '@/lib/ai/report/reportSchema.js'
)

// Wraps a chat model so the eval can see the raw response (text, finish reason, usage).
export function recordingModel(model) {
  const recorder = { model: { invoke: async (messages) => (recorder.last = await model.invoke(messages)) }, last: null }
  return recorder
}

export function describeRaw(response) {
  if (!response) return null
  return {
    finishReason: response.response_metadata?.finish_reason ?? null,
    usage: response.usage_metadata ?? null,
    text: contentText(response.content),
  }
}

// Fact-bearing fields in the same scope as the production number guard (recommendation title and
// action are exempt), as [path, text] pairs.
function guardedFields(report) {
  const fields = [['overview', report.overview]]
  const each = (key, names) =>
    (report[key] ?? []).forEach((item, i) => names.forEach((n) => fields.push([`${key}[${i}].${n}`, item?.[n]])))
  each('mainCategoryInsights', ['headline', 'observed', 'targetCommentary', 'possibleExplanation'])
  each('subCategoryInsights', ['headline', 'observed', 'possibleExplanation'])
  each('observations', ['observed', 'possibleExplanation'])
  each('recommendations', ['rationale'])
  ;(report.dataNotes ?? []).forEach((note, i) => fields.push([`dataNotes[${i}]`, note]))
  return fields.filter(([, text]) => typeof text === 'string')
}

// Explains why raw model text would be rejected: JSON/schema problems and every number-guard hit
// with its field and the surrounding text. Returns a list of human-readable lines.
export function diagnoseRejection(rawText, facts) {
  const lines = []
  let json
  try {
    json = normalizeReportText(extractJsonObject(rawText)) // same normalization as production
  } catch {
    return ['no JSON object could be extracted from the response']
  }
  const parsed = llmReportSchema.safeParse(json)
  if (!parsed.success) {
    for (const issue of parsed.error.issues.slice(0, 5)) lines.push(`schema: ${issue.path.join('.') || '(root)'}: ${issue.message}`)
  }
  const allowed = collectAllowedNumbers(facts)
  for (const [path, text] of guardedFields(parsed.success ? parsed.data : json)) {
    for (const hit of findUnsupportedNumbers(text, allowed)) {
      const [value, unit] = hit.split(' ')
      lines.push(`number guard: "${value}" (${unit}) in ${path}: "${text}"`)
    }
  }
  if (lines.length === 0) lines.push('no schema or number-guard problem found by the diagnostics (check ids/duplicates/whitespace)')
  return lines
}
