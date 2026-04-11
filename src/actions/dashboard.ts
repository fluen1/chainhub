'use server'

import { prisma } from '@/lib/db'
import { getAccessibleCompanies } from '@/lib/permissions'
import type {
  InlineKpi,
  SidebarBadge,
} from '@/types/ui'

// ---------------------------------------------------------------
// Typer
// ---------------------------------------------------------------
export type TimelineColor = 'red' | 'amber' | 'blue' | 'purple' | 'green' | 'gray'

export interface TimelineItem {
  id: string
  letter: string
  color: TimelineColor
  title: string
  subtitle: string
  aiExtracted?: boolean
  time: string
  href: string
}

export interface TimelineSectionData {
  id: 'overdue' | 'today' | 'thisweek' | 'nextweek'
  label: string
  dotType: 'overdue' | 'today' | 'future'
  items: TimelineItem[]
}

export interface HeatmapCompany {
  id: string
  name: string
  healthStatus: 'healthy' | 'warning' | 'critical'
  openCaseCount: number
}

export interface CoverageItem {
  label: string
  pct: number
}

export interface PortfolioTotals {
  totalOmsaetning: number
  totalEbitda: number
  avgEbitdaMargin: number
}

export interface DashboardData {
  badges: Record<string, SidebarBadge | null>
  inlineKpis: InlineKpi[]
  timelineSections: TimelineSectionData[]
  heatmap: HeatmapCompany[]
  coverage: CoverageItem[]
  portfolioTotals: PortfolioTotals
  underperformingCount: number
  role: string
}

