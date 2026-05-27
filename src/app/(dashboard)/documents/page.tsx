import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getDocumentsPageData } from '@/actions/documents'
import { auth } from '@/lib/auth'
import { canAccessModule } from '@/lib/permissions'
import { DocumentsListB } from './documents-list-b'

export const metadata: Metadata = { title: 'Dokumenter' }

interface SearchParams {
  page?: string
  pageSize?: string
}

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const sp = await searchParams
  const session = await auth()
  if (!session) redirect('/login')

  const hasAccess = await canAccessModule(session.user.id, 'documents', session.user.organizationId)
  if (!hasAccess) redirect('/dashboard')

  const page = sp.page ? Math.max(1, parseInt(sp.page, 10)) : 1
  const pageSize = sp.pageSize ? Math.min(100, Math.max(1, parseInt(sp.pageSize, 10))) : 25

  const result = await getDocumentsPageData(page, pageSize)

  return (
    <DocumentsListB
      documents={result.rows}
      totalCount={result.totalCount}
      page={result.page}
      pageSize={result.pageSize}
    />
  )
}
