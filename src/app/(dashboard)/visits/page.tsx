import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { getAccessibleCompanies } from '@/lib/permissions'
import { MapPin, Plus } from 'lucide-react'
import Link from 'next/link'
import { Suspense } from 'react'
import { SearchAndFilter } from '@/components/ui/SearchAndFilter'
import { Pagination } from '@/components/ui/Pagination'
import { parsePaginationParams } from '@/lib/pagination'
import {
  getVisitTypeLabel,
  getVisitStatusLabel,
  getVisitStatusStyle,
  VISIT_TYPE_LABELS,
  VISIT_STATUS_LABELS,
} from '@/lib/labels'

const PAGE_SIZE = 20

const STATUS_OPTIONS = Object.entries(VISIT_STATUS_LABELS).map(
  ([value, label]) => ({ value, label })
)

const TYPE_OPTIONS = Object.entries(VISIT_TYPE_LABELS).map(
  ([value, label]) => ({ value, label })
)

interface VisitsPageProps {
  searchParams: {
    q?: string
    status?: string
    type?: string
    company?: string
    page?: string
  }
}

export default async function VisitsPage({ searchParams }: VisitsPageProps) {
  const session = await auth()
  if (!session) redirect('/login')

  const { page, skip, take } = parsePaginationParams(searchParams.page, PAGE_SIZE)
  const q = searchParams.q?.trim() ?? ''
  const statusFilter = searchParams.status
  const typeFilter = searchParams.type
  const companyFilter = searchParams.company

  const companyIds = await getAccessibleCompanies(
    session.user.id,
    session.user.organizationId
  )

  const companyOptions =
    companyIds.length > 0
      ? (
          await prisma.company.findMany({
            where: {
              id: { in: companyIds },
              organization_id: session.user.organizationId,
              deleted_at: null,
            },
            select: { id: true, name: true },
            orderBy: { name: 'asc' },
          })
        ).map((c) => ({ value: c.id, label: c.name }))
      : []

  const effectiveCompanyIds = companyFilter
    ? companyIds.includes(companyFilter)
      ? [companyFilter]
      : []
    : companyIds

  const filters = [
    { key: 'company', label: 'Selskab', options: companyOptions },
    { key: 'status', label: 'Status', options: STATUS_OPTIONS },
    { key: 'type', label: 'Type', options: TYPE_OPTIONS },
  ]

  const visitWhere = {
    organization_id: session.user.organizationId,
    deleted_at: null as null,
    ...(effectiveCompanyIds.length > 0
      ? { company_id: { in: effectiveCompanyIds } }
      : { company_id: 'no-match' }),
    ...(q
      ? { notes: { contains: q, mode: 'insensitive' as const } }
      : {}),
    ...(statusFilter ? { status: statusFilter as never } : {}),
    ...(typeFilter ? { visit_type: typeFilter as never } : {}),
  }

  const [visits, totalCount] = await Promise.all([
    prisma.visit.findMany({
      where: visitWhere,
      include: {
        company: { select: { id: true, name: true } },
        visitor: { select: { id: true, name: true } },
      },
      orderBy: { visit_date: 'desc' },
      skip,
      take,
    }),
    prisma.visit.count({ where: visitWhere }),
  ])

  const hasFilters = !!(q || statusFilter || typeFilter || companyFilter)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Besøg</h1>
          <p className="mt-1 text-sm text-gray-500">
            Alle besøg på tværs af selskaber
          </p>
        </div>
        <Link
          href="/visits/new"
          className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          Nyt besøg
        </Link>
      </div>

      <div className="flex-1">
        <Suspense fallback={null}>
          <SearchAndFilter
            placeholder="Søg i noter..."
            filters={filters}
          />
        </Suspense>
      </div>

      {visits.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-gray-300 p-12 text-center">
          <MapPin className="mx-auto h-12 w-12 text-gray-400" />
          {hasFilters ? (
            <>
              <h3 className="mt-2 text-sm font-semibold text-gray-900">
                Ingen besøg matcher søgningen
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                Prøv at ændre filtrene.
              </p>
            </>
          ) : (
            <>
              <h3 className="mt-2 text-sm font-semibold text-gray-900">
                Ingen besøg endnu
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                Planlæg dit første besøg for at komme i gang.
              </p>
              <Link
                href="/visits/new"
                className="mt-4 inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                <Plus className="h-4 w-4" />
                Planlæg besøg
              </Link>
            </>
          )}
        </div>
      ) : (
        <>
          <div className="overflow-hidden rounded-lg border bg-white shadow-sm">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Selskab
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Besøgsdato
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Besøgt af
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Noter
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {visits.map((visit) => (
                  <tr key={visit.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Link
                        href={`/visits/${visit.id}`}
                        className="text-sm font-medium text-blue-600 hover:text-blue-800"
                      >
                        {visit.company.name}
                      </Link>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(visit.visit_date).toLocaleDateString('da-DK')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {getVisitTypeLabel(visit.visit_type)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getVisitStatusStyle(visit.status)}`}
                      >
                        {getVisitStatusLabel(visit.status)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {visit.visitor.name}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">
                      {visit.notes ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
