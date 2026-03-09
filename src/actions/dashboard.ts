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

  /**
   * Én enkelt query der beregner:
   * - total aktive selskaber
   * - aktive kontrakter
   * - kontrakter der udløber inden 30 dage
   * - åbne sager (NY + AKTIV + AFVENTER_EKSTERN + AFVENTER_KLIENT)
   * - overskrene frister
   *
   * Bruger Prisma.sql til parameterisering — ALDRIG string-interpolation.
   */
  const rows = await prisma.$queryRaw<
    Array<{
      total_companies: bigint
      active_contracts: bigint
      expiring_contracts_30d: bigint
      open_cases: bigint
      overdue_deadlines: bigint
    }>
  >(
    Prisma.sql`
      SELECT
        (
          SELECT COUNT(*)
          FROM companies c
          WHERE c.organization_id = ${organizationId}
            AND c.deleted_at IS NULL
            AND c.status = 'aktiv'
        ) AS total_companies,

        (
          SELECT COUNT(*)
          FROM contracts con
          WHERE con.organization_id = ${organizationId}
            AND con.deleted_at IS NULL
            AND con.status = 'AKTIV'
        ) AS active_contracts,

        (
          SELECT COUNT(*)
          FROM contracts con
          WHERE con.organization_id = ${organizationId}
            AND con.deleted_at IS NULL
            AND con.status = 'AKTIV'
            AND con.expiry_date IS NOT NULL
            AND con.expiry_date >= ${now}
            AND con.expiry_date <= ${thirtyDaysFromNow}
        ) AS expiring_contracts_30d,

        (
          SELECT COUNT(*)
          FROM cases ca
          WHERE ca.organization_id = ${organizationId}
            AND ca.deleted_at IS NULL
            AND ca.status IN ('NY', 'AKTIV', 'AFVENTER_EKSTERN', 'AFVENTER_KLIENT')
        ) AS open_cases,

        (
          SELECT COUNT(*)
          FROM deadlines d
          WHERE d.organization_id = ${organizationId}
            AND d.deleted_at IS NULL
            AND d.completed_at IS NULL
            AND d.due_date < ${now}
        ) AS overdue_deadlines
    `
  )

  const row = rows[0]
  if (!row) {
    return {
      totalCompanies: 0,
      activeContracts: 0,
      expiringContracts30Days: 0,
      openCases: 0,
      overdueDeadlines: 0,
      computedAt: now.toISOString(),
    }
  }

  return {
    totalCompanies: Number(row.total_companies),
    activeContracts: Number(row.active_contracts),
    expiringContracts30Days: Number(row.expiring_contracts_30d),
    openCases: Number(row.open_cases),
    overdueDeadlines: Number(row.overdue_deadlines),
    computedAt: now.toISOString(),
  }
}

/**
 * Aggregerede company-rows — INGEN N+1.
 *
 * Strategy:
 * 1. Hent alle aktive selskaber (max 50 — dashboard pagineres ikke yderligere)
 * 2. ÉN $queryRaw med LEFT JOIN GROUP BY til counts per selskab
 * 3. ÉN Prisma-query til seneste omsætnings-nøgletal per selskab
 * 4. Merge i JavaScript
 *
 * Total: 3 queries uanset antal selskaber (ingen N+1).
 */
