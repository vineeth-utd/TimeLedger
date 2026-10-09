// Opt-in diagnostics for model token usage (AI_LOG_USAGE=true). Wraps the provider's fetch so it
// sees the raw request/response of every LLM invocation, including Groq's prompt-cache details and
// rate-limit headers, which LangChain does not surface. It logs numbers and tool names only: never
// message text, tool arguments/results, activity data or credentials. It must never affect a request.

export const isUsageLogEnabled = () => process.env.AI_LOG_USAGE === 'true'

const num = (value) => (value === null || value === undefined || value === '' ? undefined : Number(value))

function rateLimitHeaders(headers) {
  const read = (name) => headers.get(name) ?? undefined
  return {
    limitTokens: num(read('x-ratelimit-limit-tokens')),
    remainingTokens: num(read('x-ratelimit-remaining-tokens')),
    resetTokens: read('x-ratelimit-reset-tokens'),
    limitRequests: num(read('x-ratelimit-limit-requests')),
    remainingRequests: num(read('x-ratelimit-remaining-requests')),
    retryAfter: read('retry-after'),
  }
}

// Shape of the outgoing request (sizes only).
function describeRequest(init) {
  try {
    const body = JSON.parse(init?.body)
    return {
      messages: body.messages?.length,
      tools: body.tools?.length ?? 0,
      maxTokens: body.max_completion_tokens ?? body.max_tokens,
      reasoningEffort: body.reasoning_effort,
    }
  } catch {
    return {}
  }
}

const isCount = (value) => typeof value === 'number' && Number.isFinite(value)

// Cache hits can be reported in two places: usage.prompt_tokens_details.cached_tokens (OpenAI-style)
// and x_groq.usage.{dram,sram}_cached_tokens (Groq hardware cache). `cached` is null, not 0, when
// the response reports neither, so "not reported" is never confused with "no cache hit".
function describeCache(data, prompt) {
  const standard = data.usage?.prompt_tokens_details?.cached_tokens
  const hardware = data.x_groq?.usage
  const hardwareCached = [hardware?.dram_cached_tokens, hardware?.sram_cached_tokens].filter(isCount)
  let cached = null
  let source = 'not_reported'
  if (isCount(standard)) {
    cached = standard
    source = 'prompt_tokens_details'
  } else if (hardwareCached.length) {
    cached = hardwareCached.reduce((sum, value) => sum + value, 0)
    source = 'x_groq.usage'
  }
  return {
    cached,
    uncached: cached !== null && isCount(prompt) ? prompt - cached : null,
    cacheSource: source,
    // Field names only (no values, no content): shows the real response shape if caching is absent.
    shape: {
      usage: Object.keys(data.usage ?? {}),
      promptDetails: Object.keys(data.usage?.prompt_tokens_details ?? {}),
      xGroqUsage: Object.keys(hardware ?? {}),
    },
  }
}

function describeSuccess(data) {
  const usage = data.usage ?? {}
  const choice = data.choices?.[0]
  const toolNames = (choice?.message?.tool_calls ?? []).map((call) => call.function?.name)
  return {
    model: data.model,
    kind: toolNames.length ? 'tool_calls' : 'final',
    toolNames,
    finish: choice?.finish_reason,
    prompt: usage.prompt_tokens,
    ...describeCache(data, usage.prompt_tokens),
    completion: usage.completion_tokens,
    reasoning: usage.completion_tokens_details?.reasoning_tokens,
    total: usage.total_tokens,
  }
}

const clean = (record) => Object.fromEntries(Object.entries(record).filter(([, value]) => value !== undefined))

// Returns a fetch that logs one line per invocation. Create one per assistant request (the graph
// builds its model per request), so `inv` counts the model calls of that request.
export function createUsageLoggingFetch(baseFetch = globalThis.fetch) {
  let invocation = 0
  return async (input, init) => {
    const number = ++invocation
    const started = Date.now()
    const response = await baseFetch(input, init)
    try {
      const record = { inv: number, status: response.status, ms: Date.now() - started, ...describeRequest(init) }
      if (response.ok) {
        Object.assign(record, describeSuccess(await response.clone().json()))
      } else {
        // Groq's 429 text states Limit / Used / Requested; it contains no user content.
        const text = await response.clone().text()
        record.error = (JSON.parse(text).error?.message ?? '').slice(0, 300)
      }
      record.limits = clean(rateLimitHeaders(response.headers))
      console.log(`[ai-usage] ${JSON.stringify(clean(record))}`)
    } catch {
      // Diagnostics only.
    }
    return response
  }
}
