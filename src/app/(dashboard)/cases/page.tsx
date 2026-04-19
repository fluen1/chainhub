import type { Metadata } from 'next'
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { getAccessibleCompanies } from '@/lib/permissions'
import { Briefcase, AlertTriangle } from 'lucide-react'
import Link from 'next/link'
import { PageHeader } from '@/components/ui/page-header'
import { EmptyState } from '@/components/ui/empty-state'
import { ExportButton } from '@/components/ui/export-button'
import { Suspense } from 'react'
import { SearchAndFilter } from '@/components/ui/SearchAndFilter'
import { Pagination } from '@/components/ui/Pagination'
import { parsePaginationParams } from '@/lib/pagination'
import { GroupToggle } from '@/components/ui/GroupToggle'
import { CollapsibleSection } from '@/components/ui/CollapsibleSection'
import {
  CASE_STATUS_LABELS,
  CASE_TYPE_LABELS,
  getCaseStatusLabel,
  getCaseStatusStyle,
  getCaseTypeLabel,
} from '@/lib/labels'
import type { SagsType } from '@prisma/client'
import { zodCaseStatus } from '@/lib/zod-enums'

export const metadata: Metadata = { title: 'Sager' }

const PAGE_SIZE = 20

const STATUS_OPTIONS = Object.entries(CASE_STATUS_LABELS).map(([value, label]) => ({
  value,
  label,
}))
const TYPE_OPTIONS = Object.entries(CASE_TYPE_LABELS).map(([value, label]) => ({ value, label }))

interface CasesPageProps {
  searchParams: {
    q?: string
    status?: string
    type?: string
    company?: string
    view?: string
    page?: string
  }
}