async function computeCompanyRows(organizationId: string): Promise<CompanyDashboardRow[]> {
  // Query 1: Hent selskaber (max 50 til dashboard)
  const companies = await prisma.company.findMany({
    where: {
      organizationId,
      deletedAt: null,
    },
    select: {
      id: true,
      name: true,
      cvr: true,
      status: true,
    },
    orderBy: { name: 'asc' },
    take: 50,
  })

  if (companies.length === 0) return []

  const companyIds = companies.map((c) => c.id)

  // Query 2: Aggregerede counts per selskab — ÉN query med GROUP BY
  // Prisma.sql med array-parameter til IN-clause
  const countRows = await prisma.$queryRaw<
    Array<{
      company_id: string
      contract_count: bigint
      active_case_count: bigint
      open_task_count: bigint
    }>
  >(
    Prisma.sql`
      SELECT
        c.id AS company_id,

        -- Kontrakter tilknyttet selskabet (ikke slettet)
        COUNT(DISTINCT con.id) FILTER (
          WHERE con.deleted_at IS NULL
        ) AS contract_count,

        -- Aktive sager tilknyttet selskabet
        COUNT(DISTINCT cc_case.case_id) FILTER (
          WHERE ca.deleted_at IS NULL
            AND ca.status IN ('NY', 'AKTIV', 'AFVENTER_EKSTERN', 'AFVENTER_KLIENT')
        ) AS active_case_count,

        -- Åbne opgaver tilknyttet selskabet
        COUNT(DISTINCT t.id) FILTER (
          WHERE t.deleted_at IS NULL
            AND t.status != 'LUKKET'
        ) AS open_task_count

      FROM companies c

      LEFT JOIN contracts con
        ON con.company_id = c.id
        AND con.organization_id = ${organizationId}

      LEFT JOIN case_companies cc_case
        ON cc_case.company_id = c.id
        AND cc_case.organization_id = ${organizationId}
      LEFT JOIN cases ca
        ON ca.id = cc_case.case_id
        AND ca.organization_id = ${organizationId}

      LEFT JOIN tasks t
        ON t.company_id = c.id
        AND t.organization_id = ${organizationId}

      WHERE c.id = ANY(${companyIds}::uuid[])
        AND c.organization_id = ${organizationId}
        AND c.deleted_at IS NULL

      GROUP BY c.id
    `
  )

  // Query 3: Seneste omsætnings-nøgletal per selskab — DISTINCT ON (én per selskab)
  // Bruger DISTINCT ON til at hente nyeste år per selskab uden subquery per selskab
  const revenueRows = await prisma.$queryRaw<
    Array<{
      company_id: string
      value: string // Prisma returnerer Decimal som string
      period_year: number
    }>
  >(
    Prisma.sql`
      SELECT DISTINCT ON (fm.company_id)
        fm.company_id,
        fm.value::text AS value,
        fm.period_year
      FROM financial_metrics fm
      WHERE fm.company_id = ANY(${companyIds}::uuid[])
        AND fm.organization_id = ${organizationId}
        AND fm.metric_type = 'OMSAETNING'
        AND fm.period_type = 'HELAAR'
      ORDER BY fm.company_id, fm.period_year DESC
    `
  )

  // Merge: build lookup maps
  const countMap = new Map(countRows.map((r) => [r.company_id, r]))
  const revenueMap = new Map(revenueRows.map((r) => [r.company_id, r]))

  return companies.map((company) => {
    const counts = countMap.get(company.id)
    const revenue = revenueMap.get(company.id)

    return {
      id: company.id,
      name: company.name,
      cvr: company.cvr,
      status: company.status,
      contractCount: counts ? Number(counts.contract_count) : 0,
      activeCaseCount: counts ? Number(counts.active_case_count) : 0,
      openTaskCount: counts ? Number(counts.open_task_count) : 0,
      latestRevenue: revenue ? parseFloat(revenue.value) : null,
      latestRevenueYear: revenue ? revenue.period_year : null,
    }
  })
}

// ==================== OFFENTLIG ACTION ====================

/**
 * getDashboardData — primær dashboard-action.
 *
 * Performance-garantier:
 * - Ingen N+1 queries (3 queries total uanset antal selskaber)
 * - Cachet i 120 sekunder per organisation
 * - $queryRaw med Prisma.sql parameterisering (SQL-injection sikker)
 * - Tenant-isoleret (organizationId på alle queries)
 *
 * Forventet query-tid: <200ms for 10 selskaber med indexes.
 * Total response med cache-miss: <500ms.
 * Total response med cache-hit: <50ms.
 */
export async function getDashboardData(): Promise<ActionResult<DashboardData>> {
  const session = await auth()
  if (!session?.user) return { error: 'Ikke autoriseret' }

  const hasModule = await canAccessModule(session.user.id, 'dashboard')
  if (!hasModule) return { error: 'Du har ikke adgang til dashboardet' }

  const organizationId = session.user.organizationId

  try {
    // Paralleliser de to cache-kald — uafhængige af hinanden
    const [summary, companies] = await Promise.all([
      getDashboardSummaryCached(organizationId),
      getDashboardCompaniesCached(organizationId),
    ])

    return {
      data: {
        companies,
        summary,
      },
    }
  } catch (error) {
    console.error('getDashboardData error:', error)
    return { error: 'Dashboard-data kunne ikke hentes — prøv igen' }
  }
}

/**
 * invalidateDashboardCache — kald ved mutations der påvirker dashboard-counts.
 *
 * Brug: revalidateTag(`dashboard:${organizationId}`) i server actions
 * ved oprettelse/sletning af: selskaber, kontrakter, sager, opgaver, frister.
 */
export async function invalidateDashboardCache(organizationId: string): Promise<void> {
  const { revalidateTag } = await import('next/cache')
  revalidateTag(`dashboard:${organizationId}`)
}