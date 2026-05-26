import { prisma } from '@/lib/db'
import type { ToolDefinition, ToolContext, ToolResult } from './types'

export const generateReportTool: ToolDefinition = {
  name: 'generate_report',
  description:
    'Generer en rapport over et enkelt selskab eller hele porteføljen. Rapport-typer: summary (overblik), due_diligence (due diligence-status), risk (risikovurdering).',
  parameters: {
    type: 'object',
    properties: {
      company_id: {
        type: 'string',
        description: 'ID på det selskab rapporten drejer sig om. Udelad for porteføljeoversigt.',
      },
      report_type: {
        type: 'string',
        enum: ['summary', 'due_diligence', 'risk'],
        description: 'Type af rapport. Standard: summary',
      },
    },
    required: [],
  },
  requiresConfirmation: false,
  async execute(params: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    const { organizationId } = context
    const companyId = typeof params.company_id === 'string' ? params.company_id : undefined
    const reportType = typeof params.report_type === 'string' ? params.report_type : 'summary'

    if (companyId) {
      return generateCompanyReport(organizationId, companyId, reportType)
    }
    return generatePortfolioReport(organizationId, reportType)
  },
}

async function generateCompanyReport(
  organizationId: string,
  companyId: string,
  reportType: string
): Promise<ToolResult> {
  const company = await prisma.company.findFirst({
    where: { id: companyId, organization_id: organizationId, deleted_at: null },
    include: {
      _count: {
        select: {
          contracts: { where: { deleted_at: null } },
          documents: { where: { deleted_at: null } },
          company_persons: { where: { deleted_at: null } },
        },
      },
    },
  })

  if (!company) {
    return {
      success: false,
      data: null,
      displayText: 'Selskabet blev ikke fundet eller du har ikke adgang.',
    }
  }

  const activeContracts = await prisma.contract.count({
    where: {
      organization_id: organizationId,
      company_id: companyId,
      status: 'AKTIV',
      deleted_at: null,
    },
  })

  const expiringSoon = await prisma.contract.count({
    where: {
      organization_id: organizationId,
      company_id: companyId,
      deleted_at: null,
      expiry_date: {
        gte: new Date(),
        lte: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      },
    },
  })

  const alerts = await prisma.alert.count({
    where: { organization_id: organizationId, entity_id: companyId, dismissed_at: null },
  })

  const typeLabel: Record<string, string> = {
    summary: 'Overblik',
    due_diligence: 'Due Diligence-status',
    risk: 'Risikovurdering',
  }

  const md = [
    `## ${typeLabel[reportType] ?? 'Rapport'}: ${company.name}`,
    `**CVR:** ${company.cvr ?? '—'} | **Status:** ${company.status} | **By:** ${company.city ?? '—'}`,
    '',
    '### Nøgletal',
    `- Kontrakter i alt: **${company._count.contracts}** (${activeContracts} aktive)`,
    `- Udløber inden 90 dage: **${expiringSoon}**`,
    `- Dokumenter: **${company._count.documents}**`,
    `- Tilknyttede personer: **${company._count.company_persons}**`,
    `- Aktive advarsler: **${alerts}**`,
  ]

  if (reportType === 'risk') {
    const riskLevel =
      alerts > 2 || expiringSoon > 3 ? 'HØJ' : alerts > 0 || expiringSoon > 0 ? 'MIDDEL' : 'LAV'
    md.push('', `### Risikoniveau: **${riskLevel}**`)
    if (expiringSoon > 0) md.push(`- ⚠️ ${expiringSoon} kontrakt(er) udløber inden 90 dage`)
    if (alerts > 0) md.push(`- 🔴 ${alerts} aktiv(e) advarsel(er)`)
  }

  const text = md.join('\n')
  return {
    success: true,
    data: { companyId: company.id, companyName: company.name, reportType },
    displayText: text,
  }
}

async function generatePortfolioReport(
  organizationId: string,
  reportType: string
): Promise<ToolResult> {
  const [companies, contracts, activeContracts, expiringSoon, alerts, criticalAlerts] =
    await Promise.all([
      prisma.company.count({ where: { organization_id: organizationId, deleted_at: null } }),
      prisma.contract.count({ where: { organization_id: organizationId, deleted_at: null } }),
      prisma.contract.count({
        where: { organization_id: organizationId, status: 'AKTIV', deleted_at: null },
      }),
      prisma.contract.count({
        where: {
          organization_id: organizationId,
          deleted_at: null,
          expiry_date: {
            gte: new Date(),
            lte: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
          },
        },
      }),
      prisma.alert.count({ where: { organization_id: organizationId, dismissed_at: null } }),
      prisma.alert.count({
        where: { organization_id: organizationId, dismissed_at: null, severity: 'CRITICAL' },
      }),
    ])

  const typeLabel: Record<string, string> = {
    summary: 'Porteføljeoverblik',
    due_diligence: 'Due Diligence-status — Portefølje',
    risk: 'Risikovurdering — Portefølje',
  }

  const md = [
    `## ${typeLabel[reportType] ?? 'Porteføljerapport'}`,
    '',
    '### Nøgletal',
    `- Selskaber: **${companies}**`,
    `- Kontrakter i alt: **${contracts}** (${activeContracts} aktive)`,
    `- Kontrakter der udløber inden 90 dage: **${expiringSoon}**`,
    `- Aktive advarsler: **${alerts}** (${criticalAlerts} kritiske)`,
  ]

  if (reportType === 'risk') {
    const riskLevel =
      criticalAlerts > 0 || expiringSoon > 5
        ? 'HØJ'
        : alerts > 0 || expiringSoon > 0
          ? 'MIDDEL'
          : 'LAV'
    md.push('', `### Samlet risikoniveau: **${riskLevel}**`)
  }

  const text = md.join('\n')
  return {
    success: true,
    data: { reportType, companies, contracts, alerts },
    displayText: text,
  }
}
