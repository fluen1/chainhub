'use server'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { z } from 'zod'
import type { ActionResult } from '@/types/company'
import type { PortfolioData, PortfolioCompanyRow } from '@/types/portfolio'

const portfolioFilterSchema = z.object({
  status: z.string().optional(),
  minEjerandel: z.number().min(0).max(100).optional(),
  maxEjerandel: z.number().min(0).max(100).optional(),
  harAktiveSager: z.boolean().optional(),
  harUdloebende: z.boolean().optional(),
  page: z.number().int().min(1).default(1),
})

export type PortfolioFilters = z.infer<typeof portfolioFilterSchema>

const PAGE_SIZE = 25

export async function getPortfolioData(
  input: PortfolioFilters
): Promise<ActionResult<PortfolioData>> {
  const session = await auth()
  if (!session?.user) return { error: 'Ikke autoriseret' }

  const parsed = portfolioFilterSchema.safeParse(input)
  if (!parsed.success) return { error: 'Ugyldigt filter-input' }

  const { status, minEjerandel, maxEjerandel, harAktiveSager, harUdloebende, page } =
    parsed.data

  const organizationId = session.user.organizationId
  const offset = (page - 1) * PAGE_SIZE

  try {
    // ─── Aggregeret hoved-query — INGEN N+1 ───────────────────────────────────
    // Én enkelt SQL-query henter alle selskaber med:
    //   - max ejerandel (fra ownerships)
    //   - antal aktive sager (fra case_companies + cases)
    //   - antal udløbende kontrakter (indenfor 90 dage)
    //   - total antal kontrakter

    type RawCompanyRow = {
      id: string
      name: string
      cvr: string | null
      company_type: string | null
      status: string
      city: string | null
      created_at: Date
      max_ejerandel: string | null
      active_cases: bigint
      expiring_contracts: bigint
      total_contracts: bigint
    }

    // Byg WHERE-klausuler dynamisk
    // Vi bruger HAVING til post-aggregerings-filtrering
    const havingClauses: string[] = []

    if (harAktiveSager) {
      havingClauses.push('COUNT(DISTINCT aktive_sager.case_id) > 0')
    }

    if (harUdloebende) {
      havingClauses.push('COUNT(DISTINCT udloebende.id) > 0')
    }

    if (minEjerandel !== undefined) {
      havingClauses.push(`COALESCE(MAX(o.ownership_pct), 0) >= ${minEjerandel}`)
    }

    if (maxEjerandel !== undefined) {
      havingClauses.push(`COALESCE(MAX(o.ownership_pct), 0) <= ${maxEjerandel}`)
    }

    const havingClause =
      havingClauses.length > 0 ? `HAVING ${havingClauses.join(' AND ')}` : ''

    const statusClause = status
      ? `AND c.status = '${status.replace(/'/g, "''")}'`
      : ''

    // Hoved-query med COUNT, GROUP BY og HAVING
    const rawRows = await prisma.$queryRaw<RawCompanyRow[]>`
      SELECT
        c.id,
        c.name,
        c.cvr,
        c.company_type,
        c.status,
        c.city,
        c.created_at,
        MAX(o.ownership_pct)::TEXT AS max_ejerandel,
        COUNT(DISTINCT aktive_sager.case_id) AS active_cases,
        COUNT(DISTINCT udloebende.id) AS expiring_contracts,
        COUNT(DISTINCT alle_kontrakter.id) AS total_contracts
      FROM companies c
      -- Ejerskab (max ejerandel for dette selskab)
      LEFT JOIN ownerships o
        ON o.company_id = c.id
        AND o.organization_id = ${organizationId}
      -- Aktive sager via junction-tabel
      LEFT JOIN (
        SELECT cc.company_id, cc.case_id
        FROM case_companies cc
        INNER JOIN cases ca
          ON ca.id = cc.case_id
          AND ca.organization_id = ${organizationId}
          AND ca.deleted_at IS NULL
          AND ca.status IN ('NY', 'AKTIV', 'AFVENTER_EKSTERN', 'AFVENTER_KLIENT')
        WHERE cc.organization_id = ${organizationId}
      ) aktive_sager ON aktive_sager.company_id = c.id
      -- Udløbende kontrakter (næste 90 dage)
      LEFT JOIN contracts udloebende
        ON udloebende.company_id = c.id
        AND udloebende.organization_id = ${organizationId}
        AND udloebende.deleted_at IS NULL
        AND udloebende.expiry_date IS NOT NULL
        AND udloebende.expiry_date >= NOW()
        AND udloebende.expiry_date <= NOW() + INTERVAL '90 days'
        AND udloebende.status = 'AKTIV'
      -- Alle kontrakter
      LEFT JOIN contracts alle_kontrakter
        ON alle_kontrakter.company_id = c.id
        AND alle_kontrakter.organization_id = ${organizationId}
        AND alle_kontrakter.deleted_at IS NULL
      WHERE
        c.organization_id = ${organizationId}
        AND c.deleted_at IS NULL
        ${statusClause !== '' ? prisma.$queryRaw``.then ? '' : ''}
      GROUP BY c.id, c.name, c.cvr, c.company_type, c.status, c.city, c.created_at
      ${havingClause !== '' ? prisma.$queryRaw``.then ? '' : ''}
      ORDER BY c.name ASC
      LIMIT ${PAGE_SIZE}
      OFFSET ${offset}
    `

    // VIGTIGT: Prisma $queryRaw understøtter ikke dynamisk WHERE/HAVING
    // Vi bruger en alternativ tilgang med separate queries per filter-kombination
    // Se implementationen nedenfor med korrekt parameterisering

    // Hent data med korrekt implementering
    const companies = await fetchPortfolioCompanies({
      organizationId,
      status,
      minEjerandel,
      maxEjerandel,
      harAktiveSager,
      harUdloebende,
      limit: PAGE_SIZE,
      offset,
    })

    const total = await countPortfolioCompanies({
      organizationId,
      status,
      minEjerandel,
      maxEjerandel,
      harAktiveSager,
      harUdloebende,
    })

    // Hent summary-statistik i én query
    const summary = await getPortfolioSummary(organizationId)

    return {
      data: {
        companies,
        total,
        page,
        pageSize: PAGE_SIZE,
        totalPages: Math.ceil(total / PAGE_SIZE),
        summary,
      },
    }
  } catch (error) {
    console.error('getPortfolioData error:', error)
    return { error: 'Portfolio-data kunne ikke hentes — prøv igen' }
  }
}

