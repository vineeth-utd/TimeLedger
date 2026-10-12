// Deterministic, no-network, no-database checks for the configurable AI providers (Groq | OpenAI-compatible):
// provider selection/validation, chat-model construction, tool binding, OpenAI-style tool calls
// parsed into LangChain messages (including a tool-result round trip through the real graph) and
// speech-to-text request configuration. fetch is stubbed; fake keys only.
//
//   node scripts/provider-check.mjs
import assert from 'node:assert/strict'
import { register } from 'node:module'
import { MemorySaver } from '@langchain/langgraph'
import { HumanMessage } from '@langchain/core/messages'
import { z } from 'zod'

register('./ai-eval-loader.mjs', import.meta.url)
process.env.DATABASE_URL ??= 'postgresql://unused:unused@localhost:5432/unused' // never connected

const { createChatModel } = await import('@/lib/ai/llm.js')
const { getAssistantTools, getToolDefinitions } = await import('@/lib/ai/tools/index.js')
const { runAssistant } = await import('@/lib/ai/assistant.js')
const { createToolContext } = await import('@/lib/ai/context.js')
const { defineTool } = await import('@/lib/ai/results.js')
const { retryAfterSeconds } = await import('@/lib/ai/http.js')
const { transcribeAudio } = await import('@/lib/stt/provider.js')
const { SttError } = await import('@/lib/stt/errors.js')

const FAKE_GROQ_KEY = 'fake-groq-key-1234'
const FAKE_COMPAT_KEY = 'fake-compat-key-5678'
const FAKE_COMPAT_URL = 'https://compat.example.test/v1/'
const MANAGED = [
  'AI_PROVIDER', 'GROQ_AI_MODEL', 'OPENAI_COMPATIBLE_AI_MODEL', 'AI_MODEL', 'GROQ_STT_MODEL', 'OPENAI_COMPATIBLE_STT_MODEL', 'AI_REASONING_EFFORT', 'AI_MAX_OUTPUT_TOKENS', 'GROQ_AI_REASONING_EFFORT', 'GROQ_AI_MAX_OUTPUT_TOKENS', 'OPENAI_COMPATIBLE_AI_MAX_OUTPUT_TOKENS', 'AI_LOG_USAGE',
  'STT_PROVIDER', 'STT_MODEL', 'GROQ_API_KEY', 'OPENAI_COMPATIBLE_API_KEY', 'OPENAI_COMPATIBLE_API_BASE_URL',
]
const originalEnv = Object.fromEntries(MANAGED.map((name) => [name, process.env[name]]))
const originalFetch = globalThis.fetch
const originalError = console.error
const originalLog = console.log
const logged = []

function setEnv(values = {}) {
  for (const name of MANAGED) delete process.env[name]
  Object.assign(process.env, values)
}

let passed = 0
const check = async (name, fn) => {
  setEnv()
  globalThis.fetch = originalFetch
  await fn()
  passed += 1
  originalLog(`ok - ${name}`)
}
// Everything logged by the code under test is captured, so secrets can be asserted absent.
console.error = (...args) => logged.push(args.map(String).join(' '))
console.log = (...args) => logged.push(args.map(String).join(' '))

const COMPAT_ENV = { AI_PROVIDER: 'openai-compatible', OPENAI_COMPATIBLE_API_BASE_URL: FAKE_COMPAT_URL, OPENAI_COMPATIBLE_API_KEY: FAKE_COMPAT_KEY }
const jsonResponse = (body, status = 200, headers = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } })
const audio = { file: new Blob([new Uint8Array(200)], { type: 'audio/webm' }), extension: 'webm', mimeType: 'audio/webm' }
const sttOk = () => jsonResponse({ text: ' hello ' })
let completionCount = 0
// Unique ids matter: LangGraph's message reducer replaces messages that share an id.
const completion = (message, finish = 'stop') => ({
  id: `chatcmpl-${++completionCount}`,
  object: 'chat.completion',
  created: 1,
  model: 'gpt-oss-120b',
  choices: [{ index: 0, message, finish_reason: finish }],
  usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
})
const toolCallMessage = (name, args, id = 'call_abc') => ({
  role: 'assistant',
  content: null,
  tool_calls: [{ id, type: 'function', function: { name, arguments: JSON.stringify(args) } }],
})
// Records every request and replies from a queue of Response factories.
function stubFetch(responses) {
  const requests = []
  const queue = [...responses]
  globalThis.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input.url
    const headers = new Headers(init?.headers ?? input.headers)
    requests.push({ url, headers, body: typeof init?.body === 'string' ? JSON.parse(init.body) : init?.body })
    return queue.shift()()
  }
  return requests
}

