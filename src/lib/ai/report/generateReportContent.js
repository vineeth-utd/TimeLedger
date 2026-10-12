import { HumanMessage, SystemMessage } from '@langchain/core/messages'
import { createChatModel } from '@/lib/ai/llm'
import { humanizeDurations } from '@/lib/ai/durationText'
import { contentText } from '@/lib/ai/replyGuard'
import { getModelName, getReportMaxOutputTokens, getReportReasoningEffort, resolveProvider } from '@/lib/providers'
import { PROMPT_VERSION, SYSTEM_PROMPT, buildUserMessage } from '@/lib/ai/report/reportPrompt'
import {
  REPORT_ERROR,
  REPORT_SCHEMA_VERSION,
  ReportGenerationError,
  extractJsonObject,
  normalizeReportText,
  validateLlmReport,
} from '@/lib/ai/report/reportSchema'

// The configured model for weekly reports. Throws a plain configuration Error (invalid provider or
// reasoning-effort value) so a misconfiguration is not mistaken for a provider outage.
export function createReportModel() {
  const provider = resolveProvider('AI_PROVIDER')
  return createChatModel({
    maxOutputTokens: getReportMaxOutputTokens(provider),
    reasoningEffort: getReportReasoningEffort(provider),
  })
}

function describeModel() {
  try {
    const provider = resolveProvider('AI_PROVIDER')
    return { provider, model: getModelName(provider, 'ai') }
  } catch {
    return { provider: null, model: null }
  }
}

// Humanize durations ("154 min" -> "2 hrs 34 mins") in the fact-bearing strings, after validation.
// Recommendation title/action propose new quantities in free wording ("two 45 minute sessions"),
// which the narrow duration rewriter would mangle, so they are left as written.
function humanizeReport(report) {
  const humanized = humanizeStrings(report)
  return {
    ...humanized,
    recommendations: humanized.recommendations.map((rec, i) => ({
      ...rec,
      title: report.recommendations[i].title,
      action: report.recommendations[i].action,
    })),
  }
}

function humanizeStrings(value) {
  if (typeof value === 'string') return humanizeDurations(value)
  if (Array.isArray(value)) return value.map(humanizeStrings)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, inner]) => [key, humanizeStrings(inner)]))
  }
  return value
}

const emptyMeta = () => ({ promptVersion: PROMPT_VERSION, provider: null, model: null, usage: null })

// No activity in the report week: nothing to interpret, so no model call is made.
export function buildInsufficientDataContent(facts) {
  const { weekStartDate, weekEndDate } = facts.periods.report
  return {
    schemaVersion: REPORT_SCHEMA_VERSION,
    kind: 'insufficient_data',
    overview: `No activity was logged from ${weekStartDate} to ${weekEndDate}, so there is nothing to analyze for this week.`,
    mainCategoryInsights: [],
    subCategoryInsights: [],
    observations: [],
    recommendations: [],
    dataNotes: [],
    meta: emptyMeta(),
  }
}

// Calls the model once (no retries) and returns validated, persistable content.
// `reportData` is the Milestone 1 output ({ schemaVersion, facts }). `model` is any chat model with
// `invoke(messages)`; by default the configured provider. Throws ReportGenerationError with a safe
// code; never returns unvalidated model output.
export async function generateReportContent({ reportData, model }) {
  const { facts } = reportData
  if (facts.totals.report.minutes === 0) return buildInsufficientDataContent(facts)

  // Configuration errors (e.g. an invalid reasoning effort) surface as-is, outside the provider try.
  const reportModel = model ?? createReportModel()
  let response
  try {
    response = await reportModel.invoke([
      new SystemMessage(SYSTEM_PROMPT),
      new HumanMessage(buildUserMessage(facts)),
    ])
  } catch (error) {
    const code = error?.status === 429 ? REPORT_ERROR.LLM_RATE_LIMITED : REPORT_ERROR.LLM_UNAVAILABLE
    throw new ReportGenerationError(code, error?.name)
  }

  if (response?.response_metadata?.finish_reason === 'length') {
    throw new ReportGenerationError(REPORT_ERROR.TRUNCATED)
  }
  const report = validateLlmReport(normalizeReportText(extractJsonObject(contentText(response?.content))), facts)

  const usage = response?.usage_metadata
  return {
    schemaVersion: REPORT_SCHEMA_VERSION,
    kind: 'ai_report',
    ...humanizeReport(report),
    meta: {
      promptVersion: PROMPT_VERSION,
      ...describeModel(),
      usage: usage ? { inputTokens: usage.input_tokens ?? null, outputTokens: usage.output_tokens ?? null } : null,
    },
  }
}
