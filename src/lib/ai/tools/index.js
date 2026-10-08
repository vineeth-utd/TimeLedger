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

// Tools the normal assistant may use before confirmation workflows exist (Milestone 5):
// reads always; createActivity/updateActivity only for controlled testing; delete and
// category creation never. The same list feeds LLM binding AND execution, so the
// restriction is enforced in code rather than by the prompt.
const READ_TOOL_NAMES = ['getCategories', 'getActivities', 'getRecentActivities']
const ACTIVITY_WRITE_TOOL_NAMES = ['createActivity', 'updateActivity']

export function getAssistantTools({ enableActivityWrites = false } = {}) {
  const allowed = new Set(
    enableActivityWrites ? [...READ_TOOL_NAMES, ...ACTIVITY_WRITE_TOOL_NAMES] : READ_TOOL_NAMES
  )
  return aiTools.filter((tool) => allowed.has(tool.name))
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
