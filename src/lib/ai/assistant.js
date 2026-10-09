import { GraphRecursionError } from '@langchain/langgraph'
import { HumanMessage, ToolMessage } from '@langchain/core/messages'
import { createChatModel } from '@/lib/ai/llm'
import { getCheckpointer } from '@/lib/ai/checkpointer'
import { buildAssistantGraph } from '@/lib/ai/graph'
import { getAssistantTools } from '@/lib/ai/tools'

const DEFAULT_RECURSION_LIMIT = 12
const STEP_LIMIT_REPLY =
  'I wasn\'t able to finish that request in a reasonable number of steps. Please try again with a simpler or more specific request.'

function isEnabled(value) {
  return String(value).toLowerCase() === 'true'
}

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

// Tokens the model consumed during this turn (for pacing/diagnostics). Internal only.
function collectTokenUsage(messages) {
  const lastHumanIndex = messages.findLastIndex((message) => message.getType() === 'human')
  return messages
    .slice(lastHumanIndex + 1)
    .reduce((total, message) => total + (message.usage_metadata?.total_tokens ?? 0), 0)
}

// Runs one user turn. Conversation state (user/assistant/tool messages) is owned by the
// LangGraph checkpointer and keyed by user + client threadId, so threads can't cross users.
export async function runAssistant({
  ctx,
  threadId,
  message,
  tools = getAssistantTools({
    enableActivityWrites: isEnabled(process.env.AI_ENABLE_ACTIVITY_WRITES),
  }),
  recursionLimit = DEFAULT_RECURSION_LIMIT,
}) {
  const graph = buildAssistantGraph({
    ctx,
    tools,
    model: createChatModel(),
    checkpointer: getCheckpointer(),
  })

  try {
    const state = await graph.invoke(
      { messages: [new HumanMessage(message)] },
      { configurable: { thread_id: `${ctx.userId}:${threadId}` }, recursionLimit }
    )
    const messages = state.messages
    return {
      reply: messageText(messages[messages.length - 1]),
      toolCalls: collectToolCalls(messages),
      tokensUsed: collectTokenUsage(messages),
    }
  } catch (error) {
    if (error instanceof GraphRecursionError) {
      return { reply: STEP_LIMIT_REPLY, toolCalls: [], stepLimitReached: true }
    }
    throw error
  }
}
