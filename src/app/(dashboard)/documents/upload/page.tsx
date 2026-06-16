import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getDocumentUploadCompanies } from '@/actions/documents'
import { auth } from '@/lib/auth'
import { canAccessModule } from '@/lib/permissions'
import { UploadFormB } from './upload-form-b'

export const metadata: Metadata = { title: 'Upload dokument' }

export interface CompanyOption {
  id: string
  name: string
}

// /documents/upload — server-rendered upload-side.
// Auth-check + module-check + henter tilgængelige selskaber til company-dropdown.
export default async function DocumentUploadPage() {
  const session = await auth()
  if (!session) redirect('/login')

  const hasAccess = await canAccessModule(session.user.id, 'documents', session.user.organizationId)
  if (!hasAccess) redirect('/documents')

  const companies = await getDocumentUploadCompanies()

  return <UploadFormB companies={companies} />
}
