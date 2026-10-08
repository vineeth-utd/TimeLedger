import { END, MessagesAnnotation, START, StateGraph } from '@langchain/langgraph'
import { SystemMessage, ToolMessage } from '@langchain/core/messages'
import { buildSystemPrompt } from '@/lib/ai/prompt'
import { fail } from '@/lib/ai/results'
import { getToolDefinitions } from '@/lib/ai/tools'

// LangGraph handles orchestration only: LLM -> tools -> LLM loop and conversation state.
// All TimeLedger behavior stays in the tools/services.
//
// The trusted tool context (`ctx`: userId, timezone, now) is captured by closure. It is
// never part of graph state, never visible to the LLM, and never written to a checkpoint.
// `tools` is the allowed set: it is both what the LLM is told about and all that can run.
export function buildAssistantGraph({ ctx, tools, model, checkpointer }) {
  const toolsByName = new Map(tools.map((tool) => [tool.name, tool]))
  const modelWithTools = model.bindTools(getToolDefinitions(tools))

  async function agentNode(state) {
    const response = await modelWithTools.invoke([
      new SystemMessage(buildSystemPrompt(ctx)),
      ...state.messages,
    ])
    return { messages: [response] }
  }

  async function toolsNode(state) {
    const lastMessage = state.messages[state.messages.length - 1]
    const results = []
    for (const call of lastMessage.tool_calls ?? []) {
      const tool = toolsByName.get(call.name)
      const result = tool
        ? await tool.execute(ctx, call.args)
        : fail('TOOL_NOT_AVAILABLE', `Tool "${call.name}" is not available.`)
      results.push(
        new ToolMessage({ content: JSON.stringify(result), tool_call_id: call.id, name: call.name })
      )
    }
    return { messages: results }
  }

  function routeAfterAgent(state) {
    const lastMessage = state.messages[state.messages.length - 1]
    return lastMessage.tool_calls?.length ? 'tools' : END
  }

  return new StateGraph(MessagesAnnotation)
    .addNode('agent', agentNode)
    .addNode('tools', toolsNode)
    .addEdge(START, 'agent')
    .addConditionalEdges('agent', routeAfterAgent, ['tools', END])
    .addEdge('tools', 'agent')
    .compile({ checkpointer })
}
