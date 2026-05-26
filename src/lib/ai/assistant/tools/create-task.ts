import type { ToolDefinition, ToolContext, ToolResult } from './types'

export const createTaskTool: ToolDefinition = {
  name: 'create_task',
  description: 'Opret en ny opgave. Kræver brugerbekræftelse før udførelse.',
  parameters: {
    type: 'object',
    properties: {
      title: {
        type: 'string',
        description: 'Opgavens titel (påkrævet)',
      },
      description: {
        type: 'string',
        description: 'Opgavebeskrivelse (valgfri)',
      },
      company_id: {
        type: 'string',
        description: 'ID på det tilknyttede selskab (valgfrit)',
      },
      due_date: {
        type: 'string',
        description: 'Forfaldsdato i ISO 8601-format (valgfri), fx "2026-06-15"',
      },
      priority: {
        type: 'string',
        enum: ['HOJ', 'MELLEM', 'LAV'],
        description: 'Prioritet: HOJ, MELLEM eller LAV. Standard: MELLEM',
      },
    },
    required: ['title'],
  },
  requiresConfirmation: true,
  async execute(params: Record<string, unknown>, _context: ToolContext): Promise<ToolResult> {
    // Den faktiske oprettelse sker via PendingAction-bekræftelsesflow.
    // execute() kaldes ikke direkte for write-tools — returnerer params som preview.
    const title = String(params.title ?? '')
    const dueDate = typeof params.due_date === 'string' ? params.due_date : undefined
    const priority = typeof params.priority === 'string' ? params.priority : 'MELLEM'

    const lines = [`**Titel:** ${title}`]
    if (params.description) lines.push(`**Beskrivelse:** ${params.description}`)
    if (dueDate) lines.push(`**Forfaldsdato:** ${dueDate}`)
    lines.push(`**Prioritet:** ${priority}`)

    return {
      success: true,
      data: params,
      displayText: `Vil du oprette følgende opgave?\n${lines.join('\n')}`,
    }
  },
}
