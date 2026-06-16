import { prisma } from '@/lib/db'
import { formatDate } from '@/lib/labels'
import type { CsvColumn } from './csv'

// ============================================================
// Types
// ============================================================

export interface EntityExport<T> {
  /** Standard-filnavn uden extension */
  filename: string
  rows: T[]
  columns: CsvColumn<T>[]
}

export interface ExportScope {
  organizationId: string
  /** Scope-filter — fx kun selskaber brugeren har adgang til */
  visibleCompanyIds?: string[]
  /** Sensitivity-filter — kun kontrakter ≤ dette niveau */
  maxSensitivity?: string
}

// Formatter-helpers — ekstraheret så Date-håndtering er konsistent.
const fmtDate = (v: unknown): string => (v instanceof Date ? formatDate(v) : '')
const fmtRelName = (v: unknown): string => (v as { name?: string | null } | null)?.name ?? ''

// ============================================================
// Companies
// ============================================================

export async function fetchCompaniesForExport(
  scope: ExportScope
): Promise<EntityExport<Record<string, unknown>>> {
  const companies = await prisma.company.findMany({
    where: {
      organization_id: scope.organizationId,
      deleted_at: null,
      ...(scope.visibleCompanyIds ? { id: { in: scope.visibleCompanyIds } } : {}),
    },
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      cvr: true,
      address: true,
      city: true,
      postal_code: true,
      founded_date: true,
      created_at: true,
    },
  })

  // Hent seneste finansdata pr. selskab (to år — til YoY beregning)
  const companyIds = companies.map((c) => c.id)
  const financials =
    companyIds.length > 0
      ? await prisma.financialMetric.findMany({
          where: {
            organization_id: scope.organizationId,
            company_id: { in: companyIds },
            period_type: 'HELAAR',
            metric_type: { in: ['OMSAETNING', 'EBITDA'] },
          },
          orderBy: { period_year: 'desc' },
          select: { company_id: true, metric_type: true, value: true, period_year: true },
        })
      : []

  // Byg seneste og næst-seneste tal pr. selskab
  interface YearMap {
    omsaetning?: number
    ebitda?: number
  }
  const byCompany = new Map<string, { latest: YearMap; prev: YearMap; latestYear: number }>()
  for (const fm of financials) {
    const val = Number(fm.value)
    const entry = byCompany.get(fm.company_id) ?? {
      latest: {},
      prev: {},
      latestYear: fm.period_year,
    }
    if (fm.period_year === entry.latestYear) {
      if (fm.metric_type === 'OMSAETNING') entry.latest.omsaetning = val
      if (fm.metric_type === 'EBITDA') entry.latest.ebitda = val
    } else if (fm.period_year === entry.latestYear - 1) {
      if (fm.metric_type === 'OMSAETNING') entry.prev.omsaetning = val
      if (fm.metric_type === 'EBITDA') entry.prev.ebitda = val
    }
    byCompany.set(fm.company_id, entry)
  }

  const rows = companies.map((c) => {
    const fin = byCompany.get(c.id)
    const omsaetning_seneste = fin?.latest.omsaetning ?? null
    const ebitda_seneste = fin?.latest.ebitda ?? null
    const margin_seneste =
      omsaetning_seneste && omsaetning_seneste > 0 && ebitda_seneste != null
        ? Math.round((ebitda_seneste / omsaetning_seneste) * 1000) / 10
        : null
    const omsaetning_yoy_pct =
      omsaetning_seneste != null && fin?.prev.omsaetning && fin.prev.omsaetning > 0
        ? Math.round(((omsaetning_seneste - fin.prev.omsaetning) / fin.prev.omsaetning) * 1000) / 10
        : null
    const ebitda_yoy_pct =
      ebitda_seneste != null && fin?.prev.ebitda != null && fin.prev.ebitda !== 0
        ? Math.round(((ebitda_seneste - fin.prev.ebitda) / Math.abs(fin.prev.ebitda)) * 1000) / 10
        : null

    return {
      ...c,
      omsaetning_seneste,
      ebitda_seneste,
      margin_seneste,
      omsaetning_yoy_pct,
      ebitda_yoy_pct,
      seneste_finans_aar: fin?.latestYear ?? null,
    }
  })

  return {
    filename: `chainhub-selskaber-${new Date().toISOString().slice(0, 10)}`,
    rows: rows as Record<string, unknown>[],
    columns: [
      { key: 'id', header: 'ID' },
      { key: 'name', header: 'Navn' },
      { key: 'cvr', header: 'CVR' },
      { key: 'address', header: 'Adresse' },
      { key: 'city', header: 'By' },
      { key: 'postal_code', header: 'Postnummer' },
      { key: 'founded_date', header: 'Stiftet', format: fmtDate },
      { key: 'created_at', header: 'Oprettet i ChainHub', format: fmtDate },
      { key: 'seneste_finans_aar', header: 'Finansår' },
      { key: 'omsaetning_seneste', header: 'Omsætning (kr)' },
      { key: 'ebitda_seneste', header: 'EBITDA (kr)' },
      { key: 'margin_seneste', header: 'EBITDA-margin (%)' },
      { key: 'omsaetning_yoy_pct', header: 'Omsætning YoY (%)' },
      { key: 'ebitda_yoy_pct', header: 'EBITDA YoY (%)' },
    ],
  }
}

