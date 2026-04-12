import type { Metadata } from 'next'
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'

export const metadata: Metadata = { title: 'Søg' }
import { getAccessibleCompanies } from '@/lib/permissions'
import { Building2, FileText, Briefcase, Users, Search } from 'lucide-react'
import Link from 'next/link'
import { getCompanyStatusLabel, getCompanyStatusStyle, getContractStatusLabel, getContractTypeLabel, getCaseStatusLabel } from '@/lib/labels'
import { Suspense } from 'react'

interface SearchPageProps {
  searchParams: { q?: string }
}

async function SearchResults({ query, userId, organizationId }: {
  query: string
  userId: string
  organizationId: string
}) {
  if (query.length < 2) {
    return (
      <div className="text-center py-12 text-gray-500">
        <Search className="mx-auto h-10 w-10 text-gray-300 mb-3" />
        <p>Skriv mindst 2 tegn for at søge</p>
      </div>
    )
  }

  const companyIds = await getAccessibleCompanies(userId, organizationId)

  const [companies, contracts, cases, persons] = await Promise.all([
    // Selskaber
    prisma.company.findMany({
      where: {
        organization_id: organizationId,
        id: { in: companyIds },
        deleted_at: null,
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { cvr: { contains: query, mode: 'insensitive' } },
        ],
      },
      take: 5,
      select: { id: true, name: true, cvr: true, status: true },
    }),
    // Kontrakter
    companyIds.length > 0
      ? prisma.contract.findMany({
          where: {
            organization_id: organizationId,
            company_id: { in: companyIds },
            deleted_at: null,
            display_name: { contains: query, mode: 'insensitive' },
          },
          take: 5,
          include: { company: { select: { id: true, name: true } } },
        })
      : Promise.resolve([]),
    // Sager
    prisma.case.findMany({
      where: {
        organization_id: organizationId,
        deleted_at: null,
        title: { contains: query, mode: 'insensitive' },
      },
      take: 5,
      select: { id: true, title: true, status: true, case_type: true },
    }),
    // Personer
    prisma.person.findMany({
      where: {
        organization_id: organizationId,
        deleted_at: null,
        OR: [
          { first_name: { contains: query, mode: 'insensitive' } },
          { last_name: { contains: query, mode: 'insensitive' } },
          { email: { contains: query, mode: 'insensitive' } },
        ],
      },
      take: 5,
      select: { id: true, first_name: true, last_name: true, email: true },
    }),
  ])

  const totalResults = companies.length + contracts.length + cases.length + persons.length

  if (totalResults === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <Search className="mx-auto h-10 w-10 text-gray-300 mb-3" />
        <p className="font-medium text-gray-700">Ingen resultater for &quot;{query}&quot;</p>
        <p className="text-sm mt-1">Prøv et andet søgeord</p>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Selskaber */}
      {companies.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Building2 className="h-4 w-4 text-gray-400" />
            <h2 className="text-sm font-semibold text-gray-700">
              Selskaber ({companies.length})
            </h2>
          </div>
          <div className="divide-y divide-gray-100 rounded-lg border bg-white overflow-hidden">
            {companies.map((company) => (
              <Link
                key={company.id}
                href={`/companies/${company.id}`}
                className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
              >
                <div>
                  <p className="text-sm font-medium text-gray-900">{company.name}</p>
                  {company.cvr && (
                    <p className="text-xs text-gray-400">CVR: {company.cvr}</p>
                  )}
                </div>
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${getCompanyStatusStyle(company.status ?? '')}`}>
                  {getCompanyStatusLabel(company.status ?? '')}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Kontrakter */}
      {contracts.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <FileText className="h-4 w-4 text-gray-400" />
            <h2 className="text-sm font-semibold text-gray-700">
              Kontrakter ({contracts.length})
            </h2>
          </div>
          <div className="divide-y divide-gray-100 rounded-lg border bg-white overflow-hidden">
            {contracts.map((contract) => (
              <Link
                key={contract.id}
                href={`/contracts/${contract.id}`}
                className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
              >
                <div>
                  <p className="text-sm font-medium text-gray-900">{contract.display_name}</p>
                  <p className="text-xs text-gray-400">
                    {getContractTypeLabel(contract.system_type)} · {contract.company.name}
                  </p>
                </div>
                <span className="text-xs text-gray-400">
                  {getContractStatusLabel(contract.status)}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Sager */}
      {cases.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Briefcase className="h-4 w-4 text-gray-400" />
            <h2 className="text-sm font-semibold text-gray-700">
              Sager ({cases.length})
            </h2>
          </div>
          <div className="divide-y divide-gray-100 rounded-lg border bg-white overflow-hidden">
            {cases.map((c) => (
              <Link
                key={c.id}
                href={`/cases/${c.id}`}
                className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
              >
                <p className="text-sm font-medium text-gray-900">{c.title}</p>
                <span className="text-xs text-gray-400">
                  {getCaseStatusLabel(c.status)}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Personer */}
      {persons.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Users className="h-4 w-4 text-gray-400" />
            <h2 className="text-sm font-semibold text-gray-700">
              Personer ({persons.length})
            </h2>
          </div>
          <div className="divide-y divide-gray-100 rounded-lg border bg-white overflow-hidden">
            {persons.map((person) => (
              <Link
                key={person.id}
                href={`/persons/${person.id}`}
                className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
              >
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {person.first_name} {person.last_name}
                  </p>
                  {person.email && (
                    <p className="text-xs text-gray-400">{person.email}</p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const session = await auth()
  if (!session) redirect('/login')

  const query = searchParams.q?.trim() ?? ''

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Søg</h1>
        <p className="mt-1 text-sm text-gray-500">
          Søg på tværs af selskaber, kontrakter, sager og personer
        </p>
      </div>

      <form action="/search" method="GET">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            name="q"
            defaultValue={query}
            autoFocus
            placeholder="Søg efter selskaber, kontrakter, personer..."
            className="w-full rounded-lg border border-gray-300 bg-white pl-11 pr-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 shadow-sm"
          />
        </div>
      </form>

      <Suspense fallback={
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-lg bg-gray-100" />
          ))}
        </div>
      }>
        <SearchResults
          query={query}
          userId={session.user.id}
          organizationId={session.user.organizationId}
        />
      </Suspense>
    </div>
  )
}
