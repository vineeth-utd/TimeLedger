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

function readPositiveInteger(envName, fallback) {
  const configured = process.env[envName]?.trim()
  const value = configured ? Number(configured) : NaN
  return Number.isInteger(value) && value > 0 ? value : fallback
}

export function getMaxOutputTokens(provider) {
  const { env, fallback } = MAX_OUTPUT_TOKEN_SETTINGS[provider]
  return readPositiveInteger(env, fallback)
}

// Output-token cap for AI Productivity Agent weekly reports. Separate from the assistant's cap
// (a report is much longer than a chat reply) and independent per provider so each can be tuned
// on its own. Invalid, zero or negative values fall back to the default.
const REPORT_MAX_OUTPUT_TOKEN_SETTINGS = {
  groq: { env: 'GROQ_REPORT_MAX_OUTPUT_TOKENS', fallback: 2048 },
  'openai-compatible': { env: 'OPENAI_COMPATIBLE_REPORT_MAX_OUTPUT_TOKENS', fallback: 2048 },
}

export function getReportMaxOutputTokens(provider) {
  const { env, fallback } = REPORT_MAX_OUTPUT_TOKEN_SETTINGS[provider]
  return readPositiveInteger(env, fallback)
}

// Reasoning effort for weekly reports on the OpenAI-compatible provider only (Groq and the
// assistant keep their own settings). Unset/empty -> undefined: the parameter is not sent and the
// provider default applies. Any other non-empty value must be valid, so a typo is a clear
// configuration error rather than a silently ignored setting.
export const REPORT_REASONING_EFFORTS = ['none', 'low', 'medium', 'high']

export function getReportReasoningEffort(provider) {
  if (provider !== 'openai-compatible') return undefined
  const configured = process.env.OPENAI_COMPATIBLE_REPORT_REASONING_EFFORT?.trim().toLowerCase()
  if (!configured) return undefined
  if (!REPORT_REASONING_EFFORTS.includes(configured)) {
    throw new Error(
      `OPENAI_COMPATIBLE_REPORT_REASONING_EFFORT must be one of: ${REPORT_REASONING_EFFORTS.join(', ')} (got "${configured}")`
    )
  }
  return configured
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
