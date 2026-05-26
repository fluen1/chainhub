import { prisma } from '@/lib/db'
import type { ToolDefinition, ToolContext, ToolResult } from './types'

export const searchContractsTool: ToolDefinition = {
  name: 'search_contracts',
  description:
    'Søg i organisationens kontrakter. Kan filtrere på fritekst, status og kontrakttype. Returnerer liste af matchende kontrakter.',
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Fritekst-søgning i kontraktens navn',
      },
      status: {
        type: 'string',
        description:
          'Filtrer på kontraktstatus: UDKAST, TIL_REVIEW, TIL_UNDERSKRIFT, AKTIV, UDLOBET, OPSAGT, FORNYET, ARKIVERET',
      },
      contract_type: {
        type: 'string',
        description: 'Filtrer på kontrakttype (system_type)',
      },
      expiring_within_days: {
        type: 'number',
        description: 'Vis kun kontrakter der udløber inden for dette antal dage',
      },
    },
    required: [],
  },
  requiresConfirmation: false,
  async execute(params: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    const { organizationId } = context
    const query = typeof params.query === 'string' ? params.query : undefined
    const status = typeof params.status === 'string' ? params.status : undefined
    const contractType = typeof params.contract_type === 'string' ? params.contract_type : undefined
    const expiringWithinDays =
      typeof params.expiring_within_days === 'number' ? params.expiring_within_days : undefined

    const now = new Date()
    const expiryBefore =
      expiringWithinDays != null
        ? new Date(now.getTime() + expiringWithinDays * 24 * 60 * 60 * 1000)
        : undefined

    const contracts = await prisma.contract.findMany({
      where: {
        organization_id: organizationId,
        deleted_at: null,
        ...(query ? { display_name: { contains: query, mode: 'insensitive' } } : {}),
        ...(status ? { status: status as never } : {}),
        ...(contractType ? { system_type: contractType as never } : {}),
        ...(expiryBefore ? { expiry_date: { lte: expiryBefore, gte: now } } : {}),
      },
      include: {
        company: { select: { id: true, name: true } },
      },
      orderBy: { updated_at: 'desc' },
      take: 20,
    })

    if (contracts.length === 0) {
      return {
        success: true,
        data: [],
        displayText: 'Ingen kontrakter fundet med de angivne kriterier.',
      }
    }

    const lines = contracts.map((c) => {
      const expiry = c.expiry_date
        ? `udløber ${c.expiry_date.toLocaleDateString('da-DK')}`
        : 'ingen udløbsdato'
      return `- **${c.display_name}** (${c.system_type}) — ${c.status} — ${c.company.name} — ${expiry}`
    })

    return {
      success: true,
      data: contracts.map((c) => ({
        id: c.id,
        name: c.display_name,
        type: c.system_type,
        status: c.status,
        companyId: c.company_id,
        companyName: c.company.name,
        expiryDate: c.expiry_date?.toISOString() ?? null,
      })),
      displayText: `Fandt ${contracts.length} kontrakt${contracts.length === 1 ? '' : 'er'}:\n${lines.join('\n')}`,
    }
  },
}