// ============================================================
// Contracts
// ============================================================

export async function fetchContractsForExport(
  scope: ExportScope
): Promise<EntityExport<Record<string, unknown>>> {
  const contracts = await prisma.contract.findMany({
    where: {
      organization_id: scope.organizationId,
      deleted_at: null,
      ...(scope.visibleCompanyIds ? { company_id: { in: scope.visibleCompanyIds } } : {}),
    },
    orderBy: { created_at: 'desc' },
    include: { company: { select: { name: true } } },
  })
  return {
    filename: `chainhub-kontrakter-${new Date().toISOString().slice(0, 10)}`,
    rows: contracts as Record<string, unknown>[],
    columns: [
      { key: 'id', header: 'ID' },
      { key: 'display_name', header: 'Navn' },
      { key: 'system_type', header: 'Type' },
      { key: 'status', header: 'Status' },
      { key: 'sensitivity', header: 'Sensitivitet' },
      { key: 'company', header: 'Selskab', format: fmtRelName },
      { key: 'effective_date', header: 'Ikrafttrædelse', format: fmtDate },
      { key: 'expiry_date', header: 'Udløber', format: fmtDate },
      { key: 'notice_period_days', header: 'Opsigelsesvarsel (dage)' },
      { key: 'created_at', header: 'Oprettet', format: fmtDate },
    ],
  }
}

// ============================================================
// Cases
// ============================================================

export async function fetchCasesForExport(
  scope: ExportScope
): Promise<EntityExport<Record<string, unknown>>> {
  const cases = await prisma.case.findMany({
    where: { organization_id: scope.organizationId, deleted_at: null },
    orderBy: { created_at: 'desc' },
    include: {
      case_companies: { include: { company: { select: { name: true } } } },
    },
  })
  const rows = cases.map((c) => ({
    ...c,
    company_names: c.case_companies
      .map((cc) => cc.company?.name)
      .filter(Boolean)
      .join('; '),
  }))
  return {
    filename: `chainhub-sager-${new Date().toISOString().slice(0, 10)}`,
    rows: rows as Record<string, unknown>[],
    columns: [
      { key: 'id', header: 'ID' },
      { key: 'case_number', header: 'Sagsnr.' },
      { key: 'title', header: 'Titel' },
      { key: 'case_type', header: 'Type' },
      { key: 'case_subtype', header: 'Undertype' },
      { key: 'status', header: 'Status' },
      { key: 'sensitivity', header: 'Sensitivitet' },
      { key: 'company_names', header: 'Selskaber' },
      { key: 'due_date', header: 'Frist', format: fmtDate },
      { key: 'closed_at', header: 'Lukket', format: fmtDate },
      { key: 'created_at', header: 'Oprettet', format: fmtDate },
    ],
  }
}

// ============================================================
// Tasks
// ============================================================