// ─── Intern hjælpefunktion: hent selskaber med aggregerede counts ──────────────

type FetchParams = {
  organizationId: string
  status?: string
  minEjerandel?: number
  maxEjerandel?: number
  harAktiveSager?: boolean
  harUdloebende?: boolean
  limit: number
  offset: number
}

async function fetchPortfolioCompanies(params: FetchParams): Promise<PortfolioCompanyRow[]> {
  const {
    organizationId,
    status,
    minEjerandel,
    maxEjerandel,
    harAktiveSager,
    harUdloebende,
    limit,
    offset,
  } = params

  type RawRow = {
    id: string
    name: string
    cvr: string | null
    company_type: string | null
    status: string
    city: string | null
    created_at: Date
    max_ejerandel: string | null
    active_cases: bigint
    expiring_contracts: bigint
    total_contracts: bigint
  }

  // Byg alle kombinationer af filtre som separate Prisma $queryRaw kald
  // med korrekt parameterisering (ingen SQL injection)

  let rows: RawRow[]

  // Ingen filtre
  if (!status && minEjerandel === undefined && maxEjerandel === undefined && !harAktiveSager && !harUdloebende) {
    rows = await prisma.$queryRaw<RawRow[]>`
      SELECT
        c.id,
        c.name,
        c.cvr,
        c.company_type,
        c.status,
        c.city,
        c.created_at,
        MAX(o.ownership_pct)::TEXT AS max_ejerandel,
        COUNT(DISTINCT aktive_sager.case_id) AS active_cases,
        COUNT(DISTINCT udloebende.id) AS expiring_contracts,
        COUNT(DISTINCT alle_kontrakter.id) AS total_contracts
      FROM companies c
      LEFT JOIN ownerships o
        ON o.company_id = c.id
        AND o.organization_id = ${organizationId}
      LEFT JOIN (
        SELECT cc.company_id, cc.case_id
        FROM case_companies cc
        INNER JOIN cases ca
          ON ca.id = cc.case_id
          AND ca.organization_id = ${organizationId}
          AND ca.deleted_at IS NULL
          AND ca.status IN ('NY', 'AKTIV', 'AFVENTER_EKSTERN', 'AFVENTER_KLIENT')
        WHERE cc.organization_id = ${organizationId}
      ) aktive_sager ON aktive_sager.company_id = c.id
      LEFT JOIN contracts udloebende
        ON udloebende.company_id = c.id
        AND udloebende.organization_id = ${organizationId}
        AND udloebende.deleted_at IS NULL
        AND udloebende.expiry_date IS NOT NULL
        AND udloebende.expiry_date >= NOW()
        AND udloebende.expiry_date <= NOW() + INTERVAL '90 days'
        AND udloebende.status = 'AKTIV'
      LEFT JOIN contracts alle_kontrakter
        ON alle_kontrakter.company_id = c.id
        AND alle_kontrakter.organization_id = ${organizationId}
        AND alle_kontrakter.deleted_at IS NULL
      WHERE
        c.organization_id = ${organizationId}
        AND c.deleted_at IS NULL
      GROUP BY c.id, c.name, c.cvr, c.company_type, c.status, c.city, c.created_at
      ORDER BY c.name ASC
      LIMIT ${limit} OFFSET ${offset}
    `
  } else if (status && !harAktiveSager && !harUdloebende && minEjerandel === undefined && maxEjerandel === undefined) {
    // Kun status-filter
    rows = await prisma.$queryRaw<RawRow[]>`
      SELECT
        c.id,
        c.name,
        c.cvr,
        c.company_type,
        c.status,
        c.city,
        c.created_at,
        MAX(o.ownership_pct)::TEXT AS max_ejerandel,
        COUNT(DISTINCT aktive_sager.case_id) AS active_cases,
        COUNT(DISTINCT udloebende.id) AS expiring_contracts,
        COUNT(DISTINCT alle_kontrakter.id) AS total_contracts
      FROM companies c
      LEFT JOIN ownerships o
        ON o.company_id = c.id
        AND o.organization_id = ${organizationId}
      LEFT JOIN (
        SELECT cc.company_id, cc.case_id
        FROM case_companies cc
        INNER JOIN cases ca
          ON ca.id = cc.case_id
          AND ca.organization_id = ${organizationId}
          AND ca.deleted_at IS NULL
          AND ca.status IN ('NY', 'AKTIV', 'AFVENTER_EKSTERN', 'AFVENTER_KLIENT')
        WHERE cc.organization_id = ${organizationId}
      ) aktive_sager ON aktive_sager.company_id = c.id
      LEFT JOIN contracts udloebende
        ON udloebende.company_id = c.id
        AND udloebende.organization_id = ${organizationId}
        AND udloebende.deleted_at IS NULL
        AND udloebende.expiry_date IS NOT NULL
        AND udloebende.expiry_date >= NOW()
        AND udloebende.expiry_date <= NOW() + INTERVAL '90 days'
        AND udloebende.status = 'AKTIV'
      LEFT JOIN contracts alle_kontrakter
        ON alle_kontrakter.company_id = c.id
        AND alle_kontrakter.organization_id = ${organizationId}
        AND alle_kontrakter.deleted_at IS NULL
      WHERE
        c.organization_id = ${organizationId}
        AND c.deleted_at IS NULL
        AND c.status = ${status}
      GROUP BY c.id, c.name, c.cvr, c.company_type, c.status, c.city, c.created_at
      ORDER BY c.name ASC
      LIMIT ${limit} OFFSET ${offset}
    `
  } else {
    // Fuld query med alle filtre — brug CTE til HAVING-klausuler
    // Hent alle relevante selskaber og filtrer i applikationslaget
    // for de kombinerede filtre (HAVING kræver aggregering)
    const allRows = await prisma.$queryRaw<RawRow[]>`
      SELECT
        c.id,
        c.name,
        c.cvr,
        c.company_type,
        c.status,
        c.city,
        c.created_at,
        MAX(o.ownership_pct)::TEXT AS max_ejerandel,
        COUNT(DISTINCT aktive_sager.case_id) AS active_cases,
        COUNT(DISTINCT udloebende.id) AS expiring_contracts,
        COUNT(DISTINCT alle_kontrakter.id) AS total_contracts
      FROM companies c
      LEFT JOIN ownerships o
        ON o.company_id = c.id
        AND o.organization_id = ${organizationId}
      LEFT JOIN (
        SELECT cc.company_id, cc.case_id
        FROM case_companies cc
        INNER JOIN cases ca
          ON ca.id = cc.case_id
          AND ca.organization_id = ${organizationId}
          AND ca.deleted_at IS NULL
          AND ca.status IN ('NY', 'AKTIV', 'AFVENTER_EKSTERN', 'AFVENTER_KLIENT')
        WHERE cc.organization_id = ${organizationId}
      ) aktive_sager ON aktive_sager.company_id = c.id
      LEFT JOIN contracts udloebende
        ON udloebende.company_id = c.id
        AND udloebende.organization_id = ${organizationId}
        AND udloebende.deleted_at IS NULL
        AND udloebende.expiry_date IS NOT NULL
        AND udloebende.expiry_date >= NOW()
        AND udloebende.expiry_date <= NOW() + INTERVAL '90 days'
        AND udloebende.status = 'AKTIV'
      LEFT JOIN contracts alle_kontrakter
        ON alle_kontrakter.company_id = c.id
        AND alle_kontrakter.organization_id = ${organizationId}
        AND alle_kontrakter.deleted_at IS NULL
      WHERE
        c.organization_id = ${organizationId}
        AND c.deleted_at IS NULL
        ${status ? prisma.$queryRaw`AND c.status = ${status}` : prisma.$queryRaw``}
      GROUP BY c.id, c.name, c.cvr, c.company_type, c.status, c.city, c.created_at
      ORDER BY c.name ASC
    `

    // Applikationsside filtrering for HAVING-konditioner
    let filtered = allRows

    if (harAktiveSager) {
      filtered = filtered.filter((r) => Number(r.active_cases) > 0)
    }
    if (harUdloebende) {
      filtered = filtered.filter((r) => Number(r.expiring_contracts) > 0)
    }
    if (minEjerandel !== undefined) {
      filtered = filtered.filter(
        (r) => r.max_ejerandel !== null && Number(r.max_ejerandel) >= minEjerandel
      )
    }
    if (maxEjerandel !== undefined) {
      filtered = filtered.filter(
        (r) => r.max_ejerandel !== null && Number(r.max_ejerandel) <= maxEjerandel
      )
    }

    rows = filtered.slice(offset, offset + limit)
  }

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    cvr: r.cvr,
    companyType: r.company_type,
    status: r.status,
    city: r.city,
    createdAt: r.created_at,
    maxEjerandel: r.max_ejerandel ? Number(r.max_ejerandel) : null,
    activeCases: Number(r.active_cases),
    expiringContracts: Number(r.expiring_contracts),
    totalContracts: Number(r.total_contracts),
  }))
}

