import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { getAccessibleCompanies } from '@/lib/permissions'
import { Building2, Plus } from 'lucide-react'
import Link from 'next/link'
import { getCompanyStatusLabel, getCompanyStatusStyle } from '@/lib/labels'
import { Suspense } from 'react'
import { SearchAndFilter } from '@/components/ui/SearchAndFilter'
import { Pagination } from '@/components/ui/Pagination'
import { parsePaginationParams } from '@/lib/pagination'
import type { Prisma } from '@prisma/client'

const PAGE_SIZE = 20

const STATUS_FILTER_OPTIONS = [
  { value: 'aktiv', label: 'Aktiv' },
  { value: 'under_stiftelse', label: 'Under stiftelse' },
  { value: 'under_afvikling', label: 'Under afvikling' },
  { value: 'solgt', label: 'Solgt' },
]

type CompanyWithRelations = Prisma.CompanyGetPayload<{
  include: {
    _count: {
      select: {
        contracts: true
        cases: true
      }
    }
    company_persons: {
      include: {
        person: {
          select: {
            first_name: true
            last_name: true
          }
        }
      }
    }
  }
}> & { _overdueTaskCount?: number }

interface CompaniesPageProps {
  searchParams: {
    q?: string
    status?: string
    page?: string
  }
}