// ---------------------------------------------------------------
// Hoved-aggregator — én query-parallel batch
// ---------------------------------------------------------------
export async function getDashboardData(
  userId: string,
  organizationId: string
): Promise<DashboardData> {
  const [companyIds, roleRows] = await Promise.all([
    getAccessibleCompanies(userId, organizationId),
    prisma.userRoleAssignment.findMany({
      where: { user_id: userId, organization_id: organizationId },
      select: { role: true },
    }),
  ])

  // Vælg rolle med højeste prioritet (deterministisk)
  const ROLE_PRIORITY: Record<string, number> = {
    GROUP_OWNER: 100,
    GROUP_ADMIN: 90,
    GROUP_LEGAL: 80,
    GROUP_FINANCE: 80,
    GROUP_READONLY: 70,
    COMPANY_MANAGER: 60,
    COMPANY_LEGAL: 50,
    COMPANY_READONLY: 40,
  }

  const role =
    roleRows.length > 0
      ? [...roleRows].sort(
          (a, b) => (ROLE_PRIORITY[b.role] ?? 0) - (ROLE_PRIORITY[a.role] ?? 0)
        )[0].role
      : 'GROUP_READONLY'
  const today = new Date()
  const weekEnd = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  const twoWeekEnd = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)

  if (companyIds.length === 0) {
    return emptyDashboardData(role)
  }

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
    // Forfaldne opgaver (overdue section) — ingen `company` relation på Task
    prisma.task.findMany({
      where: {
        organization_id: organizationId,
        deleted_at: null,
        status: { not: 'LUKKET' },
        due_date: { lt: today },
        company_id: { in: companyIds },
      },
      orderBy: { due_date: 'asc' },
      take: 10,
      select: { id: true, title: true, due_date: true, company_id: true },
    }),

    // Opgaver i dag + denne/næste uge
    prisma.task.findMany({
      where: {
        organization_id: organizationId,
        deleted_at: null,
        status: { not: 'LUKKET' },
        due_date: { gte: today, lte: twoWeekEnd },
        company_id: { in: companyIds },
      },
      orderBy: { due_date: 'asc' },
      take: 20,
      select: { id: true, title: true, due_date: true, company_id: true },
    }),

    // Udløbende kontrakter (næste 14 dage, ikke allerede udløbet)
    prisma.contract.findMany({
      where: {
        organization_id: organizationId,
        company_id: { in: companyIds },
        deleted_at: null,
        status: 'AKTIV',
        expiry_date: { not: null, gte: today, lte: twoWeekEnd },
      },
      orderBy: { expiry_date: 'asc' },
      take: 20,
      include: { company: { select: { id: true, name: true } } },
    }),

    // Allerede udløbne kontrakter (til overdue timeline-sektionen)
    prisma.contract.findMany({
      where: {
        organization_id: organizationId,
        company_id: { in: companyIds },
        deleted_at: null,
        status: 'AKTIV',
        expiry_date: { not: null, lt: today },
      },
      orderBy: { expiry_date: 'desc' },
      take: 5,
      include: { company: { select: { id: true, name: true } } },
    }),

    // Åbne sager — bruger `case_companies` (ikke `companies`)
    // Scope: kun sager tilknyttet selskaber brugeren har adgang til
    prisma.case.findMany({
      where: {
        organization_id: organizationId,
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

    // Kommende besøg
    prisma.visit.findMany({
      where: {
        organization_id: organizationId,
        deleted_at: null,
        status: 'PLANLAGT',
        visit_date: { gte: today, lte: twoWeekEnd },
      },
      orderBy: { visit_date: 'asc' },
      take: 10,
      include: { company: { select: { id: true, name: true } } },
    }),

    // Nye dokumenter (sidste 48h) — `uploaded_at` + `file_name`
    prisma.document.findMany({
      where: {
        organization_id: organizationId,
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

    // Alle accessible companies (til heatmap + contract coverage)
    // Uden _count.cases — counts bygges fra openCases i JS bagefter
    prisma.company.findMany({
      where: {
        organization_id: organizationId,
        id: { in: companyIds },
        deleted_at: null,
      },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),

    // Forfaldne opgaver grupperet per selskab (til heatmap urgency)
    prisma.task.groupBy({
      by: ['company_id'],
      where: {
        organization_id: organizationId,
        deleted_at: null,
        status: { not: 'LUKKET' },
        due_date: { lt: today },
        company_id: { in: companyIds },
      },
      _count: true,
    }),

    // Kontrakter med system_type for coverage-matrix
    prisma.contract.findMany({
      where: {
        organization_id: organizationId,
        company_id: { in: companyIds },
        deleted_at: null,
        status: 'AKTIV',
      },
      select: { company_id: true, system_type: true },
    }),

    // Financial totals (2025) — period_type er HELAAR, ikke AAR
    prisma.financialMetric.findMany({
      where: {
        organization_id: organizationId,
        company_id: { in: companyIds },
        period_year: 2025,
        period_type: 'HELAAR',
        metric_type: { in: ['OMSAETNING', 'EBITDA'] },
      },
      select: { company_id: true, metric_type: true, value: true },
    }),

    // Badge-counts
    prisma.task.count({
      where: {
        organization_id: organizationId,
        deleted_at: null,
        status: { not: 'LUKKET' },
        due_date: { lt: today },
        company_id: { in: companyIds },
      },
    }),
    prisma.document.count({
      where: {
        organization_id: organizationId,
        deleted_at: null,
        company_id: { in: companyIds },
      },
    }),
    prisma.person.count({
      where: { organization_id: organizationId, deleted_at: null },
    }),
  ])

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
    calendar: upcomingVisits.length > 0 ? { count: upcomingVisits.length, urgency: 'neutral' } : null,
    portfolio: companies.length > 0 ? { count: companies.length, urgency: 'neutral' } : null,
    contracts: expiringContracts.length > 0 ? { count: expiringContracts.length, urgency: 'critical' } : null,
    cases: openCases.length > 0 ? { count: openCases.length, urgency: 'neutral' } : null,
    tasks: overdueTasksCount > 0 ? { count: overdueTasksCount, urgency: 'critical' } : null,
    documents: documentsCount > 0 ? { count: documentsCount, urgency: 'neutral' } : null,
    persons: personsCount > 0 ? { count: personsCount, urgency: 'neutral' } : null,
  }

  // Byg inline KPIs (role-adaptiv)
  const omsaetningTotal = sumMetric(financialMetrics, 'OMSAETNING')
  const ebitdaTotal = sumMetric(financialMetrics, 'EBITDA')
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
    { type: 'EJERAFTALE', label: 'Ejeraftale' },
    { type: 'LEJEKONTRAKT_ERHVERV', label: 'Lejekontrakt' },
    { type: 'FORSIKRING', label: 'Forsikring' },
    { type: 'ANSAETTELSE_FUNKTIONAER', label: 'Ansættelse' },
  ]
  const totalCompanies = companies.length || 1
  const coverage: CoverageItem[] = REQUIRED_TYPES.map((req) => {
    const companiesWithType = new Set(
      contractCoverageRaw.filter((c) => c.system_type === req.type).map((c) => c.company_id)
    )
    return { label: req.label, pct: Math.round((companiesWithType.size / totalCompanies) * 100) }
  })

  // Underperforming = companies with EBITDA < 0 in 2025
  const ebitdaByCompany = new Map<string, number>()
  for (const fm of financialMetrics) {
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

// ---------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------

function sumMetric(
  rows: Array<{ metric_type: string; value: { toString(): string } | number }>,
  type: string
): number {
  let sum = 0
  for (const row of rows) {
    if (row.metric_type === type) {
      sum += Number(row.value)
    }
  }
  return sum
}

function deriveHealth(openCases: number, overdueTasks: number): 'healthy' | 'warning' | 'critical' {
  if (overdueTasks > 0) return 'critical'
  if (openCases > 0) return 'warning'
  return 'healthy'
}

function formatMio(val: number): string {
  return (val / 1_000_000).toFixed(1)
}

function buildInlineKpis(
  role: string,
  data: {
    companiesCount: number
    expiringCount: number
    openCasesCount: number
    overdueCount: number
    omsaetningTotal: number
    ebitdaTotal: number
    margin: number
  }
): InlineKpi[] {
  if (role === 'GROUP_LEGAL') {
    return [
      { label: 'Udløbende', value: String(data.expiringCount), color: data.expiringCount > 0 ? 'amber' : undefined },
      { label: 'Sager', value: String(data.openCasesCount) },
      { label: 'Forfaldne', value: String(data.overdueCount), color: data.overdueCount > 0 ? 'red' : undefined },
    ]
  }
  if (role === 'GROUP_FINANCE') {
    return [
      { label: 'Omsætning', value: `${formatMio(data.omsaetningTotal)}m` },
      { label: 'EBITDA', value: `${formatMio(data.ebitdaTotal)}m` },
      { label: 'Margin', value: `${(data.margin * 100).toFixed(1)}%` },
      { label: 'Forfaldne', value: String(data.overdueCount), color: data.overdueCount > 0 ? 'red' : undefined },
    ]
  }
  // GROUP_OWNER and default
  return [
    { label: 'Selskaber', value: String(data.companiesCount) },
    { label: 'Udløbende', value: String(data.expiringCount), color: data.expiringCount > 0 ? 'amber' : undefined },
    { label: 'Sager', value: String(data.openCasesCount) },
    { label: 'Forfaldne', value: String(data.overdueCount), color: data.overdueCount > 0 ? 'red' : undefined },
  ]
}

function firstLetter(name: string | null | undefined): string {
  return (name ?? '?').charAt(0).toUpperCase()
}

function relativeDays(from: Date, to: Date): number {
  return Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24))
}

interface TimelineRawData {
  overdueTasks: Array<{ id: string; title: string; due_date: Date | null; company_id: string | null }>
  todayAndFutureTasks: Array<{ id: string; title: string; due_date: Date | null; company_id: string | null }>
  expiringContracts: Array<{
    id: string
    display_name: string
    expiry_date: Date | null
    company: { id: string; name: string }
  }>
  expiredContracts: Array<{
    id: string
    display_name: string
    expiry_date: Date | null
    company: { id: string; name: string }
  }>
  openCases: Array<{
    id: string
    title: string
    status: string
    case_companies: Array<{ company: { id: string; name: string } }>
  }>
  upcomingVisits: Array<{
    id: string
    visit_date: Date
    visit_type: string
    company: { id: string; name: string }
  }>
  recentDocuments: Array<{
    id: string
    file_name: string
    company_id: string | null
    company: { id: string; name: string } | null
    extraction: { extraction_status: string } | null
  }>
  companyMap: Map<string, { id: string; name: string }>
  today: Date
  weekEnd: Date
}

function buildTimelineSections(data: TimelineRawData): TimelineSectionData[] {
  const {
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
  } = data

  // Overdue
  const overdueItems: TimelineItem[] = []
  for (const t of overdueTasks.slice(0, 5)) {
    const company = companyMap.get(t.company_id ?? '') ?? null
    const days = Math.abs(relativeDays(today, t.due_date ?? today))
    overdueItems.push({
      id: `task-${t.id}`,
      letter: firstLetter(company?.name),
      color: 'red',
      title: t.title,
      subtitle: company ? `${company.name} · ${days}d over frist` : `${days}d over frist`,
      time: `${days}d over`,
      href: '/tasks',
    })
  }
  for (const c of expiredContracts.slice(0, 3)) {
    overdueItems.push({
      id: `contract-${c.id}`,
      letter: firstLetter(c.company.name),
      color: 'amber',
      title: c.display_name,
      subtitle: `${c.company.name} · udløbet`,
      time: 'Udløbet',
      href: `/contracts/${c.id}`,
    })
  }

  // Today
  const todayItems: TimelineItem[] = []
  const todayStart = new Date(today)
  todayStart.setHours(0, 0, 0, 0)
  const todayEnd = new Date(today)
  todayEnd.setHours(23, 59, 59, 999)

  for (const v of upcomingVisits.filter((v) => v.visit_date >= todayStart && v.visit_date <= todayEnd).slice(0, 5)) {
    const time = v.visit_date.toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' })
    todayItems.push({
      id: `visit-${v.id}`,
      letter: firstLetter(v.company.name),
      color: 'blue',
      title: `Besøg — ${v.company.name}`,
      subtitle: v.visit_type.toLowerCase(),
      time,
      href: `/companies/${v.company.id}`,
    })
  }
  for (const t of todayAndFutureTasks
    .filter((t) => t.due_date && t.due_date >= todayStart && t.due_date <= todayEnd)
    .slice(0, 3)) {
    const company = companyMap.get(t.company_id ?? '') ?? null
    todayItems.push({
      id: `task-today-${t.id}`,
      letter: firstLetter(company?.name),
      color: 'amber',
      title: t.title,
      subtitle: company ? `${company.name} · Frist i dag` : 'Frist i dag',
      time: 'Frist',
      href: '/tasks',
    })
  }
  for (const d of recentDocuments.slice(0, 2)) {
    todayItems.push({
      id: `doc-${d.id}`,
      letter: firstLetter(d.company?.name),
      color: 'purple',
      title: d.file_name,
      subtitle: d.company ? `${d.company.name} · Uploadet` : 'Uploadet',
      aiExtracted: d.extraction !== null,
      time: 'Ny',
      href: '/documents',
    })
  }

  // This week (dag efter i dag → weekEnd)
  const thisweekItems: TimelineItem[] = []
  for (const v of upcomingVisits.filter((v) => v.visit_date > todayEnd && v.visit_date <= weekEnd).slice(0, 3)) {
    thisweekItems.push({
      id: `visit-week-${v.id}`,
      letter: firstLetter(v.company.name),
      color: 'blue',
      title: `Besøg — ${v.company.name}`,
      subtitle: v.visit_type.toLowerCase(),
      time: v.visit_date.toLocaleDateString('da-DK', { day: 'numeric', month: 'short' }),
      href: `/companies/${v.company.id}`,
    })
  }
  for (const c of expiringContracts
    .filter((c) => c.expiry_date && c.expiry_date > todayEnd && c.expiry_date <= weekEnd)
    .slice(0, 3)) {
    thisweekItems.push({
      id: `contract-week-${c.id}`,
      letter: firstLetter(c.company.name),
      color: 'amber',
      title: c.display_name,
      subtitle: `${c.company.name} · udløber`,
      time: c.expiry_date!.toLocaleDateString('da-DK', { day: 'numeric', month: 'short' }),
      href: `/contracts/${c.id}`,
    })
  }

  // Next week (weekEnd → +7 days)
  const nextweekItems: TimelineItem[] = []
  for (const c of expiringContracts.filter((c) => c.expiry_date && c.expiry_date > weekEnd).slice(0, 3)) {
    nextweekItems.push({
      id: `contract-next-${c.id}`,
      letter: firstLetter(c.company.name),
      color: 'green',
      title: c.display_name,
      subtitle: `${c.company.name} · udløber`,
      time: c.expiry_date!.toLocaleDateString('da-DK', { day: 'numeric', month: 'short' }),
      href: `/contracts/${c.id}`,
    })
  }
  for (const ca of openCases.slice(0, 2)) {
    const firstCompany = ca.case_companies[0]?.company
    nextweekItems.push({
      id: `case-${ca.id}`,
      letter: firstLetter(firstCompany?.name),
      color: 'purple',
      title: ca.title,
      subtitle: firstCompany?.name ?? 'Sag',
      time: 'Aktiv',
      href: `/cases/${ca.id}`,
    })
  }

  return [
    { id: 'overdue', label: 'Overskredet', dotType: 'overdue', items: overdueItems },
    { id: 'today', label: 'I dag', dotType: 'today', items: todayItems },
    { id: 'thisweek', label: 'Denne uge', dotType: 'future', items: thisweekItems },
    { id: 'nextweek', label: 'Næste uge', dotType: 'future', items: nextweekItems },
  ]
}

function emptyDashboardData(role: string): DashboardData {
  return {
    badges: {},
    inlineKpis: [
      { label: 'Selskaber', value: '0' },
      { label: 'Sager', value: '0' },
      { label: 'Forfaldne', value: '0' },
    ],
    timelineSections: [
      { id: 'overdue', label: 'Overskredet', dotType: 'overdue', items: [] },
      { id: 'today', label: 'I dag', dotType: 'today', items: [] },
      { id: 'thisweek', label: 'Denne uge', dotType: 'future', items: [] },
      { id: 'nextweek', label: 'Næste uge', dotType: 'future', items: [] },
    ],
    heatmap: [],
    coverage: [
      { label: 'Ejeraftale', pct: 0 },
      { label: 'Lejekontrakt', pct: 0 },
      { label: 'Forsikring', pct: 0 },
      { label: 'Ansættelse', pct: 0 },
    ],
    portfolioTotals: { totalOmsaetning: 0, totalEbitda: 0, avgEbitdaMargin: 0 },
    underperformingCount: 0,
    role,
  }
}
