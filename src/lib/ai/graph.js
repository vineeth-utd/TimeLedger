import { Annotation, END, interrupt, MessagesAnnotation, START, StateGraph } from '@langchain/langgraph'
import { AIMessage, SystemMessage, ToolMessage } from '@langchain/core/messages'
import { buildPendingAction, isPendingExpired, toPublicPendingAction } from '@/lib/ai/confirmation'
import { buildSystemPrompt } from '@/lib/ai/prompt'
import { fail, OutputTruncatedError } from '@/lib/ai/results'
import { getToolDefinitions } from '@/lib/ai/tools'

// Conversation messages plus the frozen pending action awaiting user confirmation (or null).
const AssistantState = Annotation.Root({
  ...MessagesAnnotation.spec,
  pending: Annotation({ reducer: (_current, update) => update, default: () => null }),
})

// LangGraph handles orchestration only: LLM -> tools -> (confirm) -> LLM loop and conversation
// state. All TimeLedger behavior stays in the tools/services.
//
//   agent -> tools -> agent                 (reads, createActivity, updateActivity run directly)
//   agent -> tools -> confirm -> agent      (a gated tool call: delete, category creation)
//   agent -> tools -> END                   (presentChoices: ask the user to pick; the turn ends)
//
// Confirmation is enforced here, not by the prompt: the tools node never executes a gated tool.
// It validates the call, builds a server-side display, and stores the frozen args in `pending`.
// The confirm node raises ONE interrupt; only after an approving resume does it execute those
// exact frozen args (no LLM call happens in between). Side effects occur only after interrupt(),
// because LangGraph re-runs an interrupted node from its start when resuming.
//
// The trusted tool context (`ctx`: userId, timezone, now) is captured by closure. It is never
// part of graph state, never visible to the LLM, and never written to a checkpoint.
// `model` may be a chat model or a factory returning one (created lazily so state can be
// inspected without a model/API key).
export function buildAssistantGraph({ ctx, tools, model, checkpointer }) {
  const toolsByName = new Map(tools.map((tool) => [tool.name, tool]))
  let modelWithTools = null
  const getModelWithTools = () => {
    modelWithTools ??= (typeof model === 'function' ? model() : model).bindTools(getToolDefinitions(tools))
    return modelWithTools
  }

  const toolMessage = (call, result) =>
    new ToolMessage({ content: JSON.stringify(result), tool_call_id: call.id, name: call.name })

  // A length-limited response is kept when it still carries a complete tool call or some text;
  // with neither it would be an empty assistant message, so the turn fails instead (the normal
  // failure path then reports any earlier changes). Nothing is retried automatically.
  function assertUsable(response) {
    if (response.response_metadata?.finish_reason !== 'length') return
    const hasToolCall = (response.tool_calls?.length ?? 0) > 0
    const { content } = response
    const hasText =
      typeof content === 'string'
        ? content.trim().length > 0
        : content.some((block) => block.type === 'text' && block.text?.trim())
    if (!hasToolCall && !hasText) throw new OutputTruncatedError()
  }

  async function agentNode(state) {
    const response = await getModelWithTools().invoke([
      new SystemMessage(buildSystemPrompt(ctx)),
      ...state.messages,
    ])
    assertUsable(response)
    return { messages: [response] }
  }

  async function toolsNode(state) {
    const lastMessage = state.messages[state.messages.length - 1]
    const results = []
    const gated = []
    for (const call of lastMessage.tool_calls ?? []) {
      const tool = toolsByName.get(call.name)
      if (!tool) {
        results.push(toolMessage(call, fail('TOOL_NOT_AVAILABLE', `Tool "${call.name}" is not available.`)))
      } else if (tool.confirmation) {
        gated.push({ call, tool })
      } else {
        results.push(toolMessage(call, await tool.execute(ctx, call.args)))
      }
    }

    const actions = []
    for (const { call, tool } of gated) {
      const prepared = await tool.prepareConfirmation(ctx, call.args)
      if (prepared.success === false) {
        results.push(toolMessage(call, prepared)) // invalid/impossible: reported, never confirmed
      } else {
        actions.push({
          toolCallId: call.id,
          tool: tool.name,
          kind: tool.confirmation.kind,
          args: prepared.args,
          display: prepared.display,
        })
      }
    }

    const update = { messages: results }
    if (actions.length) {
      update.pending = buildPendingAction(ctx, actions)
    } else {
      // presentChoices ends the turn: the question (with its structured options in metadata)
      // becomes the assistant's final message and the user answers by click or free text.
      const offered = results
        .map((message) => {
          try {
            return message.name === 'presentChoices' ? JSON.parse(message.content) : null
          } catch {
            return null
          }
        })
        .findLast((result) => result?.success)
      if (offered) {
        update.messages = [
          ...results,
          new AIMessage({ content: offered.question, response_metadata: { choices: offered.options } }),
        ]
      }
    }
    return update
  }

  async function confirmNode(state) {
    const pending = state.pending
    const decision = interrupt(toPublicPendingAction(pending))

    const approved =
      decision?.actionId === pending.actionId &&
      decision?.decision === 'approve' &&
      !isPendingExpired(pending, ctx.now)

    const results = []
    for (const action of pending.actions) {
      const call = { id: action.toolCallId, name: action.tool }
      if (!approved) {
        const expired = decision?.decision === 'expire' || isPendingExpired(pending, ctx.now)
        results.push(
          toolMessage(
            call,
            expired
              ? fail('ACTION_EXPIRED', 'The confirmation expired. The action was not performed.')
              : fail('USER_REJECTED', 'The user declined this action. It was not performed.')
          )
        )
        continue
      }
      const tool = toolsByName.get(action.tool)
      const result = tool
        ? await tool.executeApproved(ctx, action.args, action.display)
        : fail('TOOL_NOT_AVAILABLE', `Tool "${action.tool}" is not available.`)
      results.push(toolMessage(call, result))
    }
    return { messages: results, pending: null }
  }

  const routeAfterAgent = (state) => (state.messages[state.messages.length - 1].tool_calls?.length ? 'tools' : END)
  const routeAfterTools = (state) => {
    if (state.pending) return 'confirm'
    return state.messages[state.messages.length - 1].getType() === 'ai' ? END : 'agent'
  }

  return new StateGraph(AssistantState)
    .addNode('agent', agentNode)
    .addNode('tools', toolsNode)
    .addNode('confirm', confirmNode)
    .addEdge(START, 'agent')
    .addConditionalEdges('agent', routeAfterAgent, ['tools', END])
    .addConditionalEdges('tools', routeAfterTools, ['confirm', 'agent', END])
    .addEdge('confirm', 'agent')
    .compile({ checkpointer })
}