export default async function CompaniesPage({ searchParams }: CompaniesPageProps) {
  const session = await auth()
  if (!session) redirect('/login')

  const { page, skip, take } = parsePaginationParams(searchParams.page, PAGE_SIZE)
  const q = searchParams.q?.trim() ?? ''
  const statusFilter = searchParams.status ?? ''

  const companyIds = await getAccessibleCompanies(
    session.user.id,
    session.user.organizationId
  )

  const baseWhere: Prisma.CompanyWhereInput = {
    organization_id: session.user.organizationId,
    id: { in: companyIds },
    deleted_at: null,
  }

  if (q) {
    baseWhere.OR = [
      { name: { contains: q, mode: 'insensitive' } },
      { cvr: { contains: q, mode: 'insensitive' } },
    ]
  }

  if (statusFilter) {
    baseWhere.status = statusFilter
  }

  const now = new Date()

  const [companies, totalCount, overdueTasks] = await Promise.all([
    prisma.company.findMany({
      where: baseWhere,
      include: {
        _count: {
          select: {
            contracts: { where: { deleted_at: null } },
            cases: true,
          },
        },
        company_persons: {
          where: { end_date: null },
          include: {
            person: { select: { first_name: true, last_name: true } },
          },
          take: 10,
        },
      },
      orderBy: { name: 'asc' },
      skip,
      take,
    }) as Promise<CompanyWithRelations[]>,
    prisma.company.count({ where: baseWhere }),
    prisma.$queryRaw<Array<{ company_id: string; count: bigint }>>`
      SELECT cc.company_id, COUNT(t.id)::bigint as count
      FROM "Task" t
      JOIN "CaseCompany" cc ON cc.case_id = t.case_id
      WHERE t.organization_id = ${session.user.organizationId}
        AND t.deleted_at IS NULL
        AND t.status IN ('NY', 'AKTIV', 'AFVENTER')
        AND t.due_date < ${now}
        AND t.case_id IS NOT NULL
      GROUP BY cc.company_id
    `,
  ])

  // Merge overdue task counts into companies
  const overdueMap = new Map(
    overdueTasks.map((t) => [t.company_id, Number(t.count)])
  )
  for (const company of companies) {
    company._overdueTaskCount = overdueMap.get(company.id) ?? 0
  }

  // Sort company_persons by governance role priority and take top 2
  const rolePriority = ['Direktør', 'Bestyrelsesformand', 'Bestyrelsesmedlem', 'Tegningsberettiget', 'Revisor']
  for (const company of companies) {
    company.company_persons.sort((a, b) => {
      const ai = rolePriority.indexOf(a.role)
      const bi = rolePriority.indexOf(b.role)
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi)
    })
    company.company_persons = company.company_persons.slice(0, 2)
  }

  const userRoles = await prisma.userRoleAssignment.findMany({
    where: { user_id: session.user.id },
    select: { role: true },
  })
  const canCreate = userRoles.some((r) =>
    ['GROUP_OWNER', 'GROUP_ADMIN', 'GROUP_LEGAL'].includes(r.role)
  )

  // Determine left-border accent per company
  function getCardAccent(overdue: number, status: string): string {
    if (overdue > 0) return 'border-l-red-400'
    if (status === 'under_stiftelse') return 'border-l-amber-400'
    if (status === 'under_afvikling' || status === 'solgt') return 'border-l-gray-300'
    return 'border-l-emerald-400'
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-gray-900">
            Selskaber
          </h1>
          <p className="mt-0.5 text-sm text-gray-400">
            {totalCount} i porteføljen
          </p>
        </div>
        {canCreate && (
          <Link
            href="/companies/new"
            className="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-800"
          >
            <Plus className="h-4 w-4" />
            Nyt selskab
          </Link>
        )}
      </div>

      {/* Søgning + filtre */}
      <Suspense fallback={null}>
        <SearchAndFilter
          placeholder="Søg på navn eller CVR..."
          filters={[
            {
              key: 'status',
              label: 'Status',
              options: STATUS_FILTER_OPTIONS,
            },
          ]}
        />
      </Suspense>

      {/* Resultat */}
      {companies.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-200 py-16 text-center">
          <Building2 className="mx-auto h-10 w-10 text-gray-300" />
          {q || statusFilter ? (
            <>
              <p className="mt-3 text-sm font-medium text-gray-900">
                Ingen resultater
              </p>
              <p className="mt-1 text-sm text-gray-400">
                Prøv et andet søgeord eller ryd filtrene.
              </p>
            </>
          ) : (
            <>
              <p className="mt-3 text-sm font-medium text-gray-900">
                Ingen selskaber endnu
              </p>
              <p className="mt-1 text-sm text-gray-400">
                Opret dit første selskab for at komme i gang.
              </p>
              {canCreate && (
                <Link
                  href="/companies/new"
                  className="mt-4 inline-flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
                >
                  <Plus className="h-4 w-4" />
                  Opret selskab
                </Link>
              )}
            </>
          )}
        </div>
      ) : (
        <>
          {/* Card-grid */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {companies.map((company) => {
              const overdue = company._overdueTaskCount ?? 0
              const accent = getCardAccent(overdue, company.status ?? '')

              return (
                <Link
                  key={company.id}
                  href={`/companies/${company.id}`}
                  className={`group relative flex flex-col rounded-lg border border-l-[3px] bg-white px-5 py-4 transition-all hover:shadow-md hover:-translate-y-px ${accent}`}
                >
                  {/* Navn */}
                  <h3 className="text-[15px] font-semibold leading-snug text-gray-900 group-hover:text-blue-600 transition-colors">
                    {company.name}
                  </h3>

                  {/* Meta-linje: CVR + status */}
                  <div className="mt-1 flex items-center gap-2 flex-wrap">
                    {company.cvr && (
                      <span className="text-xs tabular-nums text-gray-400">
                        {company.cvr}
                      </span>
                    )}
                    <span
                      className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium leading-none ${getCompanyStatusStyle(company.status ?? '')}`}
                    >
                      {getCompanyStatusLabel(company.status ?? '')}
                    </span>
                  </div>

                  {/* Nøgleperson — kun den vigtigste */}
                  {company.company_persons.length > 0 && (
                    <p className="mt-2.5 text-xs text-gray-500 truncate">
                      <span className="text-gray-400">{company.company_persons[0].role}</span>
                      {' '}
                      {company.company_persons[0].person.first_name} {company.company_persons[0].person.last_name}
                    </p>
                  )}

                  {/* Spacer */}
                  <div className="flex-1" />

                  {/* KPI-linje + urgency — altid nederst */}
                  <div className="mt-3 flex items-center gap-3 border-t border-gray-100 pt-3 text-xs tabular-nums">
                    {company._count.contracts > 0 && (
                      <span className="text-gray-500">
                        <span className="font-medium text-gray-700">{company._count.contracts}</span> kontrakt{company._count.contracts !== 1 ? 'er' : ''}
                      </span>
                    )}
                    {company._count.cases > 0 && (
                      <span className="text-gray-500">
                        <span className="font-medium text-gray-700">{company._count.cases}</span> sag{company._count.cases !== 1 ? 'er' : ''}
                      </span>
                    )}
                    {overdue > 0 && (
                      <span className="ml-auto text-red-600 font-medium">
                        {overdue} forfalden{overdue !== 1 ? 'e' : ''}
                      </span>
                    )}
                  </div>
                </Link>
              )
            })}
          </div>

          {/* Pagination */}
          <Suspense fallback={null}>
            <Pagination
              currentPage={page}
              totalCount={totalCount}
              pageSize={PAGE_SIZE}
            />
          </Suspense>
        </>
      )}
    </div>
  )
}
