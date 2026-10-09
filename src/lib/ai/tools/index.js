import { z } from 'zod'
import {
  createActivityTool,
  deleteActivityTool,
  getActivitiesTool,
  getRecentActivitiesTool,
  updateActivityTool,
} from './activityTools'
import { createMainCategoryTool, createSubCategoryTool, getCategoriesTool } from './categoryTools'

// Milestone 1 tool registry. Each tool: { name, description, schema (Zod), execute(ctx, input) }.
export const aiTools = [
  getCategoriesTool,
  getActivitiesTool,
  getRecentActivitiesTool,
  createActivityTool,
  updateActivityTool,
  deleteActivityTool,
  createMainCategoryTool,
  createSubCategoryTool,
]

const toolsByName = new Map(aiTools.map((tool) => [tool.name, tool]))

export function getAiTool(name) {
  return toolsByName.get(name) ?? null
}

// Tools exposed to the assistant. Reads and create/update activity execute directly. Delete and
// category creation are bound too, but carry `confirmation`: the graph never calls their
// `execute` from the model's tool call; they run only after the user approves a pending action.
export function getAssistantTools() {
  return aiTools
}

export function requiresConfirmation(tool) {
  return Boolean(tool.confirmation)
}

// Provider-neutral function-calling definitions generated from the same Zod schemas.
export function getToolDefinitions(tools) {
  return tools.map((tool) => {
    const { $schema, ...parameters } = z.toJSONSchema(tool.schema)
    return {
      type: 'function',
      function: { name: tool.name, description: tool.description, parameters },
    }
  })
}
