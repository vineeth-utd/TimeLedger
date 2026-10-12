// Provider selection shared by the LLM (AI_PROVIDER) and speech-to-text (STT_PROVIDER) layers.
// The two are independent. Both default to Groq so deployments that only set GROQ_API_KEY keep
// working. Server-only: never import this from client components (it reads secrets).

export const PROVIDERS = ['groq', 'openai-compatible']
const DEFAULT_PROVIDER = 'groq'

// `envName` is AI_PROVIDER or STT_PROVIDER. Unset/empty means the default; anything else must be valid.
export function resolveProvider(envName) {
  const configured = process.env[envName]?.trim().toLowerCase()
  if (!configured) return DEFAULT_PROVIDER
  if (!PROVIDERS.includes(configured)) {
    throw new Error(`${envName} must be one of: ${PROVIDERS.join(', ')} (got "${configured}")`)
  }
  return configured
}

export function requireEnv(name) {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`${name} is not configured`)
  return value
}

// Model ids differ per provider (e.g. `openai/gpt-oss-120b` on Groq, `gpt-oss-120b` elsewhere), so
// each provider has its own variables: <PROVIDER>_AI_MODEL and <PROVIDER>_STT_MODEL.
const MODEL_SETTINGS = {
  groq: {
    ai: { env: 'GROQ_AI_MODEL', fallback: 'openai/gpt-oss-120b' },
    stt: { env: 'GROQ_STT_MODEL', fallback: 'whisper-large-v3-turbo' },
  },
  'openai-compatible': {
    ai: { env: 'OPENAI_COMPATIBLE_AI_MODEL', fallback: 'gpt-oss-120b' },
    stt: { env: 'OPENAI_COMPATIBLE_STT_MODEL', fallback: 'whisper-large-v3' },
  },
}

// `kind` is 'ai' (chat) or 'stt' (speech-to-text).
export function getModelName(provider, kind) {
  const { env, fallback } = MODEL_SETTINGS[provider][kind]
  return process.env[env]?.trim() || fallback
}

// Output-token cap per model call, per provider. Groq's 512 is tuned to its TPM pre-check (see
// docs/ai_token_optimization.md); other providers have no such constraint. A missing, non-numeric,
// fractional, zero or negative value falls back to the provider default instead of reaching the model.
const MAX_OUTPUT_TOKEN_SETTINGS = {
  groq: { env: 'GROQ_AI_MAX_OUTPUT_TOKENS', fallback: 512 },
  'openai-compatible': { env: 'OPENAI_COMPATIBLE_AI_MAX_OUTPUT_TOKENS', fallback: 1024 },
}

export function getMaxOutputTokens(provider) {
  const { env, fallback } = MAX_OUTPUT_TOKEN_SETTINGS[provider]
  const configured = process.env[env]?.trim()
  const value = configured ? Number(configured) : NaN
  return Number.isInteger(value) && value > 0 ? value : fallback
}

export function getGroqApiKey() {
  return requireEnv('GROQ_API_KEY')
}

// An OpenAI-compatible API. The base URL is used as given, minus any trailing slash.
export function getOpenAiCompatibleConfig() {
  return {
    baseURL: requireEnv('OPENAI_COMPATIBLE_API_BASE_URL').replace(/\/+$/, ''),
    apiKey: requireEnv('OPENAI_COMPATIBLE_API_KEY'),
  }
}
