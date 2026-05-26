import type { ToolDefinition, ToolContext, ToolResult } from './types'

export const createCaseTool: ToolDefinition = {
  name: 'create_case',
  description: 'Opret en ny sag. Kræver brugerbekræftelse før udførelse.',
  parameters: {
    type: 'object',
    properties: {
      title: {
        type: 'string',
        description: 'Sagens titel (påkrævet)',
      },
      description: {
        type: 'string',
        description: 'Beskrivelse af sagen (valgfri)',
      },
      company_ids: {
        type: 'array',
        items: { type: 'string' },
        description: 'ID-liste på tilknyttede selskaber (valgfri)',
      },
      case_type: {
        type: 'string',
        enum: ['TRANSAKTION', 'TVIST', 'COMPLIANCE', 'KONTRAKT', 'GOVERNANCE', 'ANDET'],
        description: 'Sagstype (valgfri). Standard: ANDET',
      },
    },
    required: ['title'],
  },
  requiresConfirmation: true,
  async execute(params: Record<string, unknown>, _context: ToolContext): Promise<ToolResult> {
    // Den faktiske oprettelse sker via PendingAction-bekræftelsesflow.
    const title = String(params.title ?? '')
    const caseType = typeof params.case_type === 'string' ? params.case_type : 'ANDET'

    const lines = [`**Titel:** ${title}`]
    if (params.description) lines.push(`**Beskrivelse:** ${params.description}`)
    lines.push(`**Sagstype:** ${caseType}`)
    if (Array.isArray(params.company_ids) && params.company_ids.length > 0) {
      lines.push(`**Selskaber:** ${(params.company_ids as string[]).join(', ')}`)
    }

    return {
      success: true,
      data: params,
      displayText: `Vil du oprette følgende sag?\n${lines.join('\n')}`,
    }
  },
}
