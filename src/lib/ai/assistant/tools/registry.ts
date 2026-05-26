import type { ToolDefinition } from './types'
import { searchContractsTool } from './search-contracts'
import { searchCompaniesTool } from './search-companies'
import { searchPersonsTool } from './search-persons'
import { getAlertsTool } from './get-alerts'
import { generateReportTool } from './generate-report'
import { createTaskTool } from './create-task'
import { createCaseTool } from './create-case'
import { createReminderTool } from './create-reminder'

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
