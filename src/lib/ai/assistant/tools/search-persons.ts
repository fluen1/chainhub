import { prisma } from '@/lib/db'
import type { ToolDefinition, ToolContext, ToolResult } from './types'

export const searchPersonsTool: ToolDefinition = {
  name: 'search_persons',
  description:
    'Søg i organisationens persondatabase. Fritekst-søgning på fornavn, efternavn og email.',
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Fritekst-søgning i fornavn, efternavn eller email',
      },
    },
    required: [],
  },
  requiresConfirmation: false,
  async execute(params: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    const { organizationId } = context
    const query = typeof params.query === 'string' ? params.query : undefined

    const persons = await prisma.person.findMany({
      where: {
        organization_id: organizationId,
        deleted_at: null,
        ...(query
          ? {
              OR: [
                { first_name: { contains: query, mode: 'insensitive' } },
                { last_name: { contains: query, mode: 'insensitive' } },
                { email: { contains: query, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      include: {
        company_persons: {
          where: { deleted_at: null },
          include: { company: { select: { id: true, name: true } } },
          take: 3,
        },
      },
      orderBy: [{ last_name: 'asc' }, { first_name: 'asc' }],
      take: 20,
    })

    if (persons.length === 0) {
      return {
        success: true,
        data: [],
        displayText: 'Ingen personer fundet med de angivne kriterier.',
      }
    }

    const lines = persons.map((p) => {
      const email = p.email ? ` <${p.email}>` : ''
      const companies = p.company_persons.map((cp) => cp.company.name).join(', ')
      const companyStr = companies ? ` — ${companies}` : ''
      return `- **${p.first_name} ${p.last_name}**${email}${companyStr}`
    })

    return {
      success: true,
      data: persons.map((p) => ({
        id: p.id,
        firstName: p.first_name,
        lastName: p.last_name,
        email: p.email,
        phone: p.phone,
        companies: p.company_persons.map((cp) => ({ id: cp.company.id, name: cp.company.name })),
      })),
      displayText: `Fandt ${persons.length} person${persons.length === 1 ? '' : 'er'}:\n${lines.join('\n')}`,
    }
  },
}
