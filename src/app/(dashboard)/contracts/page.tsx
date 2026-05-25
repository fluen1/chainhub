import type { Metadata } from 'next'
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { canAccessModule } from '@/lib/permissions'
import { getContractsPaginated } from '@/actions/contracts'
import { ContractsListB } from './contracts-list-b'

export const metadata: Metadata = { title: 'Kontrakter' }

// ────────────────────────────────────────────────────────────────────────────
// /contracts (liste) — server-side paginering med sensitivity-filter i WHERE.
// Alle filtre sendes som søgeparametre og løses på serveren.
// ────────────────────────────────────────────────────────────────────────────

interface SearchParams {
  page?: string
  search?: string
  status?: string
  type?: string
  company?: string
  view?: string
  pageSize?: string
}

export default async function ContractsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const sp = await searchParams
  const session = await auth()
  if (!session) redirect('/login')

  const hasAccess = await canAccessModule(session.user.id, 'contracts', session.user.organizationId)
  if (!hasAccess) redirect('/dashboard')

  const pageSize = sp.pageSize ? parseInt(sp.pageSize, 10) : 20

  const result = await getContractsPaginated({
    page: sp.page ? parseInt(sp.page, 10) : 1,
    pageSize,
    search: sp.search,
    status: sp.status,
    type: sp.type,
    company: sp.company,
  })

  return (
    <ContractsListB
      contracts={result.rows}
      totalContracts={result.totalCount}
      page={result.page}
      pageSize={result.pageSize}
    />
  )
}
