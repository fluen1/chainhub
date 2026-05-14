import type { Metadata } from 'next'
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { getAccessibleCompanies } from '@/lib/permissions'
import { CompaniesListB, type CompanyRow } from './companies-list-b'

export const metadata: Metadata = { title: 'Selskaber' }

// Map dansk postnummer → region. Bruges til "Regioner"-view-mode.
function regionFromPostal(
  postal: string | null,
  city: string | null
): 'Kbh' | 'Sjælland' | 'Syd' | 'Midt' | 'Nord' | 'Ukendt' {
  if (!postal) return city ? 'Ukendt' : 'Ukendt'
  const n = parseInt(postal, 10)
  if (isNaN(n)) return 'Ukendt'
  if (n >= 1000 && n <= 2999) return 'Kbh'
  if (n >= 3000 && n <= 4999) return 'Sjælland'
  if (n >= 5000 && n <= 6999) return 'Syd'
  if (n >= 7000 && n <= 8999) return 'Midt'
  if (n >= 9000 && n <= 9999) return 'Nord'
  return 'Ukendt'
}

function formatMioShort(val: number | null): string {
  if (val == null || val === 0) return '—'
  const mio = val / 1_000_000
  if (mio >= 10) return `${mio.toFixed(0)}m`
  return `${mio.toFixed(1).replace('.', ',')}m`
}

export default async function CompaniesPage() {
  const session = await auth()
  if (!session) redirect('/login')

  const orgId = session.user.organizationId
  // Hent companyIds og userRoles parallelt — userRoles skal også med selv om
  // companyIds er tomt, så ny kunde med 0 selskaber alligevel ser "+ Opret"-CTA
  // hvis deres rolle tillader det.
  const [companyIds, userRolesInitial] = await Promise.all([
    getAccessibleCompanies(session.user.id, orgId),
    prisma.userRoleAssignment.findMany({
      where: { user_id: session.user.id },
      select: { role: true },
    }),
  ])
  const canCreateInitial = userRolesInitial.some((r) =>
    ['GROUP_OWNER', 'GROUP_ADMIN', 'GROUP_LEGAL'].includes(r.role)
  )

  if (companyIds.length === 0) {
    return (
      <CompaniesListB companies={[]} canCreate={canCreateInitial} totalsExtra={{ persons: 0 }} />
    )
  }

  const now = new Date()
  const ninetyDaysFromNow = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000)

  const [companies, openCaseCounts, expiredCounts, expiringCounts, financials, personsCount] =
    await Promise.all([
      prisma.company.findMany({
        where: {
          organization_id: orgId,
          id: { in: companyIds },
          deleted_at: null,
        },
        include: {
          _count: { select: { contracts: { where: { deleted_at: null } } } },
          ownerships: {
            where: { end_date: null },
            select: { ownership_pct: true, owner_person_id: true, owner_company_id: true },
          },
        },
        orderBy: { name: 'asc' },
      }),
      prisma.$queryRaw<Array<{ company_id: string; count: bigint }>>`
        SELECT cc.company_id, COUNT(DISTINCT c.id)::bigint as count
        FROM "CaseCompany" cc
        JOIN "Case" c ON c.id = cc.case_id
        WHERE c.organization_id = ${orgId}
          AND c.deleted_at IS NULL
          AND c.status NOT IN ('LUKKET', 'ARKIVERET')
        GROUP BY cc.company_id
      `,
      prisma.$queryRaw<Array<{ company_id: string; count: bigint }>>`
        SELECT company_id, COUNT(id)::bigint as count
        FROM "Contract"
        WHERE organization_id = ${orgId}
          AND deleted_at IS NULL
          AND status = 'UDLOBET'
        GROUP BY company_id
      `,
      prisma.$queryRaw<Array<{ company_id: string; count: bigint }>>`
        SELECT company_id, COUNT(id)::bigint as count
        FROM "Contract"
        WHERE organization_id = ${orgId}
          AND deleted_at IS NULL
          AND status = 'AKTIV'
          AND expiry_date IS NOT NULL
          AND expiry_date <= ${ninetyDaysFromNow}
          AND expiry_date > ${now}
        GROUP BY company_id
      `,
      prisma.financialMetric.findMany({
        where: {
          organization_id: orgId,
          company_id: { in: companyIds },
          period_type: 'HELAAR',
        },
        orderBy: { period_year: 'desc' },
      }),
      prisma.person.count({
        where: { organization_id: orgId, deleted_at: null },
      }),
    ])

  const openCaseMap = new Map(openCaseCounts.map((r) => [r.company_id, Number(r.count)]))
  const expiredMap = new Map(expiredCounts.map((r) => [r.company_id, Number(r.count)]))
  const expiringMap = new Map(expiringCounts.map((r) => [r.company_id, Number(r.count)]))

  // Senest finans per selskab
  const finMap = new Map<string, { revenue: number | null; ebitda: number | null }>()
  for (const f of financials) {
    const existing = finMap.get(f.company_id) ?? { revenue: null, ebitda: null }
    if (f.metric_type === 'OMSAETNING' && existing.revenue === null) {
      existing.revenue = Number(f.value)
    }
    if (f.metric_type === 'EBITDA' && existing.ebitda === null) {
      existing.ebitda = Number(f.value)
    }
    finMap.set(f.company_id, existing)
  }

  const canCreate = canCreateInitial

  const rows: CompanyRow[] = companies.map((company) => {
    const expired = expiredMap.get(company.id) ?? 0
    const expiring = expiringMap.get(company.id) ?? 0
    const openCases = openCaseMap.get(company.id) ?? 0

    // Health: kritisk hvis udløbet kontrakt eller åbne sager + udløbende, warning hvis kun udløbende, ellers ok
    let health: 'critical' | 'warning' | 'healthy' = 'healthy'
    if (expired > 0 || openCases > 1) health = 'critical'
    else if (expiring > 0 || openCases > 0) health = 'warning'

    // Kæde-ejerandel: sum af owner_company_id-ejerskaber (holding ejer)
    const groupOwnership = company.ownerships
      .filter((o) => o.owner_company_id !== null)
      .reduce((sum, o) => sum + Number(o.ownership_pct), 0)
    const partnerOwnership = company.ownerships
      .filter((o) => o.owner_person_id !== null)
      .reduce((sum, o) => sum + Number(o.ownership_pct), 0)
    const kaedePct =
      groupOwnership > 0
        ? Math.round(groupOwnership)
        : partnerOwnership > 0
          ? 100 - Math.round(partnerOwnership)
          : 100

    const fin = finMap.get(company.id)
    const revenue = fin?.revenue ?? null
    const ebitda = fin?.ebitda ?? null

    return {
      id: company.id,
      navn: company.name,
      cvr: company.cvr ?? '—',
      type: company.company_type ?? 'Andet',
      region: regionFromPostal(company.postal_code, company.city),
      city: company.city,
      kaedePct,
      kontrakter: company._count.contracts,
      kontrakterUdlob: expiring,
      kontrakterExpired: expired,
      sager: openCases,
      ebitda: ebitda,
      ebitdaShort: formatMioShort(ebitda),
      revenue,
      health,
      // Sorting score: critical → 1, warning → 2, healthy → 3 (lavere = højere prioritet)
      sortScore: health === 'critical' ? 1 : health === 'warning' ? 2 : 3,
    }
  })

  return (
    <CompaniesListB
      companies={rows}
      canCreate={canCreate}
      totalsExtra={{ persons: personsCount }}
    />
  )
}
