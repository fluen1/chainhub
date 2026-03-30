import type { MockCompany, MockRole } from './types'
import { getFinancialByCompany } from './financial'

// ---------------------------------------------------------------
// getDashboardSectionsForRole
// Returnerer dashboard-sektioner i prioriteret rækkefølge pr. rolle.
// ---------------------------------------------------------------
export type DashboardSection =
  | 'kpi'
  | 'urgency'
  | 'health'
  | 'calendar'
  | 'coverage'
  | 'cases'
  | 'finance'
  | 'finance_alerts'
  | 'top_locations'
  | 'loss_locations'
  | 'finance_contracts'
  | 'legal_docs'

export function getDashboardSectionsForRole(role: MockRole): DashboardSection[] {
  switch (role) {
    case 'GROUP_OWNER':
      return ['kpi', 'urgency', 'health', 'calendar', 'coverage', 'cases', 'finance', 'finance_alerts']
    case 'GROUP_LEGAL':
      return ['kpi', 'urgency', 'cases', 'calendar', 'coverage', 'legal_docs']
    case 'GROUP_FINANCE':
      return ['kpi', 'top_locations', 'finance_alerts', 'calendar', 'loss_locations', 'finance_contracts']
    case 'GROUP_ADMIN':
      return ['kpi', 'urgency', 'health', 'calendar']
    case 'COMPANY_MANAGER':
      return ['kpi', 'urgency', 'calendar']
    default:
      return ['kpi', 'urgency', 'calendar']
  }
}