// ---- Provider selection and validation ----------------------------------------------------------

await check('Groq is the default and keeps its existing configuration', () => {
  setEnv({ GROQ_API_KEY: FAKE_GROQ_KEY })
  const model = createChatModel()
  assert.equal(model.constructor.name, 'ChatGroq')
  assert.equal(model.model, 'openai/gpt-oss-120b')
  assert.equal(model.temperature, 0)
  assert.equal(model.maxTokens, 512)
  assert.equal(model.reasoningEffort, 'low')
})

await check('Groq honours GROQ_AI_MODEL / GROQ_AI_MAX_OUTPUT_TOKENS / GROQ_AI_REASONING_EFFORT', () => {
  setEnv({ AI_PROVIDER: 'GROQ', GROQ_API_KEY: FAKE_GROQ_KEY, GROQ_AI_MODEL: 'openai/gpt-oss-20b', GROQ_AI_MAX_OUTPUT_TOKENS: '256', GROQ_AI_REASONING_EFFORT: 'medium' })
  const model = createChatModel()
  assert.equal(model.model, 'openai/gpt-oss-20b')
  assert.equal(model.maxTokens, 256)
  assert.equal(model.reasoningEffort, 'medium')
})

await check('OpenAI-compatible provider constructs an OpenAI-compatible model from its own configuration', () => {
  setEnv(COMPAT_ENV)
  const model = createChatModel()
  assert.equal(model.constructor.name, 'ChatOpenAI')
  assert.equal(model.model, 'gpt-oss-120b')
  assert.equal(model.temperature, 0)
  assert.equal(model.maxRetries ?? 0, 0)
  setEnv({ ...COMPAT_ENV, OPENAI_COMPATIBLE_AI_MODEL: 'some-other-model' })
  assert.equal(createChatModel().model, 'some-other-model')
})

await check('model variables are per provider; the old shared AI_MODEL / STT_MODEL are ignored', async () => {
  const both = { GROQ_API_KEY: FAKE_GROQ_KEY, OPENAI_COMPATIBLE_API_BASE_URL: FAKE_COMPAT_URL, OPENAI_COMPATIBLE_API_KEY: FAKE_COMPAT_KEY }
  const models = { GROQ_AI_MODEL: 'groq-chat', OPENAI_COMPATIBLE_AI_MODEL: 'compat-chat' }
  setEnv({ ...both, ...models, AI_PROVIDER: 'groq' })
  assert.equal(createChatModel().model, 'groq-chat')
  setEnv({ ...both, ...models, AI_PROVIDER: 'openai-compatible' })
  assert.equal(createChatModel().model, 'compat-chat')
  setEnv({ ...both, AI_PROVIDER: 'openai-compatible', GROQ_AI_MODEL: 'groq-chat', AI_MODEL: 'legacy' })
  assert.equal(createChatModel().model, 'gpt-oss-120b')
  const stt = { GROQ_STT_MODEL: 'groq-whisper', OPENAI_COMPATIBLE_STT_MODEL: 'compat-whisper', STT_MODEL: 'legacy' }
  for (const [provider, expected] of [['groq', 'groq-whisper'], ['openai-compatible', 'compat-whisper']]) {
    setEnv({ ...both, ...stt, STT_PROVIDER: provider })
    const requests = stubFetch([sttOk])
    await transcribeAudio(audio)
    assert.equal(requests[0].body.get('model'), expected)
  }
})

await check('output-token caps are per provider, with safe fallback for invalid values', async () => {
  const both = { GROQ_API_KEY: FAKE_GROQ_KEY, OPENAI_COMPATIBLE_API_BASE_URL: FAKE_COMPAT_URL, OPENAI_COMPATIBLE_API_KEY: FAKE_COMPAT_KEY }
  const cap = (provider, values = {}) => {
    setEnv({ ...both, ...values, AI_PROVIDER: provider })
    return createChatModel().maxTokens
  }
  assert.equal(cap('groq'), 512)
  assert.equal(cap('openai-compatible'), 1024)
  const overrides = { GROQ_AI_MAX_OUTPUT_TOKENS: '256', OPENAI_COMPATIBLE_AI_MAX_OUTPUT_TOKENS: '2048' }
  assert.equal(cap('groq', overrides), 256)
  assert.equal(cap('openai-compatible', overrides), 2048)
  // The old shared name is ignored.
  assert.equal(cap('groq', { AI_MAX_OUTPUT_TOKENS: '99' }), 512)
  assert.equal(cap('openai-compatible', { AI_MAX_OUTPUT_TOKENS: '99' }), 1024)
  for (const bad of ['', '  ', 'abc', '0', '-5', '1.5', 'NaN', 'Infinity', '12px']) {
    assert.equal(cap('groq', { GROQ_AI_MAX_OUTPUT_TOKENS: bad }), 512, `groq "${bad}"`)
    assert.equal(cap('openai-compatible', { OPENAI_COMPATIBLE_AI_MAX_OUTPUT_TOKENS: bad }), 1024, `compat "${bad}"`)
  }
})

