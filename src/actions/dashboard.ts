'use server'

/**
 * Dashboard Server Actions
 * BA-09 (Performance-agent) — Sprint 5
 *
 * Succeskriterium: Dashboard med 10 selskaber loader under 2 sekunder.
 *
 * Strategi:
 * - ÉN aggregeret query via $queryRaw til alle counts (ingen N+1)
 * - Separate aggregerede Prisma-queries for kontrakt- og sagsstatus
 * - unstable_cache med 2-minutters TTL på summary-data
 * - Alle queries er organisation-scopede (tenant isolation)
 */

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { canAccessModule } from '@/lib/permissions'
import { unstable_cache } from 'next/cache'
import { Prisma } from '@prisma/client'

// ==================== TYPER ====================

export interface CompanyDashboardRow {
  id: string
  name: string
  cvr: string | null
  status: string
  contractCount: number
  activeCaseCount: number
  openTaskCount: number
  /** Seneste nøgletal: omsætning for nyeste år (DKK) */
  latestRevenue: number | null
  latestRevenueYear: number | null
}

export interface DashboardSummary {
  totalCompanies: number
  activeContracts: number
  expiringContracts30Days: number
  openCases: number
  overdueDeadlines: number
  /** Tidsstempel for hvornår data sidst blev beregnet */
  computedAt: string
}

export interface DashboardData {
  companies: CompanyDashboardRow[]
  summary: DashboardSummary
}

interface ActionResult<T> {
  data?: T
  error?: string
}

// ==================== CACHE-HJÆLPERE ====================

/**
 * Cache-nøgle for dashboard-summary.
 * TTL: 120 sekunder (2 minutter) — acceptabelt stale for counts.
 * Invalideres ved: revalidateTag(`dashboard:${organizationId}`)
 */
function getDashboardSummaryCached(organizationId: string) {
  return unstable_cache(
    () => computeDashboardSummary(organizationId),
    [`dashboard-summary-${organizationId}`],
    {
      revalidate: 120,
      tags: [`dashboard:${organizationId}`, 'dashboard'],
    }
  )()
}

/**
 * Cache-nøgle for company-rows.
 * TTL: 120 sekunder — samme som summary.
 */
function getDashboardCompaniesCached(organizationId: string) {
  return unstable_cache(
    () => computeCompanyRows(organizationId),
    [`dashboard-companies-${organizationId}`],
    {
      revalidate: 120,
      tags: [`dashboard:${organizationId}`, 'dashboard'],
    }
  )()
}

// ==================== INTERNE BEREGNERE ====================

/**
 * Aggregeret dashboard-summary.
 * Bruger $queryRaw med én SQL-sætning til at beregne alle counts.
 * Parameteriseret med Prisma.sql (beskytter mod SQL-injection).
 */
async function computeDashboardSummary(organizationId: string): Promise<DashboardSummary> {
  const now = new Date()
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

  type SummaryRow = {
    total_companies: bigint
    active_contracts: bigint
    expiring_contracts: bigint
    open_cases: bigint
    overdue_deadlines: bigint
  }

  const rows = await prisma.$queryRaw<SummaryRow[]>(
    Prisma.sql`
      SELECT
        (SELECT COUNT(*) FROM "Company"
         WHERE "organizationId" = ${organizationId}
           AND "deletedAt" IS NULL) AS total_companies,

        (SELECT COUNT(*) FROM "Contract"
         WHERE "organizationId" = ${organizationId}
           AND "status" = 'AKTIV'
           AND "deletedAt" IS NULL) AS active_contracts,

        (SELECT COUNT(*) FROM "Contract"
         WHERE "organizationId" = ${organizationId}
           AND "status" = 'AKTIV'
           AND "expiresAt" IS NOT NULL
           AND "expiresAt" <= ${thirtyDaysFromNow}
           AND "expiresAt" > ${now}
           AND "deletedAt" IS NULL) AS expiring_contracts,

        (SELECT COUNT(*) FROM "Case"
         WHERE "organizationId" = ${organizationId}
           AND "status" IN ('NY', 'AKTIV', 'AFVENTER_EKSTERN', 'AFVENTER_KLIENT')
           AND "deletedAt" IS NULL) AS open_cases,

        (SELECT COUNT(*) FROM "Task"
         WHERE "organizationId" = ${organizationId}
           AND "dueDate" IS NOT NULL
           AND "dueDate" < ${now}
           AND "completedAt" IS NULL
           AND "deletedAt" IS NULL) AS overdue_deadlines
    `
  )

  const row = rows[0]

  return {
    totalCompanies: Number(row.total_companies),
    activeContracts: Number(row.active_contracts),
    expiringContracts30Days: Number(row.expiring_contracts),
    openCases: Number(row.open_cases),
    overdueDeadlines: Number(row.overdue_deadlines),
    computedAt: new Date().toISOString(),
  }
}

