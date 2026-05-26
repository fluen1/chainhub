export interface ToolDefinition {
  name: string
  description: string
  parameters: Record<string, unknown>
  requiresConfirmation: boolean
  execute: (params: Record<string, unknown>, context: ToolContext) => Promise<ToolResult>
}

export interface ToolContext {
  organizationId: string
  userId: string
}

export interface ToolResult {
  success: boolean
  data: unknown
  displayText: string
}