await check('the old shared AI_REASONING_EFFORT is ignored; Groq reads only GROQ_AI_REASONING_EFFORT', () => {
  setEnv({ GROQ_API_KEY: FAKE_GROQ_KEY, AI_REASONING_EFFORT: 'high' })
  assert.equal(createChatModel().reasoningEffort, 'low')
})

await check('invalid AI_PROVIDER / STT_PROVIDER fail clearly', async () => {
  setEnv({ AI_PROVIDER: 'openai', GROQ_API_KEY: FAKE_GROQ_KEY })
  assert.throws(() => createChatModel(), /AI_PROVIDER must be one of: groq, openai-compatible \(got "openai"\)/)
  setEnv({ STT_PROVIDER: 'whisper', GROQ_API_KEY: FAKE_GROQ_KEY })
  const request = { file: new Blob(['x']), extension: 'webm', mimeType: 'audio/webm' }
  await assert.rejects(() => transcribeAudio(request), (error) => error instanceof SttError && error.code === 'TRANSCRIPTION_UNAVAILABLE' && error.status === 500)
  assert.ok(logged.some((line) => line.includes('STT_PROVIDER must be one of: groq, openai-compatible')))
})

await check('missing credentials fail clearly without leaking values', () => {
  assert.throws(() => createChatModel(), /GROQ_API_KEY is not configured/)
  setEnv({ AI_PROVIDER: 'openai-compatible', OPENAI_COMPATIBLE_API_BASE_URL: FAKE_COMPAT_URL })
  assert.throws(() => createChatModel(), /OPENAI_COMPATIBLE_API_KEY is not configured/)
  setEnv({ AI_PROVIDER: 'openai-compatible', OPENAI_COMPATIBLE_API_KEY: FAKE_COMPAT_KEY })
  assert.throws(() => createChatModel(), /OPENAI_COMPATIBLE_API_BASE_URL is not configured/)
  // A Groq key alone must not satisfy the OpenAI-compatible provider, and vice versa.
  setEnv({ AI_PROVIDER: 'openai-compatible', GROQ_API_KEY: FAKE_GROQ_KEY })
  assert.throws(() => createChatModel(), /OPENAI_COMPATIBLE_API_BASE_URL is not configured/)
  setEnv({ OPENAI_COMPATIBLE_API_KEY: FAKE_COMPAT_KEY, OPENAI_COMPATIBLE_API_BASE_URL: FAKE_COMPAT_URL })
  assert.throws(() => createChatModel(), /GROQ_API_KEY is not configured/)
})

// ---- Tool binding and OpenAI-style tool calls ------------------------------------------------------

await check('the real TimeLedger tools bind on both providers', () => {
  const definitions = getToolDefinitions(getAssistantTools())
  assert.ok(definitions.length > 0)
  setEnv({ GROQ_API_KEY: FAKE_GROQ_KEY })
  assert.equal(typeof createChatModel().bindTools(definitions).invoke, 'function')
  setEnv(COMPAT_ENV)
  assert.equal(typeof createChatModel().bindTools(definitions).invoke, 'function')
})

await check('OpenAI-compatible request: endpoint, model, auth and tools are sent, with no Groq-specific fields', async () => {
  setEnv({ ...COMPAT_ENV, GROQ_AI_REASONING_EFFORT: 'high', AI_REASONING_EFFORT: 'high' }) // must NOT be forwarded to the OpenAI-compatible provider
  const definitions = getToolDefinitions(getAssistantTools())
  const requests = stubFetch([() => jsonResponse(completion({ role: 'assistant', content: 'hello' }))])
  await createChatModel().bindTools(definitions).invoke([new HumanMessage('hi')])
  const [request] = requests
  assert.equal(request.url, 'https://compat.example.test/v1/chat/completions')
  assert.equal(request.headers.get('authorization'), `Bearer ${FAKE_COMPAT_KEY}`)
  assert.equal(request.body.model, 'gpt-oss-120b')
  assert.deepEqual(request.body.tools.map((tool) => tool.function.name).sort(), definitions.map((tool) => tool.function.name).sort())
  for (const field of ['reasoning_effort', 'reasoning', 'x_groq']) assert.equal(field in request.body, false, field)
})

