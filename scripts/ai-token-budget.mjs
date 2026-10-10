// Offline token-budget report for the assistant's model-visible context. No network, no database,
// no Groq calls: it measures the real system prompt, tool definitions and tool-result serializers,
// then totals the input of each LLM invocation in representative flows.
//
//   node scripts/ai-token-budget.mjs
//
// Uses js-tiktoken's o200k_base when available (gpt-oss tokenizer family; Groq's chat template adds
// a little overhead, so treat figures as ~5-10% low) and falls back to chars/4.
import { register } from 'node:module'

register('./ai-eval-loader.mjs', import.meta.url)

const { buildSystemPrompt } = await import('@/lib/ai/prompt.js')
const { getAssistantTools, getToolDefinitions } = await import('@/lib/ai/tools/index.js')
const { ok, serializeActivity, toModelActivity, toModelPrevious } = await import('@/lib/ai/results.js')

let countText
try {
  const { getEncoding } = await import('js-tiktoken')
  const encoding = getEncoding('o200k_base')
  countText = (text) => encoding.encode(text).length
  console.log('tokenizer: js-tiktoken o200k_base')
} catch {
  countText = (text) => Math.ceil(text.length / 4)
  console.log('tokenizer: chars/4 fallback (js-tiktoken not available)')
}
const count = (value) => countText(typeof value === 'string' ? value : JSON.stringify(value))

// ---- Fixed prefix (sent on every model call) --------------------------------------------------

const ctx = { userId: 1, timezone: 'America/Phoenix', now: new Date('2026-10-08T20:00:00Z') }
const systemPrompt = buildSystemPrompt(ctx)
const definitions = getToolDefinitions(getAssistantTools())
const prefix = { prompt: count(systemPrompt), tools: count(definitions) }
const fixed = prefix.prompt + prefix.tools
const { getReasoningEffort } = await import('@/lib/ai/llm.js')
// Groq's TPM pre-check ("Requested") = input tokens + the max output cap. BEFORE is the previous
// default (1024); AFTER is the configured cap (default 512).
const BEFORE_CAP = 1024
const maxOutput = Number(process.env.AI_MAX_OUTPUT_TOKENS) || 512

console.log(`\nFixed prefix per call: ${fixed}  (system prompt ${prefix.prompt} + ${definitions.length} tool definitions ${prefix.tools})`)
for (const definition of definitions) {
  const { name, description, parameters } = definition.function
  console.log(`  ${name.padEnd(20)} total ${String(count(definition)).padStart(4)}  (description ${count(description)}, schema ${count(parameters)})`)
}
const parts = definitions.reduce(
  (sum, { function: fn }) => ({ description: sum.description + count(fn.description), schema: sum.schema + count(fn.parameters) }),
  { description: 0, schema: 0 }
)
const instructions = count(systemPrompt.split('\n\nCurrent date and time')[0])
console.log(`Breakdown: instructions ${instructions} + date/calendar tail ${prefix.prompt - instructions} | tool descriptions ${parts.description} + tool schemas ${parts.schema} + wrapper ${prefix.tools - parts.description - parts.schema}`)
console.log(`Output cap per call (AI_MAX_OUTPUT_TOKENS): ${maxOutput} (before Batch 1: ${BEFORE_CAP}); reasoning effort: ${getReasoningEffort()} (not measurable offline)`)

// ---- Representative tool results (real serializers on synthetic rows) -------------------------

const at = (time) => new Date(`2026-10-09T${time}:00Z`) // 20:14 UTC = 13:14 Phoenix; shape only
const row = (id, start, end) => ({
  id,
  title: 'Assistant UI',
  activityDate: new Date('2026-10-08T00:00:00Z'),
  startTime: at(start),
  endTime: at(end),
  durationMinutes: 20,
  notes: null,
  subCategory: { id: 12, name: 'Projects', mainCategory: { id: 3, name: 'Work' } },
})
const fullActivities = (n) => Array.from({ length: n }, (_, i) => serializeActivity(row(400 + i, '03:14', '03:34'), ctx.timezone))
const activities = (n) => fullActivities(n).map(toModelActivity) // what the model sees
const taxonomy = (mains, subs) =>
  Array.from({ length: mains }, (_, m) => ({
    id: m + 1,
    name: `Main Category ${m + 1}`,
    subCategories: Array.from({ length: subs }, (_, s) => ({ id: m * 10 + s + 1, name: `Sub category ${s + 1}` })),
  }))

