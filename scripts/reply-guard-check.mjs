// Deterministic, no-network, no-database checks for the malformed-reply guard.
//
//   node scripts/reply-guard-check.mjs
import assert from 'node:assert/strict'
import { register } from 'node:module'
import { AIMessage } from '@langchain/core/messages'
import { MemorySaver } from '@langchain/langgraph'
import { z } from 'zod'

register('./ai-eval-loader.mjs', import.meta.url)
process.env.DATABASE_URL ??= 'postgresql://unused:unused@localhost:5432/unused' // never connected

const { hasDegenerateWhitespaceRun, MAX_BLANK_RUN } = await import('@/lib/ai/replyGuard.js')
const { runAssistant } = await import('@/lib/ai/assistant.js')
const { createToolContext } = await import('@/lib/ai/context.js')
const { defineTool, InvalidAssistantReplyError } = await import('@/lib/ai/results.js')
const { turnResponse } = await import('@/lib/ai/http.js')
const { interpretResponse, planResult } = await import('@/lib/assistantClient.js')

let passed = 0
const check = async (name, fn) => {
  await fn()
  passed += 1
  console.log(`ok - ${name}`)
}

const ZWSP = '​'
const NBSP = ' '
const NNBSP = ' '
const run = (char, n) => char.repeat(n)

// ---- Detector ---------------------------------------------------------------

await check('threshold is 16', () => assert.equal(MAX_BLANK_RUN, 16))

await check('rejects the observed failure shape (~44 blank chars, filler, self-correction)', () => {
  const blank = `${run(' ', 30)}${run(ZWSP, 8)}${run(' ', 6)}`
  const text = `✓ Created ${blank}…? (… …\n\n\n\nThe last response is garbled. Need to correct.✓ Created Call with Home (7:48 AM‑8:10 AM, 22 min).`
  assert.equal(hasDegenerateWhitespaceRun(text), true)
})

await check('rejects 16+ of a single blank kind (space, ZWSP, NBSP, narrow NBSP, word joiner, soft hyphen, BOM)', () => {
  for (const char of [' ', ZWSP, NBSP, NNBSP, '⁠', '­', '﻿', '⠀', '　']) {
    assert.equal(hasDegenerateWhitespaceRun(`✓ Created x${run(char, 16)}y`), true, `U+${char.codePointAt(0).toString(16)}`)
  }
})

await check('rejects a mixed blank run, and a run at the end of a line', () => {
  assert.equal(hasDegenerateWhitespaceRun(`a${run(' ', 8)}${run(ZWSP, 8)}b`), true)
  assert.equal(hasDegenerateWhitespaceRun(`✓ Created${run(' ', 20)}\nnext`), true)
})

await check('accepts runs just under the threshold', () => {
  assert.equal(hasDegenerateWhitespaceRun(`a${run(' ', 15)}b`), false)
  assert.equal(hasDegenerateWhitespaceRun(`a${run(ZWSP, 15)}b`), false)
})

await check('accepts normal replies, U+2011 and mixed time formats', () => {
  assert.equal(hasDegenerateWhitespaceRun('✓ Created Linkedin Optimization (8:02 AM‑20:06 PM, 724 min).'), false)
  assert.equal(hasDegenerateWhitespaceRun('✓ Created Call with Home (7:48 AM‑8:10 AM, 22 min).'), false)
  assert.equal(hasDegenerateWhitespaceRun(''), false)
  assert.equal(hasDegenerateWhitespaceRun(undefined), false)
})

await check('accepts NBSP / narrow NBSP in times and short runs', () => {
  assert.equal(hasDegenerateWhitespaceRun(`7:48${NNBSP}AM – 8:10${NNBSP}AM`), false)
  assert.equal(hasDegenerateWhitespaceRun(`7:48${NBSP}AM${NBSP}${NBSP}to${NBSP}8:10${NBSP}AM`), false)
})