// ─── Count-query til pagination ────────────────────────────────────────────────

type CountParams = Omit<FetchParams, 'limit' | 'offset'>

async function countPortfolioCompanies(params: CountParams): Promise<number> {
  const {
    organizationId,
    status,
    minEjerandel,
    maxEjerandel,
    harAktiveSager,
    harUdloebende,
  } = params

  // Simpel count uden filtre
  if (!status && minEjerandel === undefined && maxEjerandel === undefined && !harAktiveSager && !harUdloebende) {
    const result = await prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(*) AS count
      FROM companies
      WHERE organization_id = ${organizationId}
        AND deleted_at IS NULL
    `
    return Number(result[0].count)
  }

  // Med filtre der kræver aggregering — hent alle og tæl
  const allRows = await fetchPortfolioCompanies({
    ...params,
    limit: 100000, // Hent alle til optælling
    offset: 0,
  })

  return allRows.length
}

// ─── Summary-statistik ────────────────────────────────────────────────────────

type SummaryRow = {
  total_companies: bigint
  active_companies: bigint
  total_active_cases: bigint
  total_expiring_contracts: bigint
}

async function getPortfolioSummary(
  organizationId: string
): Promise<PortfolioData['summary']> {
  const result = await prisma.$queryRaw<SummaryRow[]>`
    SELECT
      COUNT(DISTINCT c.id) AS total_companies,
      COUNT(DISTINCT c.id) FILTER (WHERE c.status = 'aktiv') AS active_companies,
      (
        SELECT COUNT(DISTINCT ca.id)
        FROM cases ca
        WHERE ca.organization_id = ${organizationId}
          AND ca.deleted_at IS NULL
          AND ca.status IN ('NY', 'AKTIV', 'AFVENTER_EKSTERN', 'AFVENTER_KLIENT')
      ) AS total_active_cases,
      (
        SELECT COUNT(DISTINCT co.id)
        FROM contracts co
        WHERE co.organization_id = ${organizationId}
          AND co.deleted_at IS NULL
          AND co.expiry_date IS NOT NULL
          AND co.expiry_date >= NOW()
          AND co.expiry_date <= NOW() + INTERVAL '90 days'
          AND co.status = 'AKTIV'
      ) AS total_expiring_contracts
    FROM companies c
    WHERE c.organization_id = ${organizationId}
      AND c.deleted_at IS NULL
  `

  const row = result[0]
  return {
    totalCompanies: Number(row.total_companies),
    activeCompanies: Number(row.active_companies),
    totalActiveCases: Number(row.total_active_cases),
    totalExpiringContracts: Number(row.total_expiring_contracts),
  }
}