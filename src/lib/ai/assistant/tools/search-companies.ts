import { prisma } from '@/lib/db'
import type { ToolDefinition, ToolContext, ToolResult } from './types'

export const searchCompaniesTool: ToolDefinition = {
  name: 'search_companies',
  description:
    'Søg i organisationens selskaber. Kan filtrere på fritekst (navn eller CVR) og status.',
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Fritekst-søgning i selskabsnavn eller CVR',
      },
      status: {
        type: 'string',
        description: 'Filtrer på selskabsstatus, fx "aktiv" eller "inaktiv"',
      },
    },
    required: [],
  },
  requiresConfirmation: false,
  async execute(params: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    const { organizationId } = context
    const query = typeof params.query === 'string' ? params.query : undefined
    const status = typeof params.status === 'string' ? params.status : undefined

    const companies = await prisma.company.findMany({
      where: {
        organization_id: organizationId,
        deleted_at: null,
        ...(query
          ? {
              OR: [
                { name: { contains: query, mode: 'insensitive' } },
                { cvr: { contains: query, mode: 'insensitive' } },
              ],
            }
          : {}),
        ...(status ? { status } : {}),
      },
      orderBy: { name: 'asc' },
      take: 20,
    })

    if (companies.length === 0) {
      return {
        success: true,
        data: [],
        displayText: 'Ingen selskaber fundet med de angivne kriterier.',
      }
    }

    const lines = companies.map((c) => {
      const cvr = c.cvr ? ` (CVR: ${c.cvr})` : ''
      const city = c.city ? `, ${c.city}` : ''
      return `- **${c.name}**${cvr} — ${c.status}${city}`
    })

    return {
      success: true,
      data: companies.map((c) => ({
        id: c.id,
        name: c.name,
        cvr: c.cvr,
        status: c.status,
        city: c.city,
      })),
      displayText: `Fandt ${companies.length} selskab${companies.length === 1 ? '' : 'er'}:\n${lines.join('\n')}`,
    }
  },
}
