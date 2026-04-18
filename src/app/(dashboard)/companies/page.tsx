import type { Metadata } from 'next'
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { getAccessibleCompanies } from '@/lib/permissions'
import { PortfolioClient } from './portfolio-client'
import type { Decimal } from '@prisma/client/runtime/library'

export const metadata: Metadata = { title: 'Selskaber' }

// Typer der sendes til klienten (serialiserbare)
export interface PortfolioCompany {
  id: string
  name: string
  cvr: string | null
  city: string | null
  address: string | null
  latitude: number | null
  longitude: number | null
  status: string
  contractCount: number
  openCaseCount: number
  healthStatus: 'critical' | 'warning' | 'healthy'
  healthReasons: string[]
  partnerName: string | null
  partnerOwnershipPct: number | null
  groupOwnershipPct: number | null
  revenue: number | null
  ebitdaMargin: number | null
}

export interface PortfolioTotals {
  locationCount: number
  attentionCount: number
  totalRevenue: number | null
  avgEbitdaMargin: number | null
}

export default async function CompaniesPage() {
  const session = await auth()
  if (!session) redirect('/login')

  const orgId = session.user.organizationId
  const companyIds = await getAccessibleCompanies(session.user.id, orgId)

  const now = new Date()
  const ninetyDaysFromNow = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000)

  // Hent selskaber med relationer
  const companies = await prisma.company.findMany({
    where: {
      organization_id: orgId,
      id: { in: companyIds },
      deleted_at: null,
    },
    include: {
      _count: {
        select: {
          contracts: { where: { deleted_at: null } },
        },
      },
      ownerships: {
        where: { end_date: null },
        select: {
          ownership_pct: true,
          owner_person_id: true,
          owner_company_id: true,
        },
      },
      company_persons: {
        where: { end_date: null },
        include: {
          person: { select: { first_name: true, last_name: true } },
        },
        take: 5,
      },
    },
    orderBy: { name: 'asc' },
  })

  // Hent åbne sager pr. selskab (via CaseCompany junction)
  const openCaseCounts = await prisma.$queryRaw<Array<{ company_id: string; count: bigint }>>`
    SELECT cc.company_id, COUNT(DISTINCT c.id)::bigint as count
    FROM "CaseCompany" cc
    JOIN "Case" c ON c.id = cc.case_id
    WHERE c.organization_id = ${orgId}
      AND c.deleted_at IS NULL
      AND c.status NOT IN ('LUKKET', 'ARKIVERET')
    GROUP BY cc.company_id
  `
  const openCaseMap = new Map(openCaseCounts.map((r) => [r.company_id, Number(r.count)]))

  // Hent udløbne kontrakter pr. selskab
  const expiredCounts = await prisma.$queryRaw<Array<{ company_id: string; count: bigint }>>`
    SELECT company_id, COUNT(id)::bigint as count
    FROM "Contract"
    WHERE organization_id = ${orgId}
      AND deleted_at IS NULL
      AND status = 'UDLOBET'
    GROUP BY company_id
  `
  const expiredMap = new Map(expiredCounts.map((r) => [r.company_id, Number(r.count)]))

  // Hent kontrakter der udløber inden 90 dage
  const expiringCounts = await prisma.$queryRaw<Array<{ company_id: string; count: bigint }>>`
    SELECT company_id, COUNT(id)::bigint as count
    FROM "Contract"
    WHERE organization_id = ${orgId}
      AND deleted_at IS NULL
      AND status = 'AKTIV'
      AND expiry_date IS NOT NULL
      AND expiry_date <= ${ninetyDaysFromNow}
      AND expiry_date > ${now}
    GROUP BY company_id
  `
  const expiringMap = new Map(expiringCounts.map((r) => [r.company_id, Number(r.count)]))

  // Hent finansielle data (seneste helår)
  const financials = await prisma.financialMetric.findMany({
    where: {
      organization_id: orgId,
      company_id: { in: companyIds },
      period_type: 'HELAAR',
    },
    orderBy: { period_year: 'desc' },
  })

  // Gruppér finansielle data pr. selskab (seneste år)
  const finMap = new Map<string, { revenue: number | null; ebitda: number | null }>()
  for (const f of financials) {
    const existing = finMap.get(f.company_id)
    if (!existing) {
      finMap.set(f.company_id, { revenue: null, ebitda: null })
    }
    const entry = finMap.get(f.company_id)!
    if (f.metric_type === 'OMSAETNING' && entry.revenue === null) {
      entry.revenue = Number(f.value)
    }
    if (f.metric_type === 'EBITDA' && entry.ebitda === null) {
      entry.ebitda = Number(f.value)
    }
  }

  // Check om brugeren kan oprette selskaber
  const userRoles = await prisma.userRoleAssignment.findMany({
    where: { user_id: session.user.id },
    select: { role: true },
  })
  const canCreate = userRoles.some((r) =>
    ['GROUP_OWNER', 'GROUP_ADMIN', 'GROUP_LEGAL'].includes(r.role)
  )

  // Map til klient-typer
  const mapped: PortfolioCompany[] = companies.map((company) => {
    const expired = expiredMap.get(company.id) ?? 0
    const expiring = expiringMap.get(company.id) ?? 0
    const openCases = openCaseMap.get(company.id) ?? 0

    // Bestem health status
    let healthStatus: 'critical' | 'warning' | 'healthy' = 'healthy'
    const healthReasons: string[] = []

    if (expired > 0) {
      healthReasons.push(
        `${expired} udløb${expired === 1 ? 'et' : 'ne'} kontrakt${expired === 1 ? '' : 'er'}`
      )
    }
    if (openCases > 0) {
      healthReasons.push(`${openCases} åben ${openCases === 1 ? 'sag' : 'sager'}`)
    }
    if (expiring > 0) {
      healthReasons.push(`${expiring} kontrakt${expiring === 1 ? '' : 'er'} udløber snart`)
    }

    if (expired > 0 || openCases > 0) {
      healthStatus = 'critical'
    } else if (expiring > 0) {
      healthStatus = 'warning'
    }

    // Find partner (lokal ejer — person-ejerskab)
    const partnerOwnership = company.ownerships.find((o) => o.owner_person_id !== null)
    const groupOwnership = company.ownerships.find((o) => o.owner_company_id !== null)

    // Find partnernavn fra company_persons (Direktør eller lignende)
    let partnerName: string | null = null
    if (partnerOwnership) {
      const partnerPerson = company.company_persons.find(
        (cp) => cp.person_id === partnerOwnership.owner_person_id
      )
      if (partnerPerson) {
        partnerName = `${partnerPerson.person.first_name} ${partnerPerson.person.last_name}`
      }
    }
    // Fallback: brug første Direktør
    if (!partnerName && company.company_persons.length > 0) {
      const director = company.company_persons.find((cp) => cp.role === 'Direktør')
      const person = director ?? company.company_persons[0]
      partnerName = `${person.person.first_name} ${person.person.last_name}`
    }

    // Finansielle data
    const fin = finMap.get(company.id)
    const revenue = fin?.revenue ?? null
    const ebitda = fin?.ebitda ?? null
    const ebitdaMargin = revenue && ebitda ? ebitda / revenue : null

    return {
      id: company.id,
      name: company.name,
      cvr: company.cvr,
      city: company.city,
      address: company.address,
      latitude: company.latitude,
      longitude: company.longitude,
      status: company.status,
      contractCount: company._count.contracts,
      openCaseCount: openCases,
      healthStatus,
      healthReasons,
      partnerName,
      partnerOwnershipPct: partnerOwnership
        ? Number(partnerOwnership.ownership_pct as Decimal)
        : null,
      groupOwnershipPct: groupOwnership ? Number(groupOwnership.ownership_pct as Decimal) : null,
      revenue,
      ebitdaMargin,
    }
  })

  // Beregn totals
  const attentionCount = mapped.filter((c) => c.healthStatus !== 'healthy').length
  const revenueSum = mapped.reduce((sum, c) => sum + (c.revenue ?? 0), 0)
  const marginsWithData = mapped.filter((c) => c.ebitdaMargin !== null)
  const avgMargin =
    marginsWithData.length > 0
      ? marginsWithData.reduce((sum, c) => sum + (c.ebitdaMargin ?? 0), 0) / marginsWithData.length
      : null

  const totals: PortfolioTotals = {
    locationCount: mapped.length,
    attentionCount,
    totalRevenue: revenueSum > 0 ? revenueSum : null,
    avgEbitdaMargin: avgMargin,
  }

  return <PortfolioClient companies={mapped} totals={totals} canCreate={canCreate} />
}
