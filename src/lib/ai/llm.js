import { ChatGroq } from '@langchain/groq'
import { createUsageLoggingFetch, isUsageLogEnabled } from '@/lib/ai/usageLog'

const DEFAULT_MODEL = 'openai/gpt-oss-120b'
// Groq counts `max_tokens` toward the TPM pre-check ("Requested" = input + this cap), so the cap is
// kept close to real usage. Observed completions (reasoning included) are ~130-250 tokens.
const DEFAULT_MAX_OUTPUT_TOKENS = 512
const REASONING_EFFORTS = ['low', 'medium', 'high']
const DEFAULT_REASONING_EFFORT = 'low'

export function getReasoningEffort() {
  const configured = process.env.AI_REASONING_EFFORT?.trim().toLowerCase()
  return REASONING_EFFORTS.includes(configured) ? configured : DEFAULT_REASONING_EFFORT
}

// The only provider-specific module. The graph relies on the generic LangChain
// chat-model interface (`bindTools`, `invoke`), so swapping provider/model is local to this file.
export function createChatModel() {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) {
    throw new Error('GROQ_API_KEY is not configured')
  }
  return new ChatGroq({
    apiKey,
    model: process.env.AI_MODEL || DEFAULT_MODEL,
    temperature: 0,
    maxTokens: Number(process.env.AI_MAX_OUTPUT_TOKENS) || DEFAULT_MAX_OUTPUT_TOKENS,
    reasoningEffort: getReasoningEffort(),
    ...(isUsageLogEnabled() && { fetch: createUsageLoggingFetch() }),
  })
}
