import { randomBytes } from 'node:crypto'

// Pending-action model for human-in-the-loop confirmation.
//
// A pending action is built by the graph's tools node from the gated tool calls the LLM made
// (validated args + a server-built `display`), stored in graph state, and frozen: the approved
// action executes exactly these args. The user-facing payload (interrupt value / API response)
// never carries raw args.

export const PENDING_ACTION_TTL_MS = 30 * 60 * 1000

export const DECISIONS = ['approve', 'reject']

// Random and server-generated (never derived from model tool-call ids); created once when the
// pending action is built and then frozen in graph state.
const newActionId = () => `act_${randomBytes(12).toString('hex')}`

// actions: [{ toolCallId, tool, kind, args, display: { summary, ... } }]
export function buildPendingAction(ctx, actions) {
  return {
    version: 1,
    actionId: newActionId(),
    createdAt: ctx.now.toISOString(),
    expiresAt: new Date(ctx.now.getTime() + PENDING_ACTION_TTL_MS).toISOString(),
    actions,
  }
}

export function isPendingExpired(pending, now) {
  return now.getTime() > new Date(pending.expiresAt).getTime()
}

// What the client may see: no tool arguments, only the server-built display.
export function toPublicPendingAction(pending) {
  return {
    actionId: pending.actionId,
    expiresAt: pending.expiresAt,
    actions: pending.actions.map(({ kind, display }) => ({ kind, display })),
  }
}

// Server-generated confirmation prompt (not LLM text).
export function describePendingAction(publicPending) {
  const lines = publicPending.actions.map((action) => `- ${action.display.summary}`)
  const heading = publicPending.actions.length === 1 ? 'Please confirm this action:' : 'Please confirm these actions:'
  return `${heading}\n${lines.join('\n')}\nApprove or reject?`
}