export default async function CasesPage({ searchParams }: CasesPageProps) {
  const session = await auth()
  if (!session) redirect('/login')

  const { page, skip, take } = parsePaginationParams(searchParams.page, PAGE_SIZE)
  const q = searchParams.q?.trim() ?? ''
  const parsedStatus = zodCaseStatus.safeParse(searchParams.status)
  const statusFilter = parsedStatus.success ? parsedStatus.data : undefined
  const typeFilter = searchParams.type
  const companyFilter = searchParams.company
  const viewMode = searchParams.view ?? 'grouped'

  const companyIds = await getAccessibleCompanies(session.user.id, session.user.organizationId)

  // Hent selskaber til filter-dropdown
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

  // Bestem hvilke selskaber der skal bruges til CaseCompany-opslag
  const effectiveCompanyIds = companyFilter
    ? companyIds.includes(companyFilter)
      ? [companyFilter]
      : []
    : companyIds

  // Hent sags-id'er via CaseCompany-tabellen
  const caseCompanyLinks =
    effectiveCompanyIds.length > 0
      ? await prisma.caseCompany.findMany({
          where: {
            organization_id: session.user.organizationId,
            company_id: { in: effectiveCompanyIds },
          },
          select: { case_id: true },
          distinct: ['case_id'],
        })
      : []

  const caseIds = caseCompanyLinks.map((cc) => cc.case_id)

  const filters = [
    { key: 'company', label: 'Selskab', options: companyOptions },
    { key: 'status', label: 'Status', options: STATUS_OPTIONS },
    { key: 'type', label: 'Type', options: TYPE_OPTIONS },
  ]

  const caseWhere = {
    id: caseIds.length > 0 ? { in: caseIds } : undefined,
    organization_id: session.user.organizationId,
    deleted_at: null as null,
    ...(q ? { title: { contains: q, mode: 'insensitive' as const } } : {}),
    ...(statusFilter ? { status: statusFilter } : {}),
    ...(typeFilter ? { case_type: typeFilter as SagsType } : {}),
  }

  // Ingen tilgængelige selskaber → ingen sager
  if (caseIds.length === 0) {
    return (
      <div className="space-y-6">
        <CasesHeader />
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1">
            <Suspense fallback={null}>
              <SearchAndFilter placeholder="Søg på sagsnavn..." filters={filters} />
            </Suspense>
          </div>
          <Suspense fallback={null}>
            <GroupToggle />
          </Suspense>
        </div>
        <EmptyState
          icon={Briefcase}
          title="Ingen sager endnu"
          description="Opret din første sag for at komme i gang."
          action={{ label: 'Opret sag', href: '/cases/new' }}
        />
      </div>
    )
  }

  const isGrouped = viewMode === 'grouped'

  const casesQuery = prisma.case.findMany({
    where: caseWhere,
    include: {
      case_companies: {
        include: {
          company: { select: { id: true, name: true } },
        },
      },
      _count: {
        select: {
          tasks: { where: { deleted_at: null, status: { not: 'LUKKET' } } },
        },
      },
    },
    orderBy: { created_at: 'desc' },
    ...(isGrouped ? {} : { skip, take }),
  })
  const countQuery = prisma.case.count({ where: caseWhere })

  const [cases, totalCount] = await Promise.all([casesQuery, countQuery])

  const hasFilters = !!(q || statusFilter || typeFilter || companyFilter)

  // Gruppér sager efter selskab (brug første selskab som gruppe-nøgle)
  const groupedCases: Record<string, { companyName: string; cases: typeof cases }> = {}
  if (isGrouped) {
    for (const caseItem of cases) {
      const primaryCompany = caseItem.case_companies[0]?.company
      const key = primaryCompany?.id ?? 'unknown'
      const name = primaryCompany?.name ?? 'Ukendt selskab'
      if (!groupedCases[key]) {
        groupedCases[key] = { companyName: name, cases: [] }
      }
      groupedCases[key].cases.push(caseItem)
    }
  }

  const sortedGroups = Object.entries(groupedCases).sort(([, a], [, b]) =>
    a.companyName.localeCompare(b.companyName, 'da')
  )

  function renderCaseRow(caseItem: (typeof cases)[number]) {
    return (
      <tr key={caseItem.id} className="hover:bg-gray-50">
        <td className="px-6 py-4">
          <Link
            href={`/cases/${caseItem.id}`}
            className="text-sm font-medium text-blue-600 hover:text-blue-800"
          >
            {caseItem.title}
          </Link>
          {caseItem.description && (
            <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">
              {caseItem.description.split('\n')[0].slice(0, 80)}
              {caseItem.description.split('\n')[0].length > 80 ? '…' : ''}
            </p>
          )}
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
          {getCaseTypeLabel(caseItem.case_type)}
        </td>
        <td className="px-6 py-4">
          <div className="flex flex-wrap gap-1">
            {caseItem.case_companies.slice(0, 3).map((cc) => (
              <Link
                key={cc.company.id}
                href={`/companies/${cc.company.id}`}
                className="text-xs text-gray-600 hover:text-blue-600"
              >
                {cc.company.name}
              </Link>
            ))}
            {caseItem.case_companies.length > 3 && (
              <span className="text-xs text-gray-500">
                +{caseItem.case_companies.length - 3} mere
              </span>
            )}
          </div>
        </td>
        <td className="px-6 py-4 whitespace-nowrap">
          <div className="flex items-center gap-1.5">
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getCaseStatusStyle(caseItem.status)}`}
            >
              {getCaseStatusLabel(caseItem.status)}
            </span>
            {caseItem.due_date && new Date(caseItem.due_date) < new Date() && (
              <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
                <AlertTriangle className="h-3 w-3" />
                Forfalden
              </span>
            )}
          </div>
        </td>
        <td className="px-6 py-4 text-right">
          {caseItem._count.tasks > 0 ? (
            <span className="inline-flex items-center rounded-full bg-orange-50 px-2.5 py-0.5 text-xs font-medium text-orange-700">
              {caseItem._count.tasks}
            </span>
          ) : (
            <span className="text-xs text-gray-400">—</span>
          )}
        </td>
      </tr>
    )
  }

  const tableHeader = (
    <thead className="bg-gray-50">
      <tr>
        <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
          Sag
        </th>
        <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
          Type
        </th>
        <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
          Selskab(er)
        </th>
        <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
          Status
        </th>
        <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
          Åbne opgaver
        </th>
      </tr>
    </thead>
  )

  return (
    <div className="space-y-6">
      <CasesHeader />

      <div className="flex items-center justify-between gap-4">
        <div className="flex-1">
          <Suspense fallback={null}>
            <SearchAndFilter placeholder="Søg på sagsnavn..." filters={filters} />
          </Suspense>
        </div>
        <Suspense fallback={null}>
          <GroupToggle />
        </Suspense>
      </div>

      {cases.length === 0 ? (
        hasFilters ? (
          <EmptyState
            icon={Briefcase}
            title="Ingen sager matcher søgningen"
            description="Prøv at ændre filtrene."
            variant="filtered"
          />
        ) : (
          <EmptyState
            icon={Briefcase}
            title="Ingen sager endnu"
            description="Opret din første sag for at komme i gang."
            action={{ label: 'Opret sag', href: '/cases/new' }}
          />
        )
      ) : isGrouped ? (
        <div className="space-y-4">
          {sortedGroups.map(([companyId, group]) => (
            <CollapsibleSection
              key={companyId}
              title={group.companyName}
              count={group.cases.length}
            >
              <table className="min-w-full divide-y divide-gray-200">
                {tableHeader}
                <tbody className="divide-y divide-gray-200 bg-white">
                  {group.cases.map((caseItem) => renderCaseRow(caseItem))}
                </tbody>
              </table>
            </CollapsibleSection>
          ))}
        </div>
      ) : (
        <>
          <div className="overflow-hidden rounded-lg border bg-white shadow-sm">
            <table className="min-w-full divide-y divide-gray-200">
              {tableHeader}
              <tbody className="divide-y divide-gray-200 bg-white">
                {cases.map((caseItem) => renderCaseRow(caseItem))}
              </tbody>
            </table>
          </div>
          <Suspense fallback={null}>
            <Pagination currentPage={page} totalCount={totalCount} pageSize={PAGE_SIZE} />
          </Suspense>
        </>
      )}
    </div>
  )
}

function CasesHeader() {
  return (
    <PageHeader
      title="Sager"
      subtitle="Alle sager på tværs af selskaber"
      actionLabel="Ny sag"
      actionHref="/cases/new"
      extraActions={<ExportButton entity="cases" />}
    />
  )
}