await check('OpenAI-style tool_calls parse into the AIMessage shape LangGraph expects', async () => {
  setEnv(COMPAT_ENV)
  stubFetch([() => jsonResponse(completion(toolCallMessage('getRecentActivities', { limit: 3 }), 'tool_calls'))])
  const message = await createChatModel().bindTools(getToolDefinitions(getAssistantTools())).invoke([new HumanMessage('recent?')])
  assert.equal(message.tool_calls.length, 1)
  assert.equal(message.tool_calls[0].id, 'call_abc')
  assert.equal(message.tool_calls[0].name, 'getRecentActivities')
  assert.deepEqual(message.tool_calls[0].args, { limit: 3 })
})

await check('OpenAI-compatible round trip through the real graph: tool call, tool result, final reply', async () => {
  setEnv(COMPAT_ENV)
  let executed = 0
  const echoTool = defineTool({
    name: 'createActivity',
    description: 'fake',
    schema: z.strictObject({ title: z.string() }),
    handler: async ({ title }) => {
      executed += 1
      return { activity: { id: 'a1', title } }
    },
  })
  const requests = stubFetch([
    () => jsonResponse(completion(toolCallMessage('createActivity', { title: 'Call' }), 'tool_calls')),
    () => jsonResponse(completion({ role: 'assistant', content: 'Created Call.' })),
  ])
  const ctx = createToolContext({ userId: 'user-1', timezone: 'America/Phoenix', now: new Date('2026-10-11T15:00:00Z') })
  const result = await runAssistant({ ctx, threadId: 't1', message: 'Add Call', tools: [echoTool], checkpointer: new MemorySaver() })
  assert.equal(result.status, 'complete')
  assert.equal(result.reply, 'Created Call.')
  assert.equal(executed, 1)
  assert.deepEqual(result.changes, [{ type: 'activity_created' }])
  // The second model request carries the assistant tool call and the matching tool result.
  assert.equal(requests.length, 2)
  const sent = requests[1].body.messages
  const assistant = sent.find((message) => message.role === 'assistant')
  const tool = sent.find((message) => message.role === 'tool')
  assert.equal(assistant.tool_calls[0].id, 'call_abc')
  assert.equal(tool.tool_call_id, 'call_abc')
})

await check('OpenAI-compatible 429 keeps status and Retry-After for the existing rate-limit handling, and is not retried', async () => {
  setEnv(COMPAT_ENV)
  const requests = stubFetch([() => jsonResponse({ error: { message: 'slow down' } }, 429, { 'retry-after': '7' }), () => jsonResponse(completion({ role: 'assistant', content: 'x' }))])
  let caught
  try {
    await createChatModel().bindTools(getToolDefinitions(getAssistantTools())).invoke([new HumanMessage('hi')])
  } catch (error) {
    caught = error
  }
  assert.equal(caught?.status, 429)
  assert.equal(retryAfterSeconds(caught), 7)
  assert.equal(requests.length, 1, 'no automatic retry')
})

// ---- Speech-to-text -------------------------------------------------------------------------------


await check('STT defaults to Groq with its existing URL, key and model', async () => {
  setEnv({ GROQ_API_KEY: FAKE_GROQ_KEY })
  const requests = stubFetch([sttOk])
  assert.deepEqual(await transcribeAudio(audio), { text: ' hello ' })
  assert.equal(requests[0].url, 'https://api.groq.com/openai/v1/audio/transcriptions')
  assert.equal(requests[0].headers.get('authorization'), `Bearer ${FAKE_GROQ_KEY}`)
  assert.equal(requests[0].body.get('model'), 'whisper-large-v3-turbo')
})

await check('STT with openai-compatible uses its own endpoint, key and whisper-large-v3 (OPENAI_COMPATIBLE_STT_MODEL overrides)', async () => {
  setEnv({ STT_PROVIDER: 'openai-compatible', OPENAI_COMPATIBLE_API_BASE_URL: FAKE_COMPAT_URL, OPENAI_COMPATIBLE_API_KEY: FAKE_COMPAT_KEY })
  let requests = stubFetch([sttOk])
  assert.deepEqual(await transcribeAudio(audio), { text: ' hello ' })
  assert.equal(requests[0].url, 'https://compat.example.test/v1/audio/transcriptions')
  assert.equal(requests[0].headers.get('authorization'), `Bearer ${FAKE_COMPAT_KEY}`)
  assert.equal(requests[0].body.get('model'), 'whisper-large-v3')
  assert.equal(requests[0].body.get('file').name, 'audio.webm')
  setEnv({ STT_PROVIDER: 'openai-compatible', OPENAI_COMPATIBLE_STT_MODEL: 'other-whisper', OPENAI_COMPATIBLE_API_BASE_URL: FAKE_COMPAT_URL, OPENAI_COMPATIBLE_API_KEY: FAKE_COMPAT_KEY })
  requests = stubFetch([sttOk])
  await transcribeAudio(audio)
  assert.equal(requests[0].body.get('model'), 'other-whisper')
})

