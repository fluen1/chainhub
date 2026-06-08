'use server'

import { unstable_cache } from 'next/cache'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { reviveDates } from '@/lib/cache-dates'
import {
  buildInlineKpis,
  buildTimelineSections,
  deriveHealth,
  emptyDashboardData,
  filterLatestPerCompany,
  pickHighestPriorityRole,
  sumMetric,
  type CoverageItem,
  type DashboardData,
  type HeatmapCompany,
} from '@/lib/dashboard-helpers'
import { prisma } from '@/lib/db'
import { getContractTypeLabel } from '@/lib/labels'
import { getAccessibleCompanies, canAccessModule } from '@/lib/permissions'

// Løs UUID-validering: accepterer alle 8-4-4-4-12 hex-formater inkl. nil-UUIDs (seed-data)
const looseUuid = z
  .string()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
const dashboardSchema = z.object({
  preloadedCompanyIds: z.array(looseUuid).optional(),
})
import type { InlineKpi, SidebarBadge } from '@/types/ui'

// Typer re-eksporteres ikke herfra (Next.js 16: 'use server' filer kan ikke re-eksportere typer).
// Importér direkte fra '@/lib/dashboard-helpers' i stedet.

// ---------------------------------------------------------------
// Cached DB-batch — 60s TTL, bust via 'dashboard'-tag
// ---------------------------------------------------------------
const getCachedDashboardRawData = unstable_cache(
  async (orgId: string, companyIds: string[]) => {
    const today = new Date()
    const weekEnd = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    const twoWeekEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

    const [
      overdueTasks,
      todayAndFutureTasks,
      expiringContracts,
      expiredContracts,
      openCases,
      upcomingVisits,
      recentDocuments,
      companies,
      tasksByCompany,
      contractCoverageRaw,
      financialMetrics,
      overdueTasksCount,
      documentsCount,
      personsCount,
    ] = await Promise.all([
      prisma.task.findMany({
        where: {
          organization_id: orgId,
          deleted_at: null,
          status: { not: 'LUKKET' },
          due_date: { lt: today },
          OR: [{ company_id: { in: companyIds } }, { company_id: null }],
        },
        orderBy: { due_date: 'asc' },
        take: 15,
        select: { id: true, title: true, due_date: true, company_id: true },
      }),
      prisma.task.findMany({
        where: {
          organization_id: orgId,
          deleted_at: null,
          status: { not: 'LUKKET' },
          due_date: { gte: today, lte: twoWeekEnd },
          OR: [{ company_id: { in: companyIds } }, { company_id: null }],
        },
        orderBy: { due_date: 'asc' },
        take: 20,
        select: { id: true, title: true, due_date: true, company_id: true },
      }),
      prisma.contract.findMany({
        where: {
          organization_id: orgId,
          company_id: { in: companyIds },
          deleted_at: null,
          status: 'AKTIV',
          expiry_date: { not: null, gte: today, lte: twoWeekEnd },
        },
        orderBy: { expiry_date: 'asc' },
        take: 20,
        include: { company: { select: { id: true, name: true } } },
      }),
      prisma.contract.findMany({
        where: {
          organization_id: orgId,
          company_id: { in: companyIds },
          deleted_at: null,
          status: 'AKTIV',
          expiry_date: { not: null, lt: today },
        },
        orderBy: { expiry_date: 'desc' },
        take: 5,
        include: { company: { select: { id: true, name: true } } },
      }),
      prisma.case.findMany({
        where: {
          organization_id: orgId,
          deleted_at: null,
          status: { in: ['NY', 'AKTIV', 'AFVENTER_EKSTERN', 'AFVENTER_KLIENT'] },
          case_companies: { some: { company_id: { in: companyIds } } },
        },
        orderBy: { updated_at: 'desc' },
        take: 20,
        include: {
          case_companies: {
            include: { company: { select: { id: true, name: true } } },
            take: 1,
          },
        },
      }),
      prisma.visit.findMany({
        where: {
          organization_id: orgId,
          deleted_at: null,
          status: 'PLANLAGT',
          visit_date: { gte: today, lte: twoWeekEnd },
        },
        orderBy: { visit_date: 'asc' },
        take: 10,
        include: { company: { select: { id: true, name: true } } },
      }),
      prisma.document.findMany({
        where: {
          organization_id: orgId,
          deleted_at: null,
          uploaded_at: { gte: new Date(Date.now() - 48 * 60 * 60 * 1000) },
        },
        orderBy: { uploaded_at: 'desc' },
        take: 10,
        include: {
          company: { select: { id: true, name: true } },
          extraction: { select: { extraction_status: true } },
        },
      }),
      prisma.company.findMany({
        where: { organization_id: orgId, id: { in: companyIds }, deleted_at: null },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      }),
      prisma.task.groupBy({
        by: ['company_id'],
        where: {
          organization_id: orgId,
          deleted_at: null,
          status: { not: 'LUKKET' },
          due_date: { lt: today },
          company_id: { in: companyIds },
        },
        _count: true,
      }),
      prisma.contract.findMany({
        where: {
          organization_id: orgId,
          company_id: { in: companyIds },
          deleted_at: null,
          status: 'AKTIV',
        },
        select: { company_id: true, system_type: true },
      }),
      prisma.financialMetric.findMany({
        where: {
          organization_id: orgId,
          company_id: { in: companyIds },
          period_type: 'HELAAR',
          metric_type: { in: ['OMSAETNING', 'EBITDA'] },
        },
        orderBy: { period_year: 'desc' },
        select: { company_id: true, metric_type: true, value: true, period_year: true },
      }),
      prisma.task.count({
        where: {
          organization_id: orgId,
          deleted_at: null,
          status: { not: 'LUKKET' },
          due_date: { lt: today },
          OR: [{ company_id: { in: companyIds } }, { company_id: null }],
        },
      }),
      prisma.document.count({
        where: {
          organization_id: orgId,
          deleted_at: null,
          OR: [{ company_id: { in: companyIds } }, { company_id: null }],
        },
      }),
      prisma.person.count({
        where: {
          organization_id: orgId,
          deleted_at: null,
          OR: [
            { company_persons: { some: { company_id: { in: companyIds } } } },
            { company_persons: { none: {} } },
          ],
        },
      }),
    ])

    return {
      overdueTasks,
      todayAndFutureTasks,
      expiringContracts,
      expiredContracts,
      openCases,
      upcomingVisits,
      recentDocuments,
      companies,
      tasksByCompany,
      contractCoverageRaw,
      financialMetrics,
      overdueTasksCount,
      documentsCount,
      personsCount,
      today,
      weekEnd,
    }
  },
  ['dashboard-raw'],
  { revalidate: 60, tags: ['dashboard'] }
)

