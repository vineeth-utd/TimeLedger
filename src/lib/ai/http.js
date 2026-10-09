// Shared HTTP mapping for the assistant endpoints (chat and confirm).

const CONFLICTS = {
  pending_action: ['PENDING_ACTION', 'A confirmation is pending. Approve or reject it first.'],
  no_pending_action: ['NO_PENDING_ACTION', 'There is no pending action to confirm.'],
  stale_action: ['STALE_ACTION', 'That action is no longer pending.'],
  outcome_unknown: [
    'ACTION_OUTCOME_UNKNOWN',
    'This action was already submitted and its outcome cannot be confirmed. Check your data and make a new request if needed.',
  ],
  expired: ['ACTION_EXPIRED', 'The confirmation expired and the action was cancelled.'],
}

// A graph failure after the turn started. `outcome` is the server's authoritative answer about
// data changes: 'none' (nothing executed), 'applied' (`changes` definitely happened, the
// assistant just couldn't finish) or 'unknown' (a mutation may have run; never retry blindly).
function failedTurnResponse(threadId, result, label) {
  console.error(`${label} error:`, result.cause)
  const data = { threadId, pendingAction: null, changes: result.changes, outcome: result.outcome }
  if (result.outcome === 'unknown') {
    const [code, message] = CONFLICTS.outcome_unknown
    return Response.json({ success: false, code, message, data }, { status: 409 })
  }
  const busy = result.cause?.status === 429
  return Response.json(
    {
      success: false,
      code: busy ? 'RATE_LIMITED' : 'ASSISTANT_UNAVAILABLE',
      message: busy
        ? 'The assistant is busy right now. Please try again in a moment.'
        : 'The assistant is unavailable right now. Please try again.',
      data,
    },
    { status: busy ? 429 : 500 }
  )
}

export function turnResponse(threadId, result, label = 'assistant') {
  if (result.status === 'failed') return failedTurnResponse(threadId, result, label)
  const conflict = CONFLICTS[result.status]
  if (conflict) {
    const [code, message] = conflict
    return Response.json(
      { success: false, code, message, data: { threadId, pendingAction: result.pendingAction ?? null, changes: [] } },
      { status: 409 }
    )
  }
  return Response.json({
    success: true,
    data: {
      threadId,
      reply: result.reply,
      pendingAction: result.pendingAction ?? null,
      choices: result.choices ? { options: result.choices } : null,
      changes: result.changes ?? [],
    },
  })
}

export function assistantErrorResponse(error, label) {
  console.error(`${label} error:`, error)
  if (error?.status === 429) {
    return Response.json(
      { success: false, message: 'The assistant is busy right now. Please try again in a moment.' },
      { status: 429 }
    )
  }
  return Response.json(
    { success: false, message: 'The assistant is unavailable right now. Please try again.' },
    { status: 500 }
  )
}
