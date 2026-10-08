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
