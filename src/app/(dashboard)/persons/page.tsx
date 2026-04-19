import type { Metadata } from 'next'
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { getAccessibleCompanies } from '@/lib/permissions'
import { Users, Mail, Phone, LayoutGrid, TableProperties } from 'lucide-react'
import Link from 'next/link'
import { PageHeader } from '@/components/ui/page-header'
import { EmptyState } from '@/components/ui/empty-state'
import { Suspense } from 'react'
import { SearchAndFilter } from '@/components/ui/SearchAndFilter'
import { Pagination } from '@/components/ui/Pagination'
import { parsePaginationParams } from '@/lib/pagination'
import { COMPANY_PERSON_ROLE_LABELS, getCompanyPersonRoleLabel } from '@/lib/labels'

export const metadata: Metadata = { title: 'Personer' }

const PAGE_SIZE = 20

interface PersonsPageProps {
  searchParams: {
    q?: string
    company?: string
    view?: string // 'ansatte' (default) | 'alle'
    layout?: string // 'kort' (default) | 'tabel'
    role?: string
    page?: string
  }
}

const AVATAR_COLORS: Record<string, string> = {
  A: 'bg-red-100 text-red-700',
  B: 'bg-orange-100 text-orange-700',
  C: 'bg-amber-100 text-amber-700',
  D: 'bg-yellow-100 text-yellow-700',
  E: 'bg-lime-100 text-lime-700',
  F: 'bg-green-100 text-green-700',
  G: 'bg-teal-100 text-teal-700',
  H: 'bg-cyan-100 text-cyan-700',
  I: 'bg-sky-100 text-sky-700',
  J: 'bg-blue-100 text-blue-700',
  K: 'bg-indigo-100 text-indigo-700',
  L: 'bg-violet-100 text-violet-700',
  M: 'bg-purple-100 text-purple-700',
  N: 'bg-fuchsia-100 text-fuchsia-700',
  O: 'bg-pink-100 text-pink-700',
  P: 'bg-rose-100 text-rose-700',
}

function getAvatarColor(name: string): string {
  const initial = name[0]?.toUpperCase() ?? 'A'
  return AVATAR_COLORS[initial] ?? 'bg-gray-100 text-gray-700'
}

