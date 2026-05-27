import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getCasesPageData } from '@/actions/cases'
import { auth } from '@/lib/auth'
import { parsePaginationParams } from '@/lib/pagination'
import { canAccessModule } from '@/lib/permissions'
import { CasesListB, type CaseRow } from './cases-list-b'

export const metadata: Metadata = { title: 'Sager' }

export default async function CasesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
}) {
  const session = await auth()
  if (!session) redirect('/login')

  const hasAccess = await canAccessModule(session.user.id, 'cases', session.user.organizationId)
  if (!hasAccess) redirect('/dashboard')

  const { page } = parsePaginationParams((await searchParams).page, 25)
  const { cases, totalCount, pageSize } = await getCasesPageData(page, 25)

  return (
    <CasesListB
      cases={cases as CaseRow[]}
      totalCount={totalCount}
      serverPage={page}
      serverPageSize={pageSize}
    />
  )
}
