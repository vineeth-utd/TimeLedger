// Browser-side helpers for the assistant endpoints. Pure mapping of HTTP responses to a small
// result shape so the UI never touches raw response bodies, tool calls or internal values.

export function getBrowserTimeZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone
}

export function newThreadId() {
  return crypto.randomUUID()
}

// Result: { ok, reply, pendingAction, choices, changes, outcome, code, message, unauthorized }
// `changes`/`outcome` come only from the server (also on failures): outcome is 'none' | 'applied' |
// 'unknown' when the server resolved the attempt, undefined when it never answered.
export function interpretResponse(status, body) {
  if (status === 401) return { ok: false, unauthorized: true, code: 'UNAUTHORIZED' }
  if (status >= 200 && status < 300 && body?.success) {
    return {
      ok: true,
      reply: body.data?.reply ?? '',
      pendingAction: body.data?.pendingAction ?? null,
      choices: body.data?.choices?.options ?? null,
      changes: body.data?.changes ?? [],
    }
  }
  return {
    ok: false,
    code: body?.code ?? (status === 429 ? 'RATE_LIMITED' : status === 400 ? 'BAD_REQUEST' : 'ERROR'),
    message: body?.message,
    pendingAction: body?.data?.pendingAction ?? null,
    changes: body?.data?.changes ?? [],
    outcome: body?.data?.outcome,
    retryAfterSeconds: body?.data?.retryAfterSeconds ?? null,
  }
}

async function post(path, payload) {
  try {
    const response = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, timezone: getBrowserTimeZone() }),
    })
    const body = await response.json().catch(() => null)
    return interpretResponse(response.status, body)
  } catch {
    return { ok: false, code: 'NETWORK' }
  }
}

export const sendChat = (threadId, message) => post('/api/assistant/chat', { threadId, message })

export const sendConfirm = (threadId, actionId, decision) =>
  post('/api/assistant/confirm', { threadId, actionId, decision })

// Result: { ok, text } or { ok: false, unauthorized | code, message, retryAfterSeconds }.
export function interpretTranscription(status, body) {
  if (status === 401) return { ok: false, unauthorized: true, code: 'UNAUTHORIZED' }
  if (status >= 200 && status < 300 && body?.success && typeof body.data?.text === 'string') {
    return { ok: true, text: body.data.text }
  }
  return {
    ok: false,
    code: body?.code ?? 'ERROR',
    message: body?.message,
    retryAfterSeconds: body?.data?.retryAfterSeconds ?? null,
  }
}

// Speech-to-text only: uploads one recording and returns text. Never touches the chat endpoints.
export async function sendTranscription(file, signal) {
  try {
    const form = new FormData()
    form.append('audio', file)
    const response = await fetch('/api/assistant/transcribe', { method: 'POST', body: form, signal })
    const body = await response.json().catch(() => null)
    return interpretTranscription(response.status, body)
  } catch (error) {
    if (error?.name === 'AbortError') return { ok: false, aborted: true }
    return { ok: false, code: 'NETWORK' }
  }
}

// Data refresh: after the assistant changes TimeLedger data, pages re-fetch what they display.
// See useAssistantRefreshKey (used by the pages' existing refreshKey fetch effects).
export const DATA_CHANGED_EVENT = 'timeledger:data-changed'

export function notifyDataChanged() {
  window.dispatchEvent(new Event(DATA_CHANGED_EVENT))
}

// ---- Result -> UI plan ------------------------------------------------------------------------
// Pure mapping from a server result to what the UI must do, so the state rules are testable.
// It uses only authoritative server fields (`changes`, `outcome`, `code`), never reply prose.
//   refresh      re-fetch visible TimeLedger data
//   pending      'keep' | 'clear' | a pendingAction object
//   messages     [{ role, text, choices? }] to append
//   error        banner text or null
//   resetThread  start a new server thread (the old one can't be continued safely)

const CHANGE_TEXT = {
  activity_created: 'An activity was created',
  activity_updated: 'An activity was updated',
  activity_deleted: 'An activity was deleted',
  category_created: 'A category was created',
  category_deleted: 'A category was deleted',
}

