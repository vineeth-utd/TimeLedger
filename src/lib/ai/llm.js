import { ChatGroq } from '@langchain/groq'
import { ChatOpenAI } from '@langchain/openai'
import { createUsageLoggingFetch, isUsageLogEnabled } from '@/lib/ai/usageLog'
import { getMaxOutputTokens, getModelName, getOpenAiCompatibleConfig, getGroqApiKey, resolveProvider } from '@/lib/providers'

const REASONING_EFFORTS = ['low', 'medium', 'high']
const DEFAULT_REASONING_EFFORT = 'low'

// Groq only: the OpenAI-compatible provider is never sent a reasoning effort.
export function getReasoningEffort() {
  const configured = process.env.GROQ_AI_REASONING_EFFORT?.trim().toLowerCase()
  return REASONING_EFFORTS.includes(configured) ? configured : DEFAULT_REASONING_EFFORT
}


function createGroqModel(maxOutputTokens) {
  return new ChatGroq({
    apiKey: getGroqApiKey(),
    model: getModelName('groq', 'ai'),
    temperature: 0,
    maxTokens: maxOutputTokens ?? getMaxOutputTokens('groq'),
    reasoningEffort: getReasoningEffort(),
    ...(isUsageLogEnabled() && { fetch: createUsageLoggingFetch() }),
  })
}

// An OpenAI-compatible Chat Completions API. Groq-specific options (reasoning effort) are not
// sent, and automatic retries are off, matching the "no automatic 429 retries" rule.
function createOpenAiCompatibleModel(maxOutputTokens, reasoningEffort) {
  const { baseURL, apiKey } = getOpenAiCompatibleConfig()
  return new ChatOpenAI({
    apiKey,
    model: getModelName('openai-compatible', 'ai'),
    temperature: 0,
    maxTokens: maxOutputTokens ?? getMaxOutputTokens('openai-compatible'),
    maxRetries: 0,
    // The `reasoning` constructor option is not sent on this Chat Completions path; modelKwargs is.
    ...(reasoningEffort && { modelKwargs: { reasoning_effort: reasoningEffort } }),
    configuration: {
      baseURL,
      ...(isUsageLogEnabled() && { fetch: createUsageLoggingFetch() }),
    },
  })
}

// The only provider-specific module for the LLM. The graph relies on the generic LangChain
// chat-model interface (`bindTools`, `invoke`), so swapping provider/model is local to this file.
// `maxOutputTokens` optionally overrides the provider's default output cap, and `reasoningEffort`
// sets the OpenAI-compatible reasoning effort (both used only by weekly reports; the assistant
// passes neither, and Groq keeps its own GROQ_AI_REASONING_EFFORT).
export function createChatModel({ maxOutputTokens, reasoningEffort } = {}) {
  return resolveProvider('AI_PROVIDER') === 'openai-compatible'
    ? createOpenAiCompatibleModel(maxOutputTokens, reasoningEffort)
    : createGroqModel(maxOutputTokens)
}
