// Opt-in quality evaluation of AI weekly report generation against the LIVE configured LLM.
// NOT part of build/lint/CI: it makes real model calls (token cost) and is a DRY RUN: it never
// writes to the database. Wording quality needs human review; only the shape/number guard is
// checked automatically.
//
//   node --env-file=.env scripts/weekly-report-eval.mjs                     (all fixtures)
//   node --env-file=.env scripts/weekly-report-eval.mjs --only typical,sparse
//   node --env-file=.env scripts/weekly-report-eval.mjs --list              (no model call)
//
// Fixtures are synthetic (scripts/weekly-report-fixtures.mjs). Requires the configured provider's
// key (GROQ_API_KEY, or OPENAI_COMPATIBLE_API_BASE_URL + OPENAI_COMPATIBLE_API_KEY when
// AI_PROVIDER=openai-compatible). Set AI_LOG_USAGE=true for per-call token/rate-limit lines.
// Persisting reports is deliberately not offered here (see generateWeeklyReport).
//
//   --diagnostics   on a rejection, also print the raw model response (synthetic data only), its
//                   finish reason/usage, and every schema / number-guard problem with its field.
//                   Development only: nothing here is used by, or logged from, the application.
import { register } from 'node:module'

register('./ai-eval-loader.mjs', import.meta.url)
process.env.DATABASE_URL ??= 'postgresql://unused:unused@localhost:5432/unused' // never connected

const { FIXTURES } = await import('./weekly-report-fixtures.mjs')

const args = process.argv.slice(2)
const argValue = (flag) => (args.includes(flag) ? args[args.indexOf(flag) + 1] : undefined)
const only = argValue('--only')?.split(',')
const names = Object.keys(FIXTURES).filter((name) => !only || only.includes(name))

if (args.includes('--list') || names.length === 0) {
  console.log(`fixtures: ${Object.keys(FIXTURES).join(', ')}`)
  process.exit(names.length === 0 && !args.includes('--list') ? 2 : 0)
}

const provider = process.env.AI_PROVIDER?.trim().toLowerCase() || 'groq'
const missing = (provider === 'openai-compatible' ? ['OPENAI_COMPATIBLE_API_BASE_URL', 'OPENAI_COMPATIBLE_API_KEY'] : ['GROQ_API_KEY']).filter(
  (name) => !process.env[name]
)
if (missing.length) {
  console.error(`${missing.join(', ')} required (run with: node --env-file=.env scripts/weekly-report-eval.mjs)`)
  process.exit(2)
}

const { createReportModel, generateReportContent } = await import('@/lib/ai/report/generateReportContent.js')
const { formatReportFactsForLlm } = await import('@/lib/ai/report/reportPrompt.js')
const diagnostics = args.includes('--diagnostics')
const { recordingModel, describeRaw, diagnoseRejection } = diagnostics ? await import('./weekly-report-eval-diagnostics.mjs') : {}

let failures = 0
for (const name of names) {
  const reportData = FIXTURES[name]
  console.log(`\n===== ${name} =====`)
  if (process.argv.includes('--show-input')) console.log(formatReportFactsForLlm(reportData.facts) + '\n')
  const started = Date.now()
  // With --diagnostics the same production model is wrapped only to capture the raw response.
  const recorder = diagnostics ? recordingModel(createReportModel()) : null
  try {
    const content = await generateReportContent({ reportData, model: recorder?.model })
    console.log(`valid (${content.kind}) in ${Date.now() - started} ms; usage: ${JSON.stringify(content.meta.usage)}`)
    console.log(JSON.stringify(content, null, 2))
  } catch (error) {
    failures += 1
    console.log(`REJECTED: ${error.code ?? error.name} (${error.message})`)
    const raw = describeRaw(recorder?.last)
    if (raw) {
      console.log(`finish_reason=${raw.finishReason} usage=${JSON.stringify(raw.usage)}`)
      for (const line of diagnoseRejection(raw.text, reportData.facts)) console.log(`  - ${line}`)
      console.log(`--- raw model response (${raw.text.length} chars) ---\n${raw.text}\n--- end raw response ---`)
    }
  }
}
console.log(`\n${names.length - failures}/${names.length} fixtures produced a valid report`)
process.exit(0)