// ---------------------------------------------------------------
// Hoved-aggregator — én query-parallel batch
// ---------------------------------------------------------------
export async function getDashboardData(preloadedCompanyIds?: string[]): Promise<DashboardData> {
  const session = await auth()
  if (!session) return emptyDashboardData('GROUP_READONLY')

  const parsed = dashboardSchema.safeParse({ preloadedCompanyIds })
  if (!parsed.success) return emptyDashboardData('GROUP_READONLY')

  const userId = session.user.id
  const organizationId = session.user.organizationId

  const hasModuleAccess = await canAccessModule(userId, 'companies', organizationId)
  if (!hasModuleAccess) return emptyDashboardData('GROUP_READONLY')

  const [companyIds, roleRows] = await Promise.all([
    parsed.data.preloadedCompanyIds !== undefined
      ? Promise.resolve(parsed.data.preloadedCompanyIds)
      : getAccessibleCompanies(userId, organizationId),
    prisma.userRoleAssignment.findMany({
      where: { user_id: userId, organization_id: organizationId },
      select: { role: true },
    }),
  ])

  const role = pickHighestPriorityRole(roleRows)

  if (companyIds.length === 0) {
    return emptyDashboardData(role)
  }

  const {
    overdueTasks,
    todayAndFutureTasks,
    expiringContracts,
    expiredContracts,
    openCases,
    upcomingVisits,
    recentDocuments,
    companies,
    tasksByCompany,
    contractCoverageRaw,
    financialMetrics,
    overdueTasksCount,
    documentsCount,
    personsCount,
    today,
    weekEnd,
  } = reviveDates(await getCachedDashboardRawData(organizationId, companyIds))

  // DB-data er nu hentet via getCachedDashboardRawData ovenfor.

  // Byg company map (erstatter den manglende Task.company relation)
  const companyMap = new Map(companies.map((c) => [c.id, c]))

  // Byg åbne-sager-per-selskab map (erstatter c._count.cases)
  const openCasesByCompany = new Map<string, number>()
  for (const ca of openCases) {
    for (const cc of ca.case_companies) {
      const prev = openCasesByCompany.get(cc.company.id) ?? 0
      openCasesByCompany.set(cc.company.id, prev + 1)
    }
  }

  // Byg badges
  const badges: Record<string, SidebarBadge | null> = {
    dashboard: null,
    calendar:
      upcomingVisits.length > 0 ? { count: upcomingVisits.length, urgency: 'neutral' } : null,
    portfolio: companies.length > 0 ? { count: companies.length, urgency: 'neutral' } : null,
    contracts:
      expiringContracts.length > 0
        ? { count: expiringContracts.length, urgency: 'critical' }
        : null,
    cases: openCases.length > 0 ? { count: openCases.length, urgency: 'neutral' } : null,
    tasks: overdueTasksCount > 0 ? { count: overdueTasksCount, urgency: 'critical' } : null,
    documents: documentsCount > 0 ? { count: documentsCount, urgency: 'neutral' } : null,
    persons: personsCount > 0 ? { count: personsCount, urgency: 'neutral' } : null,
  }

  // Byg inline KPIs (role-adaptiv)
  // Filtrer til seneste år pr. selskab (data er sorteret desc på period_year)
  const latestMetrics = filterLatestPerCompany(financialMetrics)
  const omsaetningTotal = sumMetric(latestMetrics, 'OMSAETNING')
  const ebitdaTotal = sumMetric(latestMetrics, 'EBITDA')
  const margin = omsaetningTotal > 0 ? ebitdaTotal / omsaetningTotal : 0

  const inlineKpis: InlineKpi[] = buildInlineKpis(role, {
    companiesCount: companies.length,
    expiringCount: expiringContracts.length,
    openCasesCount: openCases.length,
    overdueCount: overdueTasksCount,
    omsaetningTotal,
    ebitdaTotal,
    margin,
  })

  // Byg timeline sections
  const timelineSections = buildTimelineSections({
    overdueTasks,
    todayAndFutureTasks,
    expiringContracts,
    expiredContracts,
    openCases,
    upcomingVisits,
    recentDocuments,
    companyMap,
    today,
    weekEnd,
  })

  // Byg heatmap
  const overdueByCompany = new Map<string, number>()
  for (const row of tasksByCompany) {
    if (row.company_id) overdueByCompany.set(row.company_id, row._count)
  }
  const heatmap: HeatmapCompany[] = companies.map((c) => {
    const openCaseCount = openCasesByCompany.get(c.id) ?? 0
    return {
      id: c.id,
      name: c.name,
      healthStatus: deriveHealth(openCaseCount, overdueByCompany.get(c.id) ?? 0),
      openCaseCount,
    }
  })

  // Byg contract coverage
  const REQUIRED_TYPES: Array<{
    type: 'EJERAFTALE' | 'LEJEKONTRAKT_ERHVERV' | 'FORSIKRING' | 'ANSAETTELSE_FUNKTIONAER'
    label: string
  }> = [
    { type: 'EJERAFTALE', label: getContractTypeLabel('EJERAFTALE') },
    { type: 'LEJEKONTRAKT_ERHVERV', label: getContractTypeLabel('LEJEKONTRAKT_ERHVERV') },
    { type: 'FORSIKRING', label: getContractTypeLabel('FORSIKRING') },
    { type: 'ANSAETTELSE_FUNKTIONAER', label: getContractTypeLabel('ANSAETTELSE_FUNKTIONAER') },
  ]
  const totalCompanies = companies.length || 1
  const coverage: CoverageItem[] = REQUIRED_TYPES.map((req) => {
    const companiesWithType = new Set(
      contractCoverageRaw.filter((c) => c.system_type === req.type).map((c) => c.company_id)
    )
    return { label: req.label, pct: Math.round((companiesWithType.size / totalCompanies) * 100) }
  })

  // Underperforming = companies with EBITDA < 0 (seneste år)
  const ebitdaByCompany = new Map<string, number>()
  for (const fm of latestMetrics) {
    if (fm.metric_type === 'EBITDA') {
      ebitdaByCompany.set(fm.company_id, Number(fm.value))
    }
  }
  const underperformingIds = new Set<string>()
  ebitdaByCompany.forEach((value, cid) => {
    if (value < 0) underperformingIds.add(cid)
  })

  return {
    badges,
    inlineKpis,
    timelineSections,
    heatmap,
    coverage,
    portfolioTotals: {
      totalOmsaetning: omsaetningTotal,
      totalEbitda: ebitdaTotal,
      avgEbitdaMargin: margin,
    },
    underperformingCount: underperformingIds.size,
    role,
  }
}
