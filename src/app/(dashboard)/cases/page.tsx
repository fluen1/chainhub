import type { Metadata } from 'next'
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { canAccessModule } from '@/lib/permissions'
import { CasesListB, type CaseRow } from './cases-list-b'
import { getCasesPageData } from '@/actions/cases'

export const metadata: Metadata = { title: 'Sager' }

export default async function CasesPage() {
  const session = await auth()
  if (!session) redirect('/login')

  const hasAccess = await canAccessModule(session.user.id, 'cases', session.user.organizationId)
  if (!hasAccess) redirect('/dashboard')

  const { cases, totalCount } = await getCasesPageData()

  return <CasesListB cases={cases as CaseRow[]} totalCount={totalCount} />
}
