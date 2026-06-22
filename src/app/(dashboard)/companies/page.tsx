import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getCompaniesPageData } from '@/actions/companies'
import { auth } from '@/lib/auth'
import { parsePaginationParams } from '@/lib/pagination'
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

export default async function CompaniesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
}) {
  const session = await auth()
  if (!session) redirect('/login')

  const { page } = parsePaginationParams((await searchParams).page, 25)
  const rawData = await getCompaniesPageData(page, 25)

  if (!rawData || rawData.companies.length === 0) {
    return (
      <CompaniesListB
        companies={[]}
        canCreate={rawData?.canCreate ?? false}
        columns={rawData?.columns ?? { contracts: true, cases: true }}
        totalsExtra={{ persons: 0 }}
        totalCount={rawData?.totalCount ?? 0}
        page={page}
        pageSize={25}
      />
    )
  }

  const {
    companies,
    openCaseCounts,
    expiredCounts,
    expiringCounts,
    financials,
    personsCount,
    canCreate,
    columns,
    totalCount,
  } = rawData

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
      columns={columns}
      totalsExtra={{ persons: personsCount }}
      totalCount={totalCount}
      page={page}
      pageSize={25}
    />
  )
}