await check('STT with openai-compatible: missing config and provider errors map to the existing safe errors', async () => {
  setEnv({ STT_PROVIDER: 'openai-compatible', OPENAI_COMPATIBLE_API_KEY: FAKE_COMPAT_KEY })
  await assert.rejects(() => transcribeAudio(audio), (error) => error.code === 'TRANSCRIPTION_UNAVAILABLE' && error.status === 500)
  assert.ok(logged.some((line) => line.includes('OPENAI_COMPATIBLE_API_BASE_URL is not configured')))
  setEnv({ STT_PROVIDER: 'openai-compatible', OPENAI_COMPATIBLE_API_BASE_URL: FAKE_COMPAT_URL, OPENAI_COMPATIBLE_API_KEY: FAKE_COMPAT_KEY })
  stubFetch([() => new Response('slow', { status: 429, headers: { 'retry-after': '3' } })])
  await assert.rejects(() => transcribeAudio(audio), (error) => error.code === 'RATE_LIMITED' && error.status === 429 && retryAfterSeconds(error) === 3)
  stubFetch([() => new Response('bad', { status: 400 })])
  await assert.rejects(() => transcribeAudio(audio), (error) => error.code === 'INVALID_AUDIO' && error.status === 422)
})

await check('LLM and STT providers are independent (mixed configurations)', async () => {
  setEnv({ AI_PROVIDER: 'openai-compatible', STT_PROVIDER: 'groq', OPENAI_COMPATIBLE_API_BASE_URL: FAKE_COMPAT_URL, OPENAI_COMPATIBLE_API_KEY: FAKE_COMPAT_KEY, GROQ_API_KEY: FAKE_GROQ_KEY })
  assert.equal(createChatModel().constructor.name, 'ChatOpenAI')
  let requests = stubFetch([sttOk])
  await transcribeAudio(audio)
  assert.match(requests[0].url, /api\.groq\.com/)
  setEnv({ AI_PROVIDER: 'groq', STT_PROVIDER: 'openai-compatible', OPENAI_COMPATIBLE_API_BASE_URL: FAKE_COMPAT_URL, OPENAI_COMPATIBLE_API_KEY: FAKE_COMPAT_KEY, GROQ_API_KEY: FAKE_GROQ_KEY })
  assert.equal(createChatModel().constructor.name, 'ChatGroq')
  requests = stubFetch([sttOk])
  await transcribeAudio(audio)
  assert.match(requests[0].url, /compat\.example\.test/)
})

await check('usage logging works through the OpenAI-compatible provider and never logs secrets or message content', async () => {
  setEnv({ ...COMPAT_ENV, AI_LOG_USAGE: 'true' })
  stubFetch([() => jsonResponse(completion(toolCallMessage('getRecentActivities', {}), 'tool_calls'))])
  await createChatModel().bindTools(getToolDefinitions(getAssistantTools())).invoke([new HumanMessage('TOP-SECRET-USER-TEXT')])
  const usage = logged.filter((line) => line.startsWith('[ai-usage]'))
  assert.equal(usage.length, 1)
  assert.match(usage[0], /"kind":"tool_calls"/)
  assert.ok(!usage[0].includes('TOP-SECRET-USER-TEXT'))
  // A non-JSON error body must still produce a log line.
  stubFetch([() => new Response('<html>bad gateway</html>', { status: 502 })])
  await createChatModel().bindTools([]).invoke([new HumanMessage('hi')]).catch(() => {})
  assert.ok(logged.some((line) => line.startsWith('[ai-usage]') && line.includes('"status":502')))
})

await check('no secret value appeared in anything the code under test logged', () => {
  for (const line of logged) {
    for (const secret of [FAKE_GROQ_KEY, FAKE_COMPAT_KEY]) assert.ok(!line.includes(secret), 'secret in log output')
  }
})

console.error = originalError
console.log = originalLog
globalThis.fetch = originalFetch
for (const [name, value] of Object.entries(originalEnv)) {
  if (value === undefined) delete process.env[name]
  else process.env[name] = value
}
console.log(`\n${passed} checks passed`)