await check('accepts multilingual text: ZWJ/ZWNJ, combining marks, Thai breaks, CJK, Arabic, accents', () => {
  const samples = [
    'क्षत्रिय और ज्ञान — हिन्दी', // Devanagari conjuncts (virama + ZWJ/ZWNJ forms below)
    `क${'्‍'}ष कार${'‌'}्य`,
    'தமிழ் செயல்பாடு பதிவு',
    `สวัสดี${ZWSP}ครับ${ZWSP}วันนี้${ZWSP}อากาศดี`, // isolated ZWSP word breaks
    '今日はジムに行きました。読書も30分。',
    'تمت إضافة النشاط ✓',
    'Café résumé naïve — Zürich',
    'é ä ñ (combining marks)',
    `${run('́', 20)}`, // combining marks are not blank characters
    `${run('‍', 20)}${run('‌', 20)}`, // ZWJ/ZWNJ are excluded from the run
    `${run('️', 20)}`, // variation selectors are excluded
  ]
  for (const text of samples) assert.equal(hasDegenerateWhitespaceRun(text), false, text.slice(0, 20))
})

await check('accepts emoji sequences (ZWJ families, flags, keycaps, skin tones, variation selectors)', () => {
  const emoji = '👨‍👩‍👧‍👦 🏳️‍🌈 ❤️ 1️⃣ 👍🏽 🧑‍💻 ✓ ✔️'
  assert.equal(hasDegenerateWhitespaceRun(emoji.repeat(10)), false)
})

await check('accepts Markdown indentation, line breaks, lists and tabs', () => {
  assert.equal(hasDegenerateWhitespaceRun(`- item\n${run(' ', 20)}- nested\n${run(' ', 40)}deep`), false)
  assert.equal(hasDegenerateWhitespaceRun(`line one  \nline two`), false) // two-space line break
  assert.equal(hasDegenerateWhitespaceRun(`\t\t\tindented\n${run('\t', 30)}x`), false)
})

await check('accepts code spans and fenced blocks with long space runs', () => {
  assert.equal(hasDegenerateWhitespaceRun(`Use \`a${run(' ', 30)}b\` here`), false)
  assert.equal(hasDegenerateWhitespaceRun(`Example:\n\`\`\`\ncol1${run(' ', 40)}col2\n\`\`\`\ndone`), false)
})

await check('does not span lines: blanks split by newlines are not one run', () => {
  assert.equal(hasDegenerateWhitespaceRun(`a${run(' ', 10)}\n${run(' ', 10)}b`), false)
})

await check('non-string input is never flagged', () => {
  assert.equal(hasDegenerateWhitespaceRun(null), false)
  assert.equal(hasDegenerateWhitespaceRun(42), false)
})

// ---- Graph / recovery behavior (fake model, fake tool, in-memory checkpointer) -----------------

const GARBLED = `✓ Created${run(' ', 30)}${run(ZWSP, 14)}…\n\nThe last response is garbled. Need to correct.✓ Created Call with Home.`
const toolCall = new AIMessage({
  content: '',
  tool_calls: [{ id: 'call_1', name: 'createActivity', args: {}, type: 'tool_call' }],
})

const fakeCreateActivity = defineTool({
  name: 'createActivity',
  description: 'fake',
  schema: z.strictObject({}),
  handler: async () => ({ activity: { id: 'a1' } }),
})

function fakeModel(responses) {
  const queue = [...responses]
  return { bindTools: () => ({ invoke: async () => queue.shift() }) }
}

const ctx = createToolContext({ userId: 'user-1', timezone: 'America/Phoenix', now: new Date('2026-10-11T15:00:00Z') })
const storedMessages = async (checkpointer, threadId) =>
  (await checkpointer.getTuple({ configurable: { thread_id: `${ctx.userId}:${threadId}` } }))?.checkpoint.channel_values.messages ?? []

