import type { Metadata } from 'next'
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
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

  const orgId = session.user.organizationId

  const hasAccess = await canAccessModule(session.user.id, 'documents', orgId)
  if (!hasAccess) redirect('/documents')

  // Hent alle tilgængelige selskaber i organisationen (til company-select-dropdown).
  // Begrænset til 200 for at undgå rendering-bottleneck.
  const companies = await prisma.company.findMany({
    where: { organization_id: orgId, deleted_at: null },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
    take: 200,
  })

  const companyOptions: CompanyOption[] = companies.map((c) => ({
    id: c.id,
    name: c.name,
  }))

  return <UploadFormB companies={companyOptions} />
}
