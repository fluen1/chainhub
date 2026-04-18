import type { Metadata } from 'next'
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import {
  Building2,
  FileText,
  Briefcase,
  Users,
  Search,
  CheckSquare,
  File as FileIcon,
} from 'lucide-react'
import Link from 'next/link'
import {
  getCompanyStatusLabel,
  getCompanyStatusStyle,
  getContractStatusLabel,
  getContractTypeLabel,
  getCaseStatusLabel,
  getTaskStatusLabel,
  getPriorityLabel,
  getPriorityStyle,
  formatDate,
} from '@/lib/labels'
import { runSearch } from '@/actions/search'
import { MIN_SEARCH_LENGTH } from '@/lib/search/constants'
import { Suspense } from 'react'

export const metadata: Metadata = { title: 'Søg' }

interface SearchPageProps {
  searchParams: { q?: string }
}

async function SearchResults({
  query,
  userId,
  organizationId,
}: {
  query: string
  userId: string
  organizationId: string
}) {
  if (query.length < MIN_SEARCH_LENGTH) {
    return <QuickAccessPanel />
  }

  const results = await runSearch(query, userId, organizationId)

  if (!results || results.totalCount === 0) {
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
      {results.companies.length > 0 && (
        <section>
          <SectionHeader icon={Building2} label="Selskaber" count={results.companies.length} />
          <div className="divide-y divide-gray-100 rounded-lg border bg-white overflow-hidden">
            {results.companies.map((c) => (
              <Link
                key={c.id}
                href={`/companies/${c.id}`}
                className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors no-underline"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{c.name}</p>
                  <p className="text-xs text-gray-500">
                    {[c.cvr && `CVR ${c.cvr}`, c.city].filter(Boolean).join(' · ') || '—'}
                  </p>
                </div>
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium shrink-0 ${getCompanyStatusStyle(c.status)}`}
                >
                  {getCompanyStatusLabel(c.status)}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {results.contracts.length > 0 && (
        <section>
          <SectionHeader icon={FileText} label="Kontrakter" count={results.contracts.length} />
          <div className="divide-y divide-gray-100 rounded-lg border bg-white overflow-hidden">
            {results.contracts.map((c) => (
              <Link
                key={c.id}
                href={`/contracts/${c.id}`}
                className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors no-underline"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{c.display_name}</p>
                  <p className="text-xs text-gray-500 truncate">
                    {getContractTypeLabel(c.system_type)} · {c.companyName}
                  </p>
                </div>
                <span className="text-xs text-gray-500 shrink-0">
                  {getContractStatusLabel(c.status)}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {results.cases.length > 0 && (
        <section>
          <SectionHeader icon={Briefcase} label="Sager" count={results.cases.length} />
          <div className="divide-y divide-gray-100 rounded-lg border bg-white overflow-hidden">
            {results.cases.map((c) => (
              <Link
                key={c.id}
                href={`/cases/${c.id}`}
                className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors no-underline"
              >
                <p className="text-sm font-medium text-gray-900 truncate">{c.title}</p>
                <span className="text-xs text-gray-500 shrink-0">
                  {getCaseStatusLabel(c.status)}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {results.tasks.length > 0 && (
        <section>
          <SectionHeader icon={CheckSquare} label="Opgaver" count={results.tasks.length} />
          <div className="divide-y divide-gray-100 rounded-lg border bg-white overflow-hidden">
            {results.tasks.map((t) => (
              <Link
                key={t.id}
                href={`/tasks/${t.id}`}
                className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors no-underline gap-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{t.title}</p>
                  <p className="text-xs text-gray-500">
                    {getTaskStatusLabel(t.status)}
                    {t.due_date && ` · Frist ${formatDate(t.due_date)}`}
                  </p>
                </div>
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium shrink-0 ${getPriorityStyle(t.priority)}`}
                >
                  {getPriorityLabel(t.priority)}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {results.persons.length > 0 && (
        <section>
          <SectionHeader icon={Users} label="Personer" count={results.persons.length} />
          <div className="divide-y divide-gray-100 rounded-lg border bg-white overflow-hidden">
            {results.persons.map((p) => (
              <Link
                key={p.id}
                href={`/persons/${p.id}`}
                className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors no-underline"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {p.first_name} {p.last_name}
                  </p>
                  <p className="text-xs text-gray-500 truncate">
                    {[p.email, p.phone].filter(Boolean).join(' · ') || '—'}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {results.documents.length > 0 && (
        <section>
          <SectionHeader icon={FileIcon} label="Dokumenter" count={results.documents.length} />
          <div className="divide-y divide-gray-100 rounded-lg border bg-white overflow-hidden">
            {results.documents.map((d) => (
              <Link
                key={d.id}
                href={`/documents/review/${d.id}`}
                className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors no-underline"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{d.title}</p>
                  <p className="text-xs text-gray-500 truncate">
                    {[d.file_name, d.companyName].filter(Boolean).join(' · ')}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function SectionHeader({
  icon: Icon,
  label,
  count,
}: {
  icon: typeof Building2
  label: string
  count: number
}) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <Icon className="h-4 w-4 text-gray-400" aria-hidden />
      <h2 className="text-sm font-semibold text-gray-700">
        {label} ({count})
      </h2>
    </div>
  )
}

function QuickAccessPanel() {
  return (
    <div className="py-8">
      <p className="text-sm text-gray-500 mb-6">
        Skriv mindst {MIN_SEARCH_LENGTH} tegn for at søge, eller gå direkte til:
      </p>
      <div className="grid grid-cols-2 gap-3">
        {[
          { href: '/companies', icon: Building2, label: 'Selskaber', sub: 'CVR, navn, lokation' },
          { href: '/contracts', icon: FileText, label: 'Kontrakter', sub: 'Type, status, udløb' },
          { href: '/cases', icon: Briefcase, label: 'Sager', sub: 'Tvister, forhandlinger' },
          { href: '/tasks', icon: CheckSquare, label: 'Opgaver', sub: 'Frister, prioritet' },
          { href: '/persons', icon: Users, label: 'Personer', sub: 'Kontakter, roller' },
          { href: '/documents', icon: FileIcon, label: 'Dokumenter', sub: 'Kontrakter, bilag' },
        ].map(({ href, icon: Icon, label, sub }) => (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3 hover:border-blue-300 hover:shadow-sm transition-all no-underline"
          >
            <Icon className="h-5 w-5 text-gray-400" aria-hidden />
            <div>
              <p className="text-sm font-medium text-gray-900">{label}</p>
              <p className="text-xs text-gray-500">{sub}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const session = await auth()
  if (!session) redirect('/login')

  const query = searchParams.q?.trim() ?? ''

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Søg</h1>
        <p className="mt-1 text-sm text-gray-500">
          Søg på tværs af selskaber, kontrakter, sager, opgaver, personer og dokumenter
        </p>
      </div>

      <form action="/search" method="GET">
        <div className="relative">
          <Search
            className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400"
            aria-hidden
          />
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

      <Suspense
        fallback={
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 animate-pulse rounded-lg bg-gray-100" />
            ))}
          </div>
        }
      >
        <SearchResults
          query={query}
          userId={session.user.id}
          organizationId={session.user.organizationId}
        />
      </Suspense>
    </div>
  )
}
