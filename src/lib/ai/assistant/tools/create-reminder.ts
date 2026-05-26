import type { ToolDefinition, ToolContext, ToolResult } from './types'

export const createReminderTool: ToolDefinition = {
  name: 'create_reminder',
  description: 'Opret en påmindelse. Kræver brugerbekræftelse før udførelse.',
  parameters: {
    type: 'object',
    properties: {
      title: {
        type: 'string',
        description: 'Påmindelsens titel (påkrævet)',
      },
      date: {
        type: 'string',
        description: 'Dato og tidspunkt i ISO 8601-format (påkrævet), fx "2026-06-15T09:00:00Z"',
      },
      entity_type: {
        type: 'string',
        description: 'Type af tilknyttet entitet, fx "contract", "company", "case" (valgfri)',
      },
      entity_id: {
        type: 'string',
        description: 'ID på tilknyttet entitet (valgfri)',
      },
    },
    required: ['title', 'date'],
  },
  requiresConfirmation: true,
  async execute(params: Record<string, unknown>, _context: ToolContext): Promise<ToolResult> {
    // Den faktiske oprettelse sker via PendingAction-bekræftelsesflow.
    const title = String(params.title ?? '')
    const date = String(params.date ?? '')

    const lines = [`**Titel:** ${title}`, `**Dato:** ${date}`]
    if (params.entity_type)
      lines.push(`**Tilknyttet:** ${params.entity_type} ${params.entity_id ?? ''}`)

    return {
      success: true,
      data: params,
      displayText: `Vil du oprette følgende påmindelse?\n${lines.join('\n')}`,
    }
  },
}
