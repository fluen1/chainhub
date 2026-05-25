import type { Metadata } from 'next'
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { canAccessModule } from '@/lib/permissions'
import { getPersonsPaginated } from '@/actions/persons'
import { PersonsListB } from './persons-list-b'

export const metadata: Metadata = { title: 'Personer' }

interface PersonsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function PersonsPage({ searchParams }: PersonsPageProps) {
  const session = await auth()
  if (!session) redirect('/login')

  const orgId = session.user.organizationId

  const hasAccess = await canAccessModule(session.user.id, 'persons', orgId)
  if (!hasAccess) redirect('/dashboard')

  const sp = await searchParams
  function sp1(key: string): string | undefined {
    const v = sp[key]
    return Array.isArray(v) ? v[0] : v
  }

  const page = parseInt(sp1('page') ?? '1', 10) || 1
  const pageSize = parseInt(sp1('pageSize') ?? '15', 10) || 15
  const search = sp1('search')

  const {
    rows,
    totalCount,
    page: currentPage,
    pageSize: currentPageSize,
  } = await getPersonsPaginated({
    page,
    pageSize,
    search,
  })

  return (
    <PersonsListB
      persons={rows}
      totalCount={totalCount}
      page={currentPage}
      pageSize={currentPageSize}
    />
  )
}