// Legacy (pre-compaction) shapes are kept here only to report the per-result saving.
const results = {
  recent5: ok({ activities: activities(5) }),
  recent1: ok({ activities: activities(1) }),
  search20: ok({ activities: activities(20), totalMatches: 20, totalMinutes: 400 }),
  update: ok({ activity: activities(1)[0], previous: toModelPrevious(fullActivities(1)[0], { ...fullActivities(1)[0], endTime: '04:05', durationMinutes: 51 }) }),
  categories: ok({ categories: taxonomy(10, 5) }),
  createdSub: ok({ subCategory: { id: 99, name: 'Sample', mainCategory: { id: 3, name: 'Work' } } }),
}
const legacy = {
  recent5: ok({ activities: fullActivities(5), returned: 5 }),
  recent1: ok({ activities: fullActivities(1), returned: 1 }),
  search20: ok({ activities: fullActivities(20), totalMatches: 20, totalMinutes: 400, returned: 20, truncated: false }),
  update: ok({ activity: fullActivities(1)[0], previous: fullActivities(1)[0] }),
  categories: results.categories,
  createdSub: results.createdSub,
}
console.log('\nTool results (tokens, legacy -> current model-facing shape):')
for (const [name, result] of Object.entries(results)) {
  const before = count(legacy[name])
  const after = count(result)
  console.log(`  ${name.padEnd(12)} ${String(before).padStart(5)} -> ${String(after).padStart(5)}  (${before ? Math.round((100 * (after - before)) / before) : 0}%)`)
}

// ---- Flows: input tokens of each LLM invocation -----------------------------------------------

const MESSAGE_OVERHEAD = 4
const user = (text) => ({ role: 'user', tokens: count(text) + MESSAGE_OVERHEAD })
const call = (name, args) => ({ role: 'assistant', tokens: count({ name, args }) + MESSAGE_OVERHEAD })
const tool = (result) => ({ role: 'tool', tokens: count(result) + MESSAGE_OVERHEAD })
const reply = (text) => ({ role: 'assistant', tokens: count(text) + MESSAGE_OVERHEAD })

// `steps` are the messages appended before each LLM invocation (the first includes the user turn).
function report(title, history, steps) {
  const lines = []
  const messages = [...history]
  let total = 0
  let requestedBefore = 0
  let requestedAfter = 0
  steps.forEach((added, index) => {
    messages.push(...added)
    const conversation = messages.reduce((sum, message) => sum + message.tokens, 0)
    const input = fixed + conversation
    total += input
    requestedBefore += input + BEFORE_CAP
    requestedAfter += input + maxOutput
    lines.push(`  call ${index + 1}: input ${input}  (fixed ${fixed} + conversation ${conversation})  requested ${input + BEFORE_CAP} -> ${input + maxOutput}`)
  })
  console.log(`\n${title}\n${lines.join('\n')}\n  turn total input ${total} over ${steps.length} calls; fixed prefix share ${Math.round((fixed * steps.length * 100) / total)}%\n  turn total REQUESTED ${requestedBefore} (cap ${BEFORE_CAP}) -> ${requestedAfter} (cap ${maxOutput}), saved ${requestedBefore - requestedAfter}`)
  return messages
}

const readTurn = [
  [user('What did I do today?')],
  [call('getActivities', { date: '2026-10-08' }), tool(results.search20)],
]
report('Flow 1: simple read (getActivities -> reply)', [], readTurn)

report('Flow 2: update recent activity (getRecentActivities -> updateActivity -> reply)', [], [
  [user('Update the recent activity to end at 9:45pm')],
  [call('getRecentActivities', { limit: 1 }), tool(results.recent1)],
  [call('updateActivity', { activityId: 400, endTime: '21:45' }), tool(results.update)],
])

report('Flow 3: category create with confirmation (getCategories -> createSubCategory [confirm] -> createActivity -> reply)', [], [
  [user('Log 30 minutes of Sample practice at 3pm today')],
  [call('getCategories', {}), tool(results.categories)],
  [call('createSubCategory', { name: 'Sample', mainCategoryId: 3 }), tool(results.createdSub)],
  [call('createActivity', { title: 'Sample practice', activityDate: '2026-10-08', startTime: '15:00', endTime: '15:30', subCategoryId: 99 }), tool(results.update)],
])

const earlier = report('Flow 4a: first turn of a conversation (getRecentActivities(5) -> reply)', [], [
  [user('Show my last 5 activities')],
  [call('getRecentActivities', { limit: 5 }), tool(results.recent5)],
])
report('Flow 4b: later turn in the same conversation (history includes all earlier messages)', [...earlier, reply('Here are your last 5 activities: ...')], [
  [user('Update the latest one to end at 9:45pm')],
  [call('updateActivity', { activityId: 400, endTime: '21:45' }), tool(results.update)],
])