export async function fetchTasksForExport(
  scope: ExportScope
): Promise<EntityExport<Record<string, unknown>>> {
  // NB: Task-modellen har `company_id` men INGEN `company`-relation i schema.prisma.
  // Derfor join'er vi company-navn manuelt efter fetch.
  const tasks = await prisma.task.findMany({
    where: { organization_id: scope.organizationId, deleted_at: null },
    orderBy: { due_date: 'asc' },
    include: {
      assignee: { select: { name: true, email: true } },
    },
  })

  const companyIds = Array.from(
    new Set(tasks.map((t) => t.company_id).filter((v): v is string => Boolean(v)))
  )
  const companies = companyIds.length
    ? await prisma.company.findMany({
        where: { organization_id: scope.organizationId, id: { in: companyIds } },
        select: { id: true, name: true },
      })
    : []
  const companyNameById = new Map(companies.map((c) => [c.id, c.name]))

  const rows = tasks.map((t) => ({
    ...t,
    company_name: t.company_id ? (companyNameById.get(t.company_id) ?? '') : '',
  }))

  return {
    filename: `chainhub-opgaver-${new Date().toISOString().slice(0, 10)}`,
    rows: rows as Record<string, unknown>[],
    columns: [
      { key: 'id', header: 'ID' },
      { key: 'title', header: 'Titel' },
      { key: 'status', header: 'Status' },
      { key: 'priority', header: 'Prioritet' },
      { key: 'company_name', header: 'Selskab' },
      { key: 'assignee', header: 'Tildelt', format: fmtRelName },
      { key: 'due_date', header: 'Frist', format: fmtDate },
      { key: 'completed_at', header: 'Afsluttet', format: fmtDate },
      { key: 'created_at', header: 'Oprettet', format: fmtDate },
    ],
  }
}

// ============================================================
// Persons
// ============================================================

export async function fetchPersonsForExport(
  scope: ExportScope
): Promise<EntityExport<Record<string, unknown>>> {
  const persons = await prisma.person.findMany({
    where: { organization_id: scope.organizationId, deleted_at: null },
    orderBy: [{ last_name: 'asc' }, { first_name: 'asc' }],
  })
  return {
    filename: `chainhub-personer-${new Date().toISOString().slice(0, 10)}`,
    rows: persons as Record<string, unknown>[],
    columns: [
      { key: 'id', header: 'ID' },
      { key: 'first_name', header: 'Fornavn' },
      { key: 'last_name', header: 'Efternavn' },
      { key: 'email', header: 'Email' },
      { key: 'phone', header: 'Telefon' },
      { key: 'created_at', header: 'Oprettet', format: fmtDate },
    ],
  }
}

// ============================================================
// Visits
// ============================================================

export async function fetchVisitsForExport(
  scope: ExportScope
): Promise<EntityExport<Record<string, unknown>>> {
  const visits = await prisma.visit.findMany({
    where: {
      organization_id: scope.organizationId,
      deleted_at: null,
      ...(scope.visibleCompanyIds ? { company_id: { in: scope.visibleCompanyIds } } : {}),
    },
    orderBy: { visit_date: 'desc' },
    include: {
      company: { select: { name: true } },
      visitor: { select: { name: true } },
    },
  })
  return {
    filename: `chainhub-besog-${new Date().toISOString().slice(0, 10)}`,
    rows: visits as Record<string, unknown>[],
    columns: [
      { key: 'id', header: 'ID' },
      { key: 'company', header: 'Selskab', format: fmtRelName },
      { key: 'visit_type', header: 'Type' },
      { key: 'status', header: 'Status' },
      { key: 'visit_date', header: 'Dato', format: fmtDate },
      { key: 'visitor', header: 'Besøgende', format: fmtRelName },
      { key: 'created_at', header: 'Oprettet', format: fmtDate },
    ],
  }
}

// ============================================================
// Dispatcher
// ============================================================

export type ExportableEntity = 'companies' | 'contracts' | 'cases' | 'tasks' | 'persons' | 'visits'

export async function fetchEntityForExport(
  entity: ExportableEntity,
  scope: ExportScope
): Promise<EntityExport<Record<string, unknown>>> {
  switch (entity) {
    case 'companies':
      return fetchCompaniesForExport(scope)
    case 'contracts':
      return fetchContractsForExport(scope)
    case 'cases':
      return fetchCasesForExport(scope)
    case 'tasks':
      return fetchTasksForExport(scope)
    case 'persons':
      return fetchPersonsForExport(scope)
    case 'visits':
      return fetchVisitsForExport(scope)
  }
}
