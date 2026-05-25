import type { Metadata } from 'next'
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { runSearch } from '@/actions/search'
import { MIN_SEARCH_LENGTH } from '@/lib/search/constants'
import {
  getContractTypeLabel,
  getContractStatusLabel,
  getCaseStatusLabel,
  getCaseTypeLabel,
  getCompanyStatusLabel,
  getTaskStatusLabel,
  getPriorityLabel,
  formatDate,
} from '@/lib/labels'
import { SearchPageB, type SearchResultRow } from './search-b'

export const metadata: Metadata = { title: 'Søg' }

interface SearchPageProps {
  searchParams: { q?: string }
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const session = await auth()
  if (!session) redirect('/login')

  const query = searchParams.q?.trim() ?? ''

  if (query.length < MIN_SEARCH_LENGTH) {
    return <SearchPageB query={query} results={null} totalCount={0} />
  }

  const raw = await runSearch(query)
  if (!raw) {
    return <SearchPageB query={query} results={null} totalCount={0} />
  }

  // Map runSearch → flat SearchResultRow[] for klient
  const rows: SearchResultRow[] = []
  for (const c of raw.companies) {
    rows.push({
      id: `co-${c.id}`,
      type: 'selskab',
      title: c.name,
      sub: [c.cvr ? `CVR ${c.cvr}` : null, c.city].filter(Boolean).join(' · ') || '—',
      href: `/companies/${c.id}`,
      badge: { tone: 'gray', label: getCompanyStatusLabel(c.status) },
    })
  }
  for (const c of raw.contracts) {
    rows.push({
      id: `ct-${c.id}`,
      type: 'kontrakt',
      title: c.display_name,
      sub: `${c.companyName} · ${getContractTypeLabel(c.system_type)}`,
      href: `/contracts/${c.id}`,
      badge: contractStatusBadge(c.status),
    })
  }
  for (const cs of raw.cases) {
    rows.push({
      id: `cs-${cs.id}`,
      type: 'sag',
      title: cs.title,
      sub: getCaseTypeLabel(cs.case_type),
      href: `/cases/${cs.id}`,
      badge: caseStatusBadge(cs.status),
    })
  }
  for (const p of raw.persons) {
    rows.push({
      id: `pe-${p.id}`,
      type: 'person',
      title: `${p.first_name} ${p.last_name}`,
      sub: p.email ?? p.phone ?? 'Ingen kontakt',
      href: `/persons/${p.id}`,
      badge: { tone: 'blue', label: 'Person' },
    })
  }
  for (const t of raw.tasks) {
    const dueLabel = t.due_date ? `Frist ${formatDate(t.due_date)}` : 'Ingen frist'
    rows.push({
      id: `ta-${t.id}`,
      type: 'opgave',
      title: t.title,
      sub: `${getTaskStatusLabel(t.status)} · ${getPriorityLabel(t.priority)} · ${dueLabel}`,
      href: `/tasks/${t.id}`,
      badge: taskPriorityBadge(t.priority),
    })
  }
  for (const d of raw.documents) {
    rows.push({
      id: `do-${d.id}`,
      type: 'dokument',
      title: d.file_name,
      sub: d.companyName ? d.companyName : (d.title ?? 'Ingen tilknytning'),
      href: `/documents/review/${d.id}`,
      badge: { tone: 'gray', label: 'Dokument' },
    })
  }

  return <SearchPageB query={query} results={rows} totalCount={raw.totalCount} />
}

function contractStatusBadge(status: string): {
  tone: 'green' | 'red' | 'amber' | 'gray'
  label: string
} {
  if (status === 'AKTIV') return { tone: 'green', label: 'Aktiv' }
  if (status === 'UDLOEBET') return { tone: 'red', label: 'Udløbet' }
  if (status === 'OPSAGT') return { tone: 'gray', label: 'Opsagt' }
  return { tone: 'gray', label: getContractStatusLabel(status) }
}

function caseStatusBadge(status: string): {
  tone: 'green' | 'red' | 'amber' | 'blue' | 'gray'
  label: string
} {
  if (status === 'NY' || status === 'AKTIV')
    return { tone: 'blue', label: getCaseStatusLabel(status) }
  if (status === 'AFVENTER_EKSTERN' || status === 'AFVENTER_KLIENT')
    return { tone: 'amber', label: getCaseStatusLabel(status) }
  if (status === 'LUKKET') return { tone: 'green', label: 'Lukket' }
  return { tone: 'gray', label: getCaseStatusLabel(status) }
}

function taskPriorityBadge(p: string): { tone: 'red' | 'amber' | 'blue' | 'gray'; label: string } {
  if (p === 'KRITISK') return { tone: 'red', label: 'Kritisk' }
  if (p === 'HOEJ') return { tone: 'amber', label: 'Høj' }
  if (p === 'MELLEM') return { tone: 'blue', label: 'Mellem' }
  return { tone: 'gray', label: 'Lav' }
}
