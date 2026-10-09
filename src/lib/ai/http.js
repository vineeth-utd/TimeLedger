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

export function turnResponse(threadId, result) {
  const conflict = CONFLICTS[result.status]
  if (conflict) {
    const [code, message] = conflict
    return Response.json(
      { success: false, code, message, data: { threadId, pendingAction: result.pendingAction ?? null } },
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
