import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { getAccessibleCompanies } from '@/lib/permissions'
import { Building2, Plus } from 'lucide-react'
import Link from 'next/link'
import { getCompanyStatusLabel, getCompanyStatusStyle } from '@/lib/labels'
import { Suspense } from 'react'
import { SearchAndFilter } from '@/components/ui/SearchAndFilter'
import { Pagination, parsePaginationParams } from '@/components/ui/Pagination'
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
}>

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
    id: companyIds.length > 0 ? { in: companyIds } : undefined,
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

  const [companies, totalCount] = await Promise.all([
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
          orderBy: { start_date: 'asc' },
          take: 2,
        },
      },
      orderBy: { name: 'asc' },
      skip,
      take,
    }) as Promise<CompanyWithRelations[]>,
    prisma.company.count({ where: baseWhere }),
  ])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Selskaber</h1>
          <p className="mt-1 text-sm text-gray-500">
            {totalCount} selskab{totalCount !== 1 ? 'er' : ''} i porteføljen
          </p>
        </div>
        <Link
          href="/companies/new"
          className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          Nyt selskab
        </Link>
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
        <div className="rounded-lg border-2 border-dashed border-gray-300 p-12 text-center">
          <Building2 className="mx-auto h-12 w-12 text-gray-400" />
          {q || statusFilter ? (
            <>
              <h3 className="mt-2 text-sm font-semibold text-gray-900">
                Ingen selskaber matcher søgningen
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                Prøv et andet søgeord eller ryd filtrene.
              </p>
            </>
          ) : (
            <>
              <h3 className="mt-2 text-sm font-semibold text-gray-900">
                Ingen selskaber endnu
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                Opret dit første selskab for at komme i gang.
              </p>
              <Link
                href="/companies/new"
                className="mt-4 inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                <Plus className="h-4 w-4" />
                Opret selskab
              </Link>
            </>
          )}
        </div>
      ) : (
        <>
          {/* Card-grid */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {companies.map((company) => (
              <Link
                key={company.id}
                href={`/companies/${company.id}`}
                className="group rounded-lg border bg-white p-5 shadow-sm hover:border-blue-300 hover:shadow-md transition-all"
              >
                {/* Navn + status */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-gray-900 group-hover:text-blue-600 truncate">
                      {company.name}
                    </h3>
                    {company.cvr && (
                      <p className="text-xs text-gray-400 mt-0.5">
                        CVR: {company.cvr}
                        {company.company_type && ` · ${company.company_type}`}
                      </p>
                    )}
                  </div>
                  <span
                    className={`ml-2 flex-shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${getCompanyStatusStyle(company.status ?? '')}`}
                  >
                    {getCompanyStatusLabel(company.status ?? '')}
                  </span>
                </div>

                {/* Nøglepersoner */}
                {company.company_persons.length > 0 && (
                  <div className="mb-3 space-y-0.5">
                    {company.company_persons.map((cp) => (
                      <p key={cp.id} className="text-xs text-gray-500 truncate">
                        <span className="text-gray-400">{cp.role}:</span>{' '}
                        {cp.person.first_name} {cp.person.last_name}
                      </p>
                    ))}
                  </div>
                )}

                {/* KPI-linje */}
                <div className="flex items-center gap-2 text-xs text-gray-400 flex-wrap">
                  <span>
                    {company._count.contracts} kontrakt{company._count.contracts !== 1 ? 'er' : ''}
                  </span>
                  {company._count.cases > 0 && (
                    <>
                      <span>·</span>
                      <span>
                        {company._count.cases} sag{company._count.cases !== 1 ? 'er' : ''}
                      </span>
                    </>
                  )}
                </div>
              </Link>
            ))}
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
