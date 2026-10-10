import { Command, GraphRecursionError, INTERRUPT } from '@langchain/langgraph'
import { HumanMessage, ToolMessage } from '@langchain/core/messages'
import { createChatModel } from '@/lib/ai/llm'
import { getCheckpointer } from '@/lib/ai/checkpointer'
import { describePendingAction, isPendingExpired, toPublicPendingAction } from '@/lib/ai/confirmation'
import { claimAction, isActionClaimed } from '@/lib/ai/actionClaims'
import { buildAssistantGraph } from '@/lib/ai/graph'
import { getAssistantTools } from '@/lib/ai/tools'

const DEFAULT_RECURSION_LIMIT = 12
const STEP_LIMIT_REPLY =
  'I wasn\'t able to finish that request in a reasonable number of steps. Please try again with a simpler or more specific request.'

function messageText(message) {
  if (typeof message.content === 'string') return message.content
  return message.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('')
}

// Tool calls made during this turn (after the latest user message), for testing/debugging.
// Internal only: never returned from the public API.
function collectToolCalls(messages) {
  const lastHumanIndex = messages.findLastIndex((message) => message.getType() === 'human')
  const turn = messages.slice(lastHumanIndex + 1)
  const argsById = new Map(
    turn.flatMap((message) => (message.tool_calls ?? []).map((call) => [call.id, call.args]))
  )
  return turn
    .filter((message) => message instanceof ToolMessage)
    .map((message) => {
      let success = null
      try {
        success = JSON.parse(message.content).success
      } catch {}
      return { name: message.name, args: argsById.get(message.tool_call_id), success, result: message.content }
    })
}

// Application changes applied during this turn, from successful mutating tool results (never from
// the model's prose). Lets the client refresh what it displays. Deduplicated by type.
const MUTATION_TYPES = {
  createActivity: 'activity_created',
  updateActivity: 'activity_updated',
  deleteActivity: 'activity_deleted',
  createMainCategory: 'category_created',
  createSubCategory: 'category_created',
  deleteMainCategory: 'category_deleted',
  deleteSubCategory: 'category_deleted',
}

function collectChanges(messages) {
  const types = new Set()
  for (const call of collectToolCalls(messages)) {
    if (call.success === true && MUTATION_TYPES[call.name]) types.add(MUTATION_TYPES[call.name])
  }
  return [...types].map((type) => ({ type }))
}

// Structured options from a presentChoices turn (the final message), or null.
const collectChoices = (message) => message.response_metadata?.choices ?? null

// Tokens the model consumed during this turn (for pacing/diagnostics). Internal only.
function collectTokenUsage(messages) {
  const lastHumanIndex = messages.findLastIndex((message) => message.getType() === 'human')
  return messages
    .slice(lastHumanIndex + 1)
    .reduce((total, message) => total + (message.usage_metadata?.total_tokens ?? 0), 0)
}

// `model` and `checkpointer` are injectable for tests; production uses Groq + PostgreSQL.
function buildGraph(ctx, tools, { model = createChatModel, checkpointer = getCheckpointer() } = {}) {
  return buildAssistantGraph({ ctx, tools, model, checkpointer })
}

const threadConfig = (ctx, threadId, recursionLimit) => ({
  configurable: { thread_id: `${ctx.userId}:${threadId}` },
  ...(recursionLimit && { recursionLimit }),
})

// The pending confirmation (frozen args included, server-side only) for a thread, or null.
async function readPending(graph, config) {
  const snapshot = await graph.getState(config)
  const hasInterrupt = snapshot.tasks?.some((task) => task.interrupts?.length)
  return {
    snapshot,
    pending: hasInterrupt ? (snapshot.values?.pending ?? null) : null,
  }
}

// Shapes a graph result: either a finished turn or one waiting for user confirmation.
function toTurnResult(state) {
  if (state[INTERRUPT]?.length) {
    const pendingAction = state[INTERRUPT][0].value
    return {
      status: 'needs_confirmation',
      reply: describePendingAction(pendingAction),
      pendingAction,
      choices: null,
      changes: collectChanges(state.messages),
      toolCalls: collectToolCalls(state.messages),
      tokensUsed: collectTokenUsage(state.messages),
    }
  }
  const messages = state.messages
  return {
    status: 'complete',
    reply: messageText(messages[messages.length - 1]),
    pendingAction: null,
    choices: collectChoices(messages[messages.length - 1]),
    changes: collectChanges(messages),
    toolCalls: collectToolCalls(messages),
    tokensUsed: collectTokenUsage(messages),
  }
}

// Only these run inside the tools node (gated tools execute in the confirm node instead).
const DIRECT_MUTATIONS = new Set(['createActivity', 'updateActivity'])