// ---------------------------------------------------------------
// formatMockCurrency — formater tal til kompakt DKK-streng
// ---------------------------------------------------------------
function formatMockCurrency(val: number | null | undefined): string {
  if (val === null || val === undefined) return '—'
  if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M kr.`
  return `${(val / 1_000).toFixed(0)}K kr.`
}

// ---------------------------------------------------------------
// filterCompaniesByRole
// GROUP-roller ser alle selskaber.
// COMPANY_MANAGER ser kun sine tildelte selskaber.
// ---------------------------------------------------------------
export function filterCompaniesByRole(
  companies: MockCompany[],
  role: MockRole,
  assignedIds: string[]
): MockCompany[] {
  if (role === 'COMPANY_MANAGER') {
    return companies.filter((c) => assignedIds.includes(c.id))
  }
  return companies
}

// ---------------------------------------------------------------
// getVisibleDashboardBlocks
// Returnerer blok-navne i fast rækkefølge, filtreret efter rolle.
// ---------------------------------------------------------------
export function getVisibleDashboardBlocks(role: MockRole): string[] {
  const allBlocks: { name: string; roles: MockRole[] }[] = [
    { name: 'urgency_feed', roles: ['GROUP_OWNER', 'GROUP_ADMIN', 'GROUP_LEGAL', 'GROUP_FINANCE', 'COMPANY_MANAGER'] },
    { name: 'portfolio_summary', roles: ['GROUP_OWNER', 'GROUP_ADMIN', 'GROUP_FINANCE'] },
    { name: 'contract_expiry', roles: ['GROUP_OWNER', 'GROUP_LEGAL', 'GROUP_ADMIN'] },
    { name: 'task_overview', roles: ['GROUP_OWNER', 'GROUP_ADMIN', 'GROUP_LEGAL', 'GROUP_FINANCE', 'COMPANY_MANAGER'] },
    { name: 'document_review', roles: ['GROUP_LEGAL', 'GROUP_ADMIN'] },
    { name: 'financial_kpi', roles: ['GROUP_FINANCE', 'GROUP_OWNER'] },
    { name: 'my_companies', roles: ['COMPANY_MANAGER'] },
    { name: 'ai_insights', roles: ['GROUP_OWNER', 'GROUP_ADMIN', 'GROUP_LEGAL', 'GROUP_FINANCE', 'COMPANY_MANAGER'] },
    { name: 'compliance_status', roles: ['GROUP_LEGAL'] },
    { name: 'data_quality', roles: ['GROUP_ADMIN'] },
  ]

  return allBlocks
    .filter((b) => b.roles.includes(role))
    .map((b) => b.name)
}

// ---------------------------------------------------------------
// getVisibleCompanySections
// Returnerer sektion-navne for virksomhedsdetalje-siden.
// Skjuler irrelevante sektioner baseret på rolle.
// ---------------------------------------------------------------
export function getVisibleCompanySections(role: MockRole): string[] {
  const allSections: { name: string; roles: MockRole[] }[] = [
    { name: 'overview', roles: ['GROUP_OWNER', 'GROUP_ADMIN', 'GROUP_LEGAL', 'GROUP_FINANCE', 'COMPANY_MANAGER'] },
    { name: 'contracts', roles: ['GROUP_OWNER', 'GROUP_ADMIN', 'GROUP_LEGAL', 'COMPANY_MANAGER'] },
    { name: 'ownership', roles: ['GROUP_OWNER', 'GROUP_LEGAL'] },
    { name: 'governance', roles: ['GROUP_OWNER', 'GROUP_ADMIN', 'GROUP_LEGAL'] },
    { name: 'employees', roles: ['GROUP_OWNER', 'GROUP_ADMIN', 'COMPANY_MANAGER'] },
    { name: 'cases', roles: ['GROUP_OWNER', 'GROUP_ADMIN', 'GROUP_LEGAL', 'COMPANY_MANAGER'] },
    { name: 'finance', roles: ['GROUP_OWNER', 'GROUP_FINANCE', 'COMPANY_MANAGER'] },
    { name: 'documents', roles: ['GROUP_OWNER', 'GROUP_ADMIN', 'GROUP_LEGAL', 'GROUP_FINANCE', 'COMPANY_MANAGER'] },
  ]

  return allSections
    .filter((s) => s.roles.includes(role))
    .map((s) => s.name)
}

// ---------------------------------------------------------------
// getCompanySubtitle
// Returnerer rollespecifik undertekst til selskabskort.
// ---------------------------------------------------------------
export function getCompanySubtitle(company: MockCompany, role: MockRole): string {
  switch (role) {
    case 'GROUP_FINANCE': {
      const financials = getFinancialByCompany(company.id)
      const latest = financials.find((f) => f.year === 2025) ?? financials[financials.length - 1]
      return `Omsaetning: ${formatMockCurrency(latest?.omsaetning)} · EBITDA: ${formatMockCurrency(latest?.ebitda)}`
    }

    case 'GROUP_LEGAL':
      return `CVR ${company.cvr} · ${company.contractCount} kontrakter · ${company.openCaseCount > 0 ? `${company.openCaseCount} åbne sager` : 'Ingen åbne sager'}`

    case 'GROUP_ADMIN':
      return `${company.city} · ${company.employeeCount} medarbejdere · ${company.openCaseCount > 0 ? `${company.openCaseCount} sager` : 'Ingen sager'}`

    case 'COMPANY_MANAGER':
      return `${company.address} · ${company.employeeCount} medarbejdere`

    case 'GROUP_OWNER':
    default:
      return `CVR ${company.cvr} · ${company.partnerName} (${company.partnerOwnershipPct}%) · ${company.contractCount} kontrakter`
  }
}

// ---------------------------------------------------------------
// getSidebarBadge
// Returnerer rollespecifik urgency-badge for sidebarelementer.
// Returnerer null hvis intet badge skal vises.
// ---------------------------------------------------------------

interface SidebarData {
  criticalCount?: number
  warningCount?: number
  overdueTaskCount?: number
  awaitingDocCount?: number
  openCaseCount?: number
  expiringContractCount?: number
}

export function getSidebarBadge(
  navItem: string,
  role: MockRole,
  data: SidebarData
): { count: number; urgency: 'critical' | 'warning' | 'normal' } | null {
  switch (navItem) {
    case 'portfolio':
      if (role === 'GROUP_OWNER' || role === 'GROUP_ADMIN') {
        if (data.criticalCount && data.criticalCount > 0) {
          return { count: data.criticalCount, urgency: 'critical' }
        }
        if (data.warningCount && data.warningCount > 0) {
          return { count: data.warningCount, urgency: 'warning' }
        }
      }
      return null

    case 'contracts':
      if (role === 'GROUP_LEGAL' || role === 'GROUP_OWNER' || role === 'GROUP_ADMIN') {
        if (data.expiringContractCount && data.expiringContractCount > 0) {
          return { count: data.expiringContractCount, urgency: 'critical' }
        }
      }
      return null

    case 'tasks':
      if (data.overdueTaskCount && data.overdueTaskCount > 0) {
        return { count: data.overdueTaskCount, urgency: 'critical' }
      }
      return null

    case 'documents':
      if (role === 'GROUP_LEGAL' || role === 'GROUP_ADMIN') {
        if (data.awaitingDocCount && data.awaitingDocCount > 0) {
          return { count: data.awaitingDocCount, urgency: 'warning' }
        }
      }
      return null

    case 'cases':
      if (role !== 'GROUP_FINANCE') {
        if (data.openCaseCount && data.openCaseCount > 0) {
          return { count: data.openCaseCount, urgency: 'warning' }
        }
      }
      return null

    default:
      return null
  }
}