/**
 * Per-selskab aggregerede counts.
 * Én $queryRaw der joiner alle counts — ingen N+1.
 */
async function computeCompanyRows(organizationId: string): Promise<CompanyDashboardRow[]> {
  type CompanyRow = {
    id: string
    name: string
    cvr: string | null
    status: string
    contract_count: bigint
    active_case_count: bigint
    open_task_count: bigint
    latest_revenue: string | null
    latest_revenue_year: number | null
  }

  const rows = await prisma.$queryRaw<CompanyRow[]>(
    Prisma.sql`
      SELECT
        c.id,
        c.name,
        c.cvr,
        c.status,
        COUNT(DISTINCT con.id) FILTER (WHERE con."deletedAt" IS NULL)   AS contract_count,
        COUNT(DISTINCT cs.id)  FILTER (WHERE cs."deletedAt" IS NULL
                                         AND cs.status IN ('NY','AKTIV','AFVENTER_EKSTERN','AFVENTER_KLIENT'))
                                                                         AS active_case_count,
        COUNT(DISTINCT t.id)   FILTER (WHERE t."deletedAt" IS NULL
                                         AND t."completedAt" IS NULL)   AS open_task_count,
        kn."revenue"                                                      AS latest_revenue,
        kn."year"                                                         AS latest_revenue_year
      FROM "Company" c
      LEFT JOIN "Contract" con
        ON con."companyId" = c.id
       AND con."organizationId" = ${organizationId}
      LEFT JOIN "Case" cs
        ON cs."companyId" = c.id
       AND cs."organizationId" = ${organizationId}
      LEFT JOIN "Task" t
        ON t."companyId" = c.id
       AND t."organizationId" = ${organizationId}
      -- Seneste nøgletal pr. selskab (lateral join)
      LEFT JOIN LATERAL (
        SELECT kn2."revenue", kn2."year"
        FROM "KeyFigure" kn2
        WHERE kn2."companyId" = c.id
          AND kn2."organizationId" = ${organizationId}
          AND kn2."deletedAt" IS NULL
        ORDER BY kn2."year" DESC
        LIMIT 1
      ) kn ON TRUE
      WHERE c."organizationId" = ${organizationId}
        AND c."deletedAt" IS NULL
      GROUP BY c.id, c.name, c.cvr, c.status, kn."revenue", kn."year"
      ORDER BY c.name ASC
    `
  )

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    cvr: r.cvr,
    status: r.status,
    contractCount: Number(r.contract_count),
    activeCaseCount: Number(r.active_case_count),
    openTaskCount: Number(r.open_task_count),
    latestRevenue: r.latest_revenue != null ? Number(r.latest_revenue) : null,
    latestRevenueYear: r.latest_revenue_year ?? null,
  }))
}

// ==================== EKSPORTERET SERVER ACTION ====================

/**
 * Henter komplet dashboard-data for den autentificerede brugers organisation.
 * Bruger cache — TTL 120 sekunder.
 */
export async function getDashboardData(): Promise<ActionResult<DashboardData>> {
  const session = await auth()
  if (!session?.user) {
    return { error: 'Ikke autoriseret' }
  }

  const organizationId = (session.user as { organizationId?: string }).organizationId
  if (!organizationId) {
    return { error: 'Ingen organisation tilknyttet' }
  }

  const hasAccess = await canAccessModule(session.user.id, 'dashboard')
  if (!hasAccess) {
    return { error: 'Ingen adgang til dashboard' }
  }

  const [summary, companies] = await Promise.all([
    getDashboardSummaryCached(organizationId),
    getDashboardCompaniesCached(organizationId),
  ])

  return {
    data: {
      summary,
      companies,
    },
  }
}