export default async function PersonsPage({ searchParams }: PersonsPageProps) {
  const session = await auth()
  if (!session) redirect('/login')

  const { page, skip, take } = parsePaginationParams(searchParams.page, PAGE_SIZE)
  const q = searchParams.q?.trim() ?? ''
  const companyFilter = searchParams.company
  const viewFilter = searchParams.view ?? 'ansatte'
  const layoutFilter = searchParams.layout ?? 'kort'
  const roleFilter = searchParams.role

  // Hent accessible companies til filter-dropdown
  const companyIds = await getAccessibleCompanies(session.user.id, session.user.organizationId)

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

  // Default: vis kun ansatte (har employment_type). "alle" viser alle inkl. eksterne
  const employeeFilter =
    viewFilter === 'ansatte'
      ? { company_persons: { some: { employment_type: { not: null }, end_date: null } } }
      : {}

  const where = {
    organization_id: session.user.organizationId,
    deleted_at: null as null,
    ...employeeFilter,
    ...(q
      ? {
          OR: [
            { first_name: { contains: q, mode: 'insensitive' as const } },
            { last_name: { contains: q, mode: 'insensitive' as const } },
            { email: { contains: q, mode: 'insensitive' as const } },
          ],
        }
      : {}),
    ...(companyFilter
      ? {
          company_persons: {
            some: {
              company_id: companyFilter,
              end_date: null,
            },
          },
        }
      : {}),
    ...(roleFilter
      ? {
          company_persons: {
            some: {
              role: roleFilter,
              end_date: null,
            },
          },
        }
      : {}),
  }

  const [persons, totalCount] = await Promise.all([
    prisma.person.findMany({
      where,
      include: {
        company_persons: {
          where: { end_date: null },
          include: {
            company: { select: { id: true, name: true } },
          },
          take: 3,
        },
      },
      orderBy: { first_name: 'asc' },
      skip,
      take,
    }),
    prisma.person.count({ where }),
  ])

  return (
    <div className="space-y-6 max-w-[1280px] mx-auto">
      <PageHeader
        title="Personale"
        subtitle={`${totalCount} ${viewFilter === 'ansatte' ? 'ansatte' : 'kontakter'} på tværs af alle selskaber`}
        actionLabel="Ny person"
        actionHref="/persons/new"
      />

      <div className="flex items-center gap-3">
        <div className="flex-1">
          <Suspense fallback={null}>
            <SearchAndFilter
              placeholder="Søg på navn eller email..."
              filters={[
                { key: 'company', label: 'Selskab', options: companyOptions },
                {
                  key: 'role',
                  label: 'Rolle',
                  options: Object.entries(COMPANY_PERSON_ROLE_LABELS).map(([value, label]) => ({
                    value,
                    label,
                  })),
                },
              ]}
            />
          </Suspense>
        </div>
        {/* Layout toggle */}
        <div className="flex items-center bg-white ring-1 ring-gray-200 rounded-lg p-0.5 shadow-sm shrink-0">
          <Link
            href={`/persons?layout=kort&view=${viewFilter}${companyFilter ? `&company=${companyFilter}` : ''}${roleFilter ? `&role=${roleFilter}` : ''}${q ? `&q=${q}` : ''}`}
            className={`p-1.5 rounded-md transition-colors no-underline ${layoutFilter === 'kort' ? 'bg-gray-900 text-white' : 'text-gray-500 hover:text-gray-900'}`}
            title="Kortvisning"
          >
            <LayoutGrid className="h-4 w-4" />
          </Link>
          <Link
            href={`/persons?layout=tabel&view=${viewFilter}${companyFilter ? `&company=${companyFilter}` : ''}${roleFilter ? `&role=${roleFilter}` : ''}${q ? `&q=${q}` : ''}`}
            className={`p-1.5 rounded-md transition-colors no-underline ${layoutFilter === 'tabel' ? 'bg-gray-900 text-white' : 'text-gray-500 hover:text-gray-900'}`}
            title="Tabelvisning"
          >
            <TableProperties className="h-4 w-4" />
          </Link>
        </div>
        {/* View toggle */}
        <div className="flex items-center bg-white ring-1 ring-gray-200 rounded-lg p-0.5 shadow-sm shrink-0">
          <Link
            href={`/persons?view=ansatte&layout=${layoutFilter}${companyFilter ? `&company=${companyFilter}` : ''}${roleFilter ? `&role=${roleFilter}` : ''}${q ? `&q=${q}` : ''}`}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors no-underline ${viewFilter === 'ansatte' ? 'bg-gray-900 text-white' : 'text-gray-600 hover:text-gray-900'}`}
          >
            Ansatte
          </Link>
          <Link
            href={`/persons?view=alle&layout=${layoutFilter}${companyFilter ? `&company=${companyFilter}` : ''}${roleFilter ? `&role=${roleFilter}` : ''}${q ? `&q=${q}` : ''}`}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors no-underline ${viewFilter === 'alle' ? 'bg-gray-900 text-white' : 'text-gray-600 hover:text-gray-900'}`}
          >
            Alle
          </Link>
        </div>
      </div>

      {persons.length === 0 ? (
        q || companyFilter || roleFilter ? (
          <EmptyState
            icon={Users}
            title="Ingen personer matcher søgningen"
            description="Prøv at ændre filtrene."
            variant="filtered"
          />
        ) : (
          <EmptyState
            icon={Users}
            title="Ingen personer endnu"
            description="Opret din første person for at komme i gang."
            action={{ label: 'Opret person', href: '/persons/new' }}
          />
        )
      ) : (
        <>
          {layoutFilter === 'tabel' ? (
            <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/60">
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">
                      Navn
                    </th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">
                      Email
                    </th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">
                      Telefon
                    </th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">
                      Rolle
                    </th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">
                      Selskab
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {persons.map((person) => {
                    const fullName = `${person.first_name} ${person.last_name}`
                    const avatarColor = getAvatarColor(person.first_name)
                    const initials =
                      `${person.first_name[0] ?? ''}${person.last_name[0] ?? ''}`.toUpperCase()
                    const primaryCp = person.company_persons[0]

                    return (
                      <tr key={person.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-4 py-2.5">
                          <Link
                            href={`/persons/${person.id}`}
                            className="flex items-center gap-2.5 no-underline group"
                          >
                            <div
                              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ${avatarColor}`}
                            >
                              {initials}
                            </div>
                            <span className="font-medium text-gray-900 group-hover:text-blue-600 truncate">
                              {fullName}
                            </span>
                          </Link>
                        </td>
                        <td className="px-4 py-2.5 text-gray-600 truncate max-w-[200px]">
                          {person.email ?? '—'}
                        </td>
                        <td className="px-4 py-2.5 text-gray-600 tabular-nums">
                          {person.phone ?? '—'}
                        </td>
                        <td className="px-4 py-2.5">
                          {primaryCp?.role ? (
                            <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                              {getCompanyPersonRoleLabel(primaryCp.role)}
                            </span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-gray-600 truncate max-w-[180px]">
                          {primaryCp ? primaryCp.company.name : '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {persons.map((person) => {
                const fullName = `${person.first_name} ${person.last_name}`
                const avatarColor = getAvatarColor(person.first_name)
                const initials =
                  `${person.first_name[0] ?? ''}${person.last_name[0] ?? ''}`.toUpperCase()
                const primaryCp = person.company_persons[0]
                const primaryRole = primaryCp?.role

                return (
                  <Link
                    key={person.id}
                    href={`/persons/${person.id}`}
                    className="group rounded-lg border bg-white p-5 shadow-sm hover:border-blue-300 hover:shadow-md transition-all"
                  >
                    <div className="flex items-start gap-3 mb-3">
                      <div
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${avatarColor}`}
                      >
                        {initials}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 group-hover:text-blue-600 truncate">
                          {fullName}
                        </p>
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          {primaryRole && (
                            <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                              {getCompanyPersonRoleLabel(primaryRole)}
                            </span>
                          )}
                          {primaryCp?.employment_type && (
                            <span className="text-[10px] text-gray-500">
                              {primaryCp.employment_type}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1 mb-3">
                      {person.email && (
                        <p
                          className="flex items-center gap-1.5 text-xs text-gray-500 truncate"
                          title={person.email}
                        >
                          <Mail className="h-3 w-3 shrink-0 text-gray-400" />
                          {person.email}
                        </p>
                      )}
                      {person.phone && (
                        <p className="flex items-center gap-1.5 text-xs text-gray-500">
                          <Phone className="h-3 w-3 shrink-0 text-gray-400" />
                          {person.phone}
                        </p>
                      )}
                    </div>

                    {person.company_persons.length > 0 && (
                      <div className="space-y-0.5 border-t border-gray-100 pt-2">
                        {person.company_persons.map((cp) => (
                          <p key={cp.id} className="text-xs text-gray-500 truncate">
                            {cp.company.name}
                            {cp.role && cp.role !== primaryRole && (
                              <span className="text-gray-300">
                                {' '}
                                · {getCompanyPersonRoleLabel(cp.role)}
                              </span>
                            )}
                          </p>
                        ))}
                      </div>
                    )}

                    {person.company_persons.length === 0 && (
                      <p className="text-xs text-gray-500 border-t border-gray-100 pt-2">
                        Ingen tilknytninger
                      </p>
                    )}
                  </Link>
                )
              })}
            </div>
          )}

          <Suspense fallback={null}>
            <Pagination currentPage={page} totalCount={totalCount} pageSize={PAGE_SIZE} />
          </Suspense>
        </>
      )}
    </div>
  )
}
