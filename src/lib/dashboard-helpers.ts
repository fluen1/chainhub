/**
 * Pure helpers brugt af dashboard-orchestrator (src/actions/dashboard.ts).
 * Ingen DB-kald, ingen session-brug — kan bruges fra både server og client.
 *
 * Typer flyttet hertil så helpers kan referere dem uden cirkulær import.
 * `src/actions/dashboard.ts` re-eksporterer typerne for bagud-kompatibilitet.
 */

import { formatMio } from '@/lib/labels'
import type { InlineKpi } from '@/types/ui'

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
  badges: Record<string, import('@/types/ui').SidebarBadge | null>
  inlineKpis: InlineKpi[]
  timelineSections: TimelineSectionData[]
  heatmap: HeatmapCompany[]
  coverage: CoverageItem[]
  portfolioTotals: PortfolioTotals
  underperformingCount: number
  role: string
}

// ---------------------------------------------------------------
// Role-prioritering
// ---------------------------------------------------------------

/**
 * Prioritetsmapping brugt af `pickHighestPriorityRole`. Højere tal = højere
 * prioritet. Ikke-kendte roller får 0.
 */
export const ROLE_PRIORITY: Record<string, number> = {
  GROUP_OWNER: 100,
  GROUP_ADMIN: 90,
  GROUP_LEGAL: 80,
  GROUP_FINANCE: 80,
  GROUP_READONLY: 70,
  COMPANY_MANAGER: 60,
  COMPANY_LEGAL: 50,
  COMPANY_READONLY: 40,
}

/**
 * Vælg rolle med højeste prioritet (deterministisk). Returnerer
 * `GROUP_READONLY` som fallback hvis input er tomt.
 */
export function pickHighestPriorityRole(roleRows: Array<{ role: string }>): string {
  if (roleRows.length === 0) return 'GROUP_READONLY'
  return [...roleRows].sort(
    (a, b) => (ROLE_PRIORITY[b.role] ?? 0) - (ROLE_PRIORITY[a.role] ?? 0)
  )[0].role
}

// ---------------------------------------------------------------
// Metric helpers
// ---------------------------------------------------------------

/**
 * Behold kun første forekomst pr. `(company_id, metric_type)`-kombination.
 * Antager input er sorteret desc på period_year, så første = nyeste.
 */
export function filterLatestPerCompany(
  rows: Array<{
    company_id: string
    metric_type: string
    value: { toString(): string } | number
    period_year: number
  }>
) {
  const seen = new Set<string>()
  return rows.filter((r) => {
    const key = `${r.company_id}-${r.metric_type}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

/**
 * Summér alle `value`-felter for rækker hvor `metric_type` matcher.
 */
export function sumMetric(
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

// ---------------------------------------------------------------
// Heatmap / urgency
// ---------------------------------------------------------------

/**
 * Udled selskabs-sundhedsstatus baseret på åbne sager + forfaldne opgaver.
 * Forfaldne opgaver vægter højest.
 */
export function deriveHealth(
  openCases: number,
  overdueTasks: number
): 'healthy' | 'warning' | 'critical' {
  if (overdueTasks > 0) return 'critical'
  if (openCases > 0) return 'warning'
  return 'healthy'
}

// ---------------------------------------------------------------
// KPI-builder
// ---------------------------------------------------------------

/**
 * Byg inline KPI-liste baseret på brugerens rolle. Legal/finance får
 * specialiserede KPI-sæt; øvrige roller får general-purpose.
 */
export function buildInlineKpis(
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
      {
        label: 'Udløbende',
        value: String(data.expiringCount),
        color: data.expiringCount > 0 ? 'amber' : undefined,
      },
      { label: 'Sager', value: String(data.openCasesCount) },
      {
        label: 'Forfaldne',
        value: String(data.overdueCount),
        color: data.overdueCount > 0 ? 'red' : undefined,
      },
    ]
  }
  if (role === 'GROUP_FINANCE') {
    return [
      { label: 'Omsætning', value: `${formatMio(data.omsaetningTotal)}m` },
      { label: 'EBITDA', value: `${formatMio(data.ebitdaTotal)}m` },
      { label: 'Margin', value: `${(data.margin * 100).toFixed(1)}%` },
      {
        label: 'Forfaldne',
        value: String(data.overdueCount),
        color: data.overdueCount > 0 ? 'red' : undefined,
      },
    ]
  }
  // GROUP_OWNER and default
  return [
    { label: 'Selskaber', value: String(data.companiesCount) },
    {
      label: 'Udløbende',
      value: String(data.expiringCount),
      color: data.expiringCount > 0 ? 'amber' : undefined,
    },
    { label: 'Sager', value: String(data.openCasesCount) },
    {
      label: 'Forfaldne',
      value: String(data.overdueCount),
      color: data.overdueCount > 0 ? 'red' : undefined,
    },
  ]
}

// ---------------------------------------------------------------
// Formatters / utilities
// ---------------------------------------------------------------

/**
 * Returnér første bogstav (uppercase) — eller `?` hvis navn er tomt.
 */
export function firstLetter(name: string | null | undefined): string {
  return (name ?? '?').charAt(0).toUpperCase()
}

/**
 * Dage mellem to datoer (ceiling). Bruges til overdue-beregning.
 */
export function relativeDays(from: Date, to: Date): number {
  return Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24))
}

// ---------------------------------------------------------------
// Timeline-builder
// ---------------------------------------------------------------

export interface TimelineRawData {
  overdueTasks: Array<{
    id: string
    title: string
    due_date: Date | null
    company_id: string | null
  }>
  todayAndFutureTasks: Array<{
    id: string
    title: string
    due_date: Date | null
    company_id: string | null
  }>
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

/**
 * Byg de 4 timeline-sektioner (overdue / today / thisweek / nextweek)
 * ud fra den samlede dataset-snapshot hentet fra DB.
 */
export function buildTimelineSections(data: TimelineRawData): TimelineSectionData[] {
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

  for (const v of upcomingVisits
    .filter((v) => v.visit_date >= todayStart && v.visit_date <= todayEnd)
    .slice(0, 5)) {
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
  for (const v of upcomingVisits
    .filter((v) => v.visit_date > todayEnd && v.visit_date <= weekEnd)
    .slice(0, 3)) {
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
  for (const c of expiringContracts
    .filter((c) => c.expiry_date && c.expiry_date > weekEnd)
    .slice(0, 3)) {
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

  const todayLabel = `I dag — ${today.toLocaleDateString('da-DK', { day: 'numeric', month: 'long' })}`

  return [
    { id: 'overdue', label: 'Overskredet', dotType: 'overdue', items: overdueItems },
    { id: 'today', label: todayLabel, dotType: 'today', items: todayItems },
    { id: 'thisweek', label: 'Denne uge', dotType: 'future', items: thisweekItems },
    { id: 'nextweek', label: 'Næste uge', dotType: 'future', items: nextweekItems },
  ]
}

// ---------------------------------------------------------------
// Empty-state
// ---------------------------------------------------------------

/**
 * Default dashboard-data når bruger ikke har adgang til nogen selskaber.
 */
export function emptyDashboardData(role: string): DashboardData {
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
