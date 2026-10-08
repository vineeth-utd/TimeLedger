import { ChatGroq } from '@langchain/groq'

const DEFAULT_MODEL = 'openai/gpt-oss-120b'
const DEFAULT_MAX_OUTPUT_TOKENS = 1024

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
  })
}