export function describeChanges(changes) {
  const parts = [...new Set(changes.map((change) => CHANGE_TEXT[change.type]).filter(Boolean))]
  return parts.length ? `${parts.join('. ')}.` : ''
}

const NO_CHANGES = ' No changes were made.'
const TEXT = {
  expired: 'That request expired and was cancelled. Nothing was changed.',
  notPending: 'That request is no longer pending. Nothing was changed by it.',
  unknown:
    'That request was already submitted and its result cannot be confirmed. Check your Activities, then ask again if needed.',
  unknownChat:
    'A previous request in this conversation could not be confirmed, so a new conversation was started. Check your Activities, then send your message again.',
  busy: 'The assistant is busy right now. Please try again in a moment.',
  unavailable: 'The assistant is unavailable right now. Please try again.',
  incomplete: "The assistant couldn't finish that response. Please try again or rephrase.",
  neutralChatFailure:
    'The assistant could not finish that request. Check your Activities to see whether anything changed before trying again.',
  neutralConfirmFailure: 'The confirmation could not be completed. Please try again.',
}

// Compact record of a resolved confirmation, from the server-built display summaries only
// (no tool names, arguments or ids): "✓ Approved: ..." / "✗ Rejected: ...".
export function describeDecision(pendingAction, decision) {
  const label = decision === 'approve' ? '✓ Approved' : '✗ Rejected'
  return pendingAction.actions.map((action) => ({ role: 'notice', text: `${label}: ${action.display.summary}` }))
}

// "...busy right now. Try again in about N seconds." when the server passed the provider's hint.
function busyText(seconds) {
  if (!seconds) return TEXT.busy
  return `The assistant is busy right now. Please try again in about ${seconds} second${seconds === 1 ? '' : 's'}.`
}

export function planResult(result, kind) {
  const plan = { refresh: false, pending: 'keep', messages: [], error: null, resetThread: false, unauthorized: false }
  const changes = result.changes ?? []
  const notice = (text) => plan.messages.push({ role: 'notice', text })

  if (result.unauthorized) return { ...plan, unauthorized: true }

  if (result.ok) {
    plan.refresh = changes.length > 0
    if (result.pendingAction) plan.pending = result.pendingAction
    else {
      plan.pending = 'clear'
      if (result.reply) plan.messages.push({ role: 'assistant', text: result.reply, choices: result.choices })
    }
    return plan
  }

  const failureReason =
    result.code === 'RATE_LIMITED'
      ? busyText(result.retryAfterSeconds)
      : result.code === 'ASSISTANT_INCOMPLETE'
        ? TEXT.incomplete
        : TEXT.unavailable

  switch (result.code) {
    case 'PENDING_ACTION':
      plan.pending = result.pendingAction
      return plan
    case 'ACTION_EXPIRED':
      plan.pending = 'clear'
      notice(TEXT.expired)
      return plan
    case 'STALE_ACTION':
    case 'NO_PENDING_ACTION':
      plan.pending = 'clear'
      notice(TEXT.notPending)
      return plan
    case 'ACTION_OUTCOME_UNKNOWN': {
      plan.pending = 'clear'
      plan.refresh = true
      plan.resetThread = true
      const known = describeChanges(changes)
      notice(kind === 'chat' ? TEXT.unknownChat : known ? `${known} ${TEXT.unknown}` : TEXT.unknown)
      return plan
    }
    case 'BAD_REQUEST':
      plan.error = result.message ?? 'That message could not be sent.'
      return plan
  }

  if (result.outcome === 'applied') {
    plan.pending = 'clear'
    plan.refresh = true
    notice(`${describeChanges(changes)} The assistant then could not finish its reply. ${failureReason}`)
    return plan
  }
  if (result.outcome === 'none') {
    if (kind === 'confirm') plan.pending = 'clear' // claimed: never offered again
    plan.error = `${failureReason}${NO_CHANGES}`
    return plan
  }
  // No structured answer (network failure or an error before anything ran): nothing is assumed.
  plan.error = kind === 'chat' ? TEXT.neutralChatFailure : TEXT.neutralConfirmFailure
  return plan
}
