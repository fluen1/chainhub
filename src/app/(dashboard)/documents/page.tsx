import type { Metadata } from 'next'
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { canAccessModule } from '@/lib/permissions'
import { DocumentsListB, type DocRow } from './documents-list-b'
import { getDocumentsPageData } from '@/actions/documents'

export const metadata: Metadata = { title: 'Dokumenter' }

export default async function DocumentsPage() {
  const session = await auth()
  if (!session) redirect('/login')

  const hasAccess = await canAccessModule(session.user.id, 'documents', session.user.organizationId)
  if (!hasAccess) redirect('/dashboard')

  const rows: DocRow[] = await getDocumentsPageData()

  return <DocumentsListB documents={rows} />
}