await check('after a successful create, a garbled final reply fails with outcome=applied and is not stored', async () => {
  const checkpointer = new MemorySaver()
  const result = await runAssistant({
    ctx,
    threadId: 't-applied',
    message: 'Add Call with Home from 7:48am to 8:10am',
    tools: [fakeCreateActivity],
    model: fakeModel([toolCall, new AIMessage({ content: GARBLED })]),
    checkpointer,
  })
  assert.equal(result.status, 'failed')
  assert.ok(result.cause instanceof InvalidAssistantReplyError)
  assert.equal(result.outcome, 'applied')
  assert.deepEqual(result.changes, [{ type: 'activity_created' }])

  const messages = await storedMessages(checkpointer, 't-applied')
  assert.ok(messages.every((message) => !String(message.content).includes('garbled')), 'garbled reply stored')
  assert.ok(messages.some((message) => message.getType() === 'tool'), 'tool result is kept')
  assert.equal(messages.at(-1).getType(), 'tool') // history ends at the tool result, no AI reply appended

  const response = turnResponse('t-applied', result, 'test')
  const body = await response.json()
  assert.equal(response.status, 500)
  assert.equal(body.code, 'ASSISTANT_INVALID_REPLY')
  assert.equal(body.data.outcome, 'applied')
  assert.deepEqual(body.data.changes, [{ type: 'activity_created' }])
  assert.ok(!JSON.stringify(body).includes('garbled'), 'garbled text must not reach the client')
})

await check('a garbled reply with no mutation fails with outcome=none', async () => {
  const checkpointer = new MemorySaver()
  const result = await runAssistant({
    ctx,
    threadId: 't-none',
    message: 'hello',
    tools: [fakeCreateActivity],
    model: fakeModel([new AIMessage({ content: GARBLED })]),
    checkpointer,
  })
  assert.equal(result.status, 'failed')
  assert.ok(result.cause instanceof InvalidAssistantReplyError)
  assert.equal(result.outcome, 'none')
  assert.deepEqual(result.changes, [])
  assert.ok((await storedMessages(checkpointer, 't-none')).every((message) => message.getType() !== 'ai'))
})

await check('text-block content is inspected too', async () => {
  const result = await runAssistant({
    ctx,
    threadId: 't-blocks',
    message: 'hello',
    tools: [fakeCreateActivity],
    model: fakeModel([new AIMessage({ content: [{ type: 'text', text: GARBLED }] })]),
    checkpointer: new MemorySaver(),
  })
  assert.ok(result.cause instanceof InvalidAssistantReplyError)
})

await check('a valid reply (U+2011, NBSP, multilingual) passes unchanged; the guard is not applied to tool-call turns', async () => {
  const reply = `✓ Created Call with Home (7:48${NNBSP}AM‑8:10${NNBSP}AM, 22 min). घर पर कॉल 👨‍👩‍👧`
  const checkpointer = new MemorySaver()
  const result = await runAssistant({
    ctx,
    threadId: 't-valid',
    message: 'Add Call with Home',
    tools: [fakeCreateActivity],
    // a tool-call message carrying blank-run content is not a final reply, so it is not inspected
    model: fakeModel([new AIMessage({ content: run(' ', 30), tool_calls: toolCall.tool_calls }), new AIMessage({ content: reply })]),
    checkpointer,
  })
  assert.equal(result.status, 'complete')
  assert.equal(result.reply, reply)
  assert.deepEqual(result.changes, [{ type: 'activity_created' }])
})

await check('client tells the user the data changed and the reply was rejected', () => {
  const body = {
    success: false,
    code: 'ASSISTANT_INVALID_REPLY',
    message: 'x',
    data: { threadId: 't', pendingAction: null, changes: [{ type: 'activity_created' }], outcome: 'applied' },
  }
  const plan = planResult(interpretResponse(500, body), 'chat')
  assert.equal(plan.refresh, true)
  assert.equal(plan.messages.length, 1)
  assert.equal(plan.messages[0].role, 'notice')
  assert.equal(
    plan.messages[0].text,
    "An activity was created, but the assistant's response couldn't be displayed correctly. Please try again if you need anything else."
  )
  assert.ok(!/malformed/i.test(plan.messages[0].text))
  const none = planResult(interpretResponse(500, { ...body, data: { ...body.data, changes: [], outcome: 'none' } }), 'chat')
  assert.ok(!/malformed/i.test(none.error))
  assert.match(none.error, /couldn't be displayed correctly.*No changes were made/)
})

console.log(`\n${passed} checks passed`)