// After a graph failure, rebuilds what is definitely known from the checkpoint (completed nodes
// are persisted, including their tool messages) instead of tracking mutations separately.
//   changes  successful mutations in this invocation (messages after `baseline`)
//   outcome  'applied' (>= 1 change confirmed), 'none' (nothing executed), or 'unknown' (a node
//            that may have mutated did not complete, or the state can't be read)
// `resolving` is the claimed decision when this invocation resumed a confirmation.
async function recoverAfterFailure(graph, config, { baseline, resolving }) {
  try {
    const snapshot = await graph.getState(config)
    const messages = (snapshot.values?.messages ?? []).slice(baseline)
    const changes = collectChanges(messages)
    // A node that failed midway can appear in `tasks` rather than `next` (e.g. an interrupted node).
    const incomplete = new Set([...(snapshot.next ?? []), ...(snapshot.tasks ?? []).map((task) => task.name)])
    const lastCalls = snapshot.values?.messages?.at(-1)?.tool_calls ?? []
    const mutationMayHaveRun =
      (resolving === 'approve' && incomplete.has('confirm')) ||
      (incomplete.has('tools') && lastCalls.some((call) => DIRECT_MUTATIONS.has(call.name)))
    return { changes, outcome: mutationMayHaveRun ? 'unknown' : changes.length ? 'applied' : 'none' }
  } catch {
    return { changes: [], outcome: 'unknown' }
  }
}

// Failures are returned, not thrown, so the caller still gets the authoritative changes:
// { status: 'failed', cause, changes, outcome }.
async function invokeGraph(graph, input, config, { baseline = 0, resolving = null } = {}) {
  try {
    return toTurnResult(await graph.invoke(input, config))
  } catch (error) {
    const recovery = await recoverAfterFailure(graph, config, { baseline, resolving })
    if (error instanceof GraphRecursionError) {
      return { status: 'complete', reply: STEP_LIMIT_REPLY, pendingAction: null, choices: null, changes: recovery.changes, toolCalls: [], tokensUsed: 0, stepLimitReached: true }
    }
    return { status: 'failed', cause: error, ...recovery }
  }
}

// Runs one user turn. Conversation state (user/assistant/tool messages and any pending
// confirmation) is owned by the LangGraph checkpointer and keyed by user + client threadId, so
// threads can't cross users. While a confirmation is pending the thread accepts only
// resumeAssistant: a new message returns { status: 'pending_action' } without touching state.
// Result: { status: 'complete' | 'needs_confirmation' | 'pending_action', reply, pendingAction, toolCalls }.
export async function runAssistant({
  ctx,
  threadId,
  message,
  tools = getAssistantTools(),
  recursionLimit = DEFAULT_RECURSION_LIMIT,
  model,
  checkpointer,
}) {
  const graph = buildGraph(ctx, tools, { model, checkpointer })
  const config = threadConfig(ctx, threadId, recursionLimit)

  const { snapshot, pending } = await readPending(graph, config)
  if (pending) {
    // A claimed action can never be resolved again: don't offer it as an active confirmation.
    if (await isActionClaimed({ userId: ctx.userId, threadId, actionId: pending.actionId })) {
      return { status: 'outcome_unknown' }
    }
    const pendingAction = toPublicPendingAction(pending)
    return { status: 'pending_action', reply: describePendingAction(pendingAction), pendingAction, toolCalls: [], tokensUsed: 0 }
  }

  const baseline = snapshot.values?.messages?.length ?? 0
  return invokeGraph(graph, { messages: [new HumanMessage(message)] }, config, { baseline })
}

// Resolves the pending confirmation. The client sends only { actionId, decision }; the executed
// action is the frozen one stored in graph state. Statuses besides the runAssistant ones:
// 'no_pending_action', 'stale_action' (actionId mismatch), 'outcome_unknown' (already claimed),
// 'expired' (cancelled, not executed).
export async function resumeAssistant({
  ctx,
  threadId,
  actionId,
  decision,
  tools = getAssistantTools(),
  recursionLimit = DEFAULT_RECURSION_LIMIT,
  model,
  checkpointer,
}) {
  const graph = buildGraph(ctx, tools, { model, checkpointer })
  const config = threadConfig(ctx, threadId, recursionLimit)

  const { snapshot, pending } = await readPending(graph, config)
  if (!pending) return { status: 'no_pending_action' }
  if (pending.actionId !== actionId) return { status: 'stale_action' }

  const expired = isPendingExpired(pending, ctx.now)
  const resumeDecision = expired ? 'expire' : decision

  // At most once: claim before resuming. A conflict means the action was already submitted (still
  // running, finished, or failed midway); it is never executed again through confirmation.
  const claimed = await claimAction({ userId: ctx.userId, threadId, actionId, decision: resumeDecision })
  if (!claimed) return { status: 'outcome_unknown' }

  // From here the action is claimed: a failure is reported with what is definitely known and the
  // confirmation is never offered again.
  const baseline = snapshot.values?.messages?.length ?? 0
  const result = await invokeGraph(graph, new Command({ resume: { actionId, decision: resumeDecision } }), config, {
    baseline,
    resolving: resumeDecision,
  })
  return expired && result.status === 'complete' ? { ...result, status: 'expired' } : result
}
