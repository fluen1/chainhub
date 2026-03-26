import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { getAccessibleCompanies } from '@/lib/permissions'
import { Users, Plus } from 'lucide-react'
import Link from 'next/link'
import { Suspense } from 'react'
import { SearchAndFilter } from '@/components/ui/SearchAndFilter'
import { Pagination } from '@/components/ui/Pagination'
import { parsePaginationParams } from '@/lib/pagination'

const PAGE_SIZE = 20

interface PersonsPageProps {
  searchParams: {
    q?: string
    company?: string
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

  // Hent accessible companies til filter-dropdown
  const companyIds = await getAccessibleCompanies(
    session.user.id,
    session.user.organizationId
  )

  const companyOptions = companyIds.length > 0
    ? (await prisma.company.findMany({
        where: {
          id: { in: companyIds },
          organization_id: session.user.organizationId,
          deleted_at: null,
        },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      })).map((c) => ({ value: c.id, label: c.name }))
    : []

  const where = {
    organization_id: session.user.organizationId,
    deleted_at: null as null,
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Persondatabase</h1>
          <p className="mt-1 text-sm text-gray-500">
            {totalCount} kontakt{totalCount !== 1 ? 'er' : ''} på tværs af alle selskaber
          </p>
        </div>
        <Link
          href="/persons/new"
          className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          Ny person
        </Link>
      </div>

      <Suspense fallback={null}>
        <SearchAndFilter
          placeholder="Søg på navn eller email..."
          filters={[
            { key: 'company', label: 'Selskab', options: companyOptions },
          ]}
        />
      </Suspense>

      {persons.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-gray-300 p-12 text-center">
          <Users className="mx-auto h-12 w-12 text-gray-400" />
          {q ? (
            <>
              <h3 className="mt-2 text-sm font-semibold text-gray-900">Ingen personer matcher søgningen</h3>
              <p className="mt-1 text-sm text-gray-500">Prøv et andet søgeord.</p>
            </>
          ) : (
            <>
              <h3 className="mt-2 text-sm font-semibold text-gray-900">Ingen personer endnu</h3>
              <p className="mt-1 text-sm text-gray-500">Opret din første kontakt for at komme i gang.</p>
              <Link href="/persons/new" className="mt-4 inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
                <Plus className="h-4 w-4" />Opret person
              </Link>
            </>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {persons.map((person) => {
              const fullName = `${person.first_name} ${person.last_name}`
              const avatarColor = getAvatarColor(person.first_name)
              const initials = `${person.first_name[0] ?? ''}${person.last_name[0] ?? ''}`.toUpperCase()
              const primaryRole = person.company_persons[0]?.role

              return (
                <Link
                  key={person.id}
                  href={`/persons/${person.id}`}
                  className="group rounded-lg border bg-white p-5 shadow-sm hover:border-blue-300 hover:shadow-md transition-all"
                >
                  <div className="flex items-start gap-3 mb-3">
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${avatarColor}`}>
                      {initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 group-hover:text-blue-600 truncate">{fullName}</p>
                      {primaryRole && (
                        <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 mt-1">{primaryRole}</span>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1 mb-3">
                    {person.email && <p className="text-xs text-gray-500 truncate" title={person.email}>✉ {person.email}</p>}
                    {person.phone && <p className="text-xs text-gray-500">☎ {person.phone}</p>}
                  </div>

                  {person.company_persons.length > 0 && (
                    <div className="space-y-0.5 border-t border-gray-100 pt-2">
                      {person.company_persons.map((cp) => (
                        <p key={cp.id} className="text-xs text-gray-400 truncate">
                          {cp.company.name}
                          {cp.role && cp.role !== primaryRole && <span className="text-gray-300"> · {cp.role}</span>}
                        </p>
                      ))}
                    </div>
                  )}

                  {person.company_persons.length === 0 && (
                    <p className="text-xs text-gray-300 border-t border-gray-100 pt-2">Ingen tilknytninger</p>
                  )}
                </Link>
              )
            })}
          </div>

          <Suspense fallback={null}>
            <Pagination currentPage={page} totalCount={totalCount} pageSize={PAGE_SIZE} />
          </Suspense>
        </>
      )}
    </div>
  )
}
