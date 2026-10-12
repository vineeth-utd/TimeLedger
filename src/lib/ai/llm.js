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


function createGroqModel() {
  return new ChatGroq({
    apiKey: getGroqApiKey(),
    model: getModelName('groq', 'ai'),
    temperature: 0,
    maxTokens: getMaxOutputTokens('groq'),
    reasoningEffort: getReasoningEffort(),
    ...(isUsageLogEnabled() && { fetch: createUsageLoggingFetch() }),
  })
}

// An OpenAI-compatible Chat Completions API. Groq-specific options (reasoning effort) are not
// sent, and automatic retries are off, matching the "no automatic 429 retries" rule.
function createOpenAiCompatibleModel() {
  const { baseURL, apiKey } = getOpenAiCompatibleConfig()
  return new ChatOpenAI({
    apiKey,
    model: getModelName('openai-compatible', 'ai'),
    temperature: 0,
    maxTokens: getMaxOutputTokens('openai-compatible'),
    maxRetries: 0,
    configuration: {
      baseURL,
      ...(isUsageLogEnabled() && { fetch: createUsageLoggingFetch() }),
    },
  })
}

// The only provider-specific module for the LLM. The graph relies on the generic LangChain
// chat-model interface (`bindTools`, `invoke`), so swapping provider/model is local to this file.
export function createChatModel() {
  return resolveProvider('AI_PROVIDER') === 'openai-compatible' ? createOpenAiCompatibleModel() : createGroqModel()
}
