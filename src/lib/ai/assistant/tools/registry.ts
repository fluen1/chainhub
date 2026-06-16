import { createCaseTool } from './create-case'
import { createReminderTool } from './create-reminder'
import { createTaskTool } from './create-task'
import { generateReportTool } from './generate-report'
import { getAlertsTool } from './get-alerts'
import { searchCompaniesTool } from './search-companies'
import { searchContractsTool } from './search-contracts'
import { searchPersonsTool } from './search-persons'
import type { ToolDefinition } from './types'

export const toolRegistry: Map<string, ToolDefinition> = new Map([
  [searchContractsTool.name, searchContractsTool],
  [searchCompaniesTool.name, searchCompaniesTool],
  [searchPersonsTool.name, searchPersonsTool],
  [getAlertsTool.name, getAlertsTool],
  [generateReportTool.name, generateReportTool],
  [createTaskTool.name, createTaskTool],
  [createCaseTool.name, createCaseTool],
  [createReminderTool.name, createReminderTool],
])

export function getToolDefinitions(): Array<{
  name: string
  description: string
  parameters: Record<string, unknown>
}> {
  return Array.from(toolRegistry.values()).map((tool) => ({
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters,
  }))
}
