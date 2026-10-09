// Browser-side helpers for the assistant endpoints. Pure mapping of HTTP responses to a small
// result shape so the UI never touches raw response bodies, tool calls or internal values.

export function getBrowserTimeZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone
}

export function newThreadId() {
  return crypto.randomUUID()
}

// Result: { ok, reply, pendingAction, choices, changes, code, message, unauthorized }
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

// Data refresh: after the assistant changes TimeLedger data, pages re-fetch what they display.
// See useAssistantRefreshKey (used by the pages' existing refreshKey fetch effects).
export const DATA_CHANGED_EVENT = 'timeledger:data-changed'

export function notifyDataChanged() {
  window.dispatchEvent(new Event(DATA_CHANGED_EVENT))
}
