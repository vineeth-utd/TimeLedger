// Deterministic, no-network, no-database checks for assistant duration text: the formatter, the
// narrow reply rewriter, and that only the final reply (not state/tool results) is humanized.
//
//   node scripts/duration-text-check.mjs
import assert from 'node:assert/strict'
import { register } from 'node:module'
import { AIMessage } from '@langchain/core/messages'
import { MemorySaver } from '@langchain/langgraph'
import { z } from 'zod'

register('./ai-eval-loader.mjs', import.meta.url)
process.env.DATABASE_URL ??= 'postgresql://unused:unused@localhost:5432/unused' // never connected

const { formatDurationText, humanizeDurations } = await import('@/lib/ai/durationText.js')
const { buildSystemPrompt } = await import('@/lib/ai/prompt.js')
const { runAssistant } = await import('@/lib/ai/assistant.js')
const { createToolContext } = await import('@/lib/ai/context.js')
const { defineTool } = await import('@/lib/ai/results.js')

let passed = 0
const check = async (name, fn) => {
  await fn()
  passed += 1
  console.log(`ok - ${name}`)
}

await check('formatter: required examples', () => {
  const expected = { 45: '45 mins', 60: '1 hr', 75: '1 hr 15 mins', 120: '2 hrs', 154: '2 hrs 34 mins', 287: '4 hrs 47 mins' }
  for (const [minutes, text] of Object.entries(expected)) assert.equal(formatDurationText(Number(minutes)), text)
})

await check('formatter: singular/plural and boundaries, no decimals', () => {
  const expected = { 0: '0 mins', 1: '1 min', 2: '2 mins', 59: '59 mins', 61: '1 hr 1 min', 121: '2 hrs 1 min', 1440: '24 hrs', 1500: '25 hrs' }
  for (const [minutes, text] of Object.entries(expected)) assert.equal(formatDurationText(Number(minutes)), text)
  for (let minutes = 0; minutes <= 3000; minutes += 7) assert.ok(!formatDurationText(minutes).includes('.'))
})

await check('formatter: invalid input returns null', () => {
  for (const value of [-1, 1.5, NaN, Infinity, '60', null, undefined]) assert.equal(formatDurationText(value), null)
})

await check('rewriter: clear integer durations are converted', () => {
  const cases = {
    'You spent 287 minutes on Career Growth.': 'You spent 4 hrs 47 mins on Career Growth.',
    '✓ Created Call (7:48 AM-8:10 AM, 22 min).': '✓ Created Call (7:48 AM-8:10 AM, 22 mins).',
    'Total: 60 mins': 'Total: 1 hr',
    '1 minute': '1 min',
    '120 minutes.': '2 hrs.',
    'A: 75 min, B: 154 mins and C: 45 minutes': 'A: 1 hr 15 mins, B: 2 hrs 34 mins and C: 45 mins',
    '| Reels | 90 min |': '| Reels | 1 hr 30 mins |',
    'Updated: duration 30 min -> 90 min': 'Updated: duration 30 mins -> 1 hr 30 mins',
    'You logged 1,200 minutes.': 'You logged 20 hrs.',
    'About 287 minutes': 'About 4 hrs 47 mins',
    '287 MINUTES': '4 hrs 47 mins',
  }
  for (const [input, output] of Object.entries(cases)) assert.equal(humanizeDurations(input), output, input)
})

await check('rewriter: stays narrow (decimals, ranges, compounds, hours+minutes, code, other text)', () => {
  const untouched = [
    'About 1.5 minutes',
    'Between 30-45 minutes',
    'a 90-minute block',
    'Took 2 hrs 34 mins',
    'Took 1 hr 75 mins',
    'Took 3 hours 20 minutes',
    'Use `287 minutes` literally',
    '```\n287 minutes\n```',
    'Meeting at 7:48 AM, 3 activities, minutes matter',
    '287 minutesago',
    'No durations here.',
    '',
  ]
  for (const text of untouched) assert.equal(humanizeDurations(text), text, text)
})

await check('rewriter: idempotent and safe on non-strings', () => {
  const once = humanizeDurations('You spent 287 minutes and 22 min.')
  assert.equal(humanizeDurations(once), once)
  assert.equal(humanizeDurations(null), null)
  assert.equal(humanizeDurations(undefined), undefined)
  assert.deepEqual(humanizeDurations(['287 minutes']), ['287 minutes'])
})

await check('system prompt: model reports whole minutes; keeps the minutes rules', () => {
  const prompt = buildSystemPrompt({ timezone: 'America/Phoenix', now: new Date('2026-10-11T15:00:00Z') })
  assert.match(prompt, /durationMinutes and totalMinutes/)
  assert.match(prompt, /whole minutes/)
  assert.match(prompt, /Never write hours or decimals yourself/)
})

// ---- Only the final reply is humanized (fake model, fake tool, in-memory checkpointer) ---------

const getTotal = defineTool({
  name: 'getActivities',
  description: 'fake',
  schema: z.strictObject({}),
  handler: async () => ({ totalMinutes: 287, activities: [{ durationMinutes: 154 }] }),
})
const toolCall = new AIMessage({ content: '', tool_calls: [{ id: 'call_1', name: 'getActivities', args: {}, type: 'tool_call' }] })
const fakeModel = (responses) => {
  const queue = [...responses]
  return { bindTools: () => ({ invoke: async () => queue.shift() }) }
}
const ctx = createToolContext({ userId: 'user-1', timezone: 'America/Phoenix', now: new Date('2026-10-11T15:00:00Z') })

await check('runAssistant: reply is humanized; state and tool results keep raw minutes', async () => {
  const checkpointer = new MemorySaver()
  const result = await runAssistant({
    ctx,
    threadId: 't-duration',
    message: 'How much time did I spend?',
    tools: [getTotal],
    model: fakeModel([toolCall, new AIMessage({ content: 'You spent 287 minutes on Career Growth.' })]),
    checkpointer,
  })
  assert.equal(result.status, 'complete')
  assert.equal(result.reply, 'You spent 4 hrs 47 mins on Career Growth.')
  const tuple = await checkpointer.getTuple({ configurable: { thread_id: `${ctx.userId}:t-duration` } })
  const messages = tuple.checkpoint.channel_values.messages
  const tool = messages.find((message) => message.getType() === 'tool')
  assert.deepEqual(JSON.parse(tool.content).totalMinutes, 287)
  assert.deepEqual(JSON.parse(tool.content).activities[0].durationMinutes, 154)
  assert.equal(messages.at(-1).content, 'You spent 287 minutes on Career Growth.') // stored history unchanged
})

console.log(`\n${passed} checks passed`)
