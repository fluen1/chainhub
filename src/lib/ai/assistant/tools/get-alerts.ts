import { prisma } from '@/lib/db'
import type { ToolDefinition, ToolContext, ToolResult } from './types'

export const getAlertsTool: ToolDefinition = {
  name: 'get_alerts',
  description:
    'Hent aktive advarsler og notifikationer for organisationen. Kan filtrere på alvorlighed og kategori.',
  parameters: {
    type: 'object',
    properties: {
      severity: {
        type: 'string',
        description: 'Filtrer på alvorlighed: CRITICAL, WARNING, INFO',
      },
      category: {
        type: 'string',
        description: 'Filtrer på kategori: DEADLINE, MISSING, RISK, COMPLIANCE',
      },
    },
    required: [],
  },
  requiresConfirmation: false,
  async execute(params: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    const { organizationId } = context
    const severity = typeof params.severity === 'string' ? params.severity : undefined
    const category = typeof params.category === 'string' ? params.category : undefined

    const alerts = await prisma.alert.findMany({
      where: {
        organization_id: organizationId,
        dismissed_at: null,
        ...(severity ? { severity: severity as never } : {}),
        ...(category ? { category: category as never } : {}),
      },
      orderBy: [{ severity: 'asc' }, { created_at: 'desc' }],
      take: 30,
    })

    if (alerts.length === 0) {
      return {
        success: true,
        data: [],
        displayText: 'Ingen aktive advarsler fundet.',
      }
    }

    const severityEmoji: Record<string, string> = {
      CRITICAL: '🔴',
      WARNING: '🟡',
      INFO: '🔵',
    }

    const lines = alerts.map((a) => {
      const emoji = severityEmoji[a.severity] ?? '⚪'
      return `- ${emoji} **${a.entity_name}** — ${a.message} (${a.category})`
    })

    return {
      success: true,
      data: alerts.map((a) => ({
        id: a.id,
        severity: a.severity,
        category: a.category,
        entityType: a.entity_type,
        entityId: a.entity_id,
        entityName: a.entity_name,
        message: a.message,
        createdAt: a.created_at.toISOString(),
      })),
      displayText: `Fandt ${alerts.length} aktiv${alerts.length === 1 ? '' : 'e'} advarsel${alerts.length === 1 ? '' : 'er'}:\n${lines.join('\n')}`,
    }
  },
}
