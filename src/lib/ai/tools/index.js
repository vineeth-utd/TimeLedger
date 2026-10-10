import { z } from 'zod'
import {
  createActivityTool,
  deleteActivityTool,
  getActivitiesTool,
  getRecentActivitiesTool,
  updateActivityTool,
} from './activityTools'
import { presentChoicesTool } from './choiceTools'
import {
  createMainCategoryTool,
  createSubCategoryTool,
  deleteMainCategoryTool,
  deleteSubCategoryTool,
  getCategoriesTool,
} from './categoryTools'

// TimeLedger AI tool registry. Each tool: { name, description, schema (Zod), execute(ctx, input) }.
export const aiTools = [
  getCategoriesTool,
  getActivitiesTool,
  getRecentActivitiesTool,
  createActivityTool,
  updateActivityTool,
  deleteActivityTool,
  createMainCategoryTool,
  createSubCategoryTool,
  deleteMainCategoryTool,
  deleteSubCategoryTool,
  presentChoicesTool,
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

// Machine-validation keywords removed from the schema sent to the model. They cost tokens and the
// model gains little from them: Zod (the authoritative validator) still enforces every constraint in
// `execute`, and a violation comes back as a structured tool error. Human-readable hints
// (`.describe('YYYY-MM-DD')`, `'HH:mm'`, ...) stay as `description`. Removing the keywords also stops
// the provider rejecting a call itself (a 400 that consumes tokens and fails the whole turn).
const WIRE_VALIDATION_KEYWORDS = new Set([
  '$schema',
  'pattern',
  'additionalProperties',
  'minimum',
  'maximum',
  'exclusiveMinimum',
  'exclusiveMaximum',
  'minLength',
  'maxLength',
  'minItems',
  'maxItems',
])

function toWireSchema(node) {
  if (Array.isArray(node)) return node.map(toWireSchema)
  if (node && typeof node === 'object') {
    return Object.fromEntries(
      Object.entries(node)
        .filter(([key]) => !WIRE_VALIDATION_KEYWORDS.has(key))
        .map(([key, value]) => [key, toWireSchema(value)])
    )
  }
  return node
}

// Provider-neutral function-calling definitions generated from the same Zod schemas.
export function getToolDefinitions(tools) {
  return tools.map((tool) => ({
    type: 'function',
    function: { name: tool.name, description: tool.description, parameters: toWireSchema(z.toJSONSchema(tool.schema)) },
  }))
}
