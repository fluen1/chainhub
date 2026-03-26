import { auth } from '@/lib/auth'
import { redirect, notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import { canAccessCompany } from '@/lib/permissions'
import { FolderOpen } from 'lucide-react'
import { FileUpload } from '@/components/documents/FileUpload'
import { DocumentList } from '@/components/documents/DocumentList'

interface Props {
  params: { id: string }
}

export default async function CompanyDocumentsPage({ params }: Props) {
  const session = await auth()
  if (!session) redirect('/login')

  const hasAccess = await canAccessCompany(session.user.id, params.id)
  if (!hasAccess) notFound()

  const documents = await prisma.document.findMany({
    where: {
      organization_id: session.user.organizationId,
      company_id: params.id,
      deleted_at: null,
    },
    orderBy: { uploaded_at: 'desc' },
    take: 100,
  })

  const serialized = documents.map((doc) => ({
    id: doc.id,
    title: doc.title,
    file_name: doc.file_name,
    file_url: doc.file_url,
    file_size_bytes: doc.file_size_bytes,
    file_type: doc.file_type,
    uploaded_at: doc.uploaded_at.toISOString(),
  }))

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Dokumenter</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          Filer og dokumenter tilknyttet dette selskab
        </p>
      </div>

      <FileUpload companyId={params.id} />

      {serialized.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-gray-300 p-12 text-center">
          <FolderOpen className="mx-auto h-10 w-10 text-gray-400" />
          <h3 className="mt-2 text-sm font-semibold text-gray-900">Ingen dokumenter</h3>
          <p className="mt-1 text-sm text-gray-500">
            Upload dit første dokument ovenfor.
          </p>
        </div>
      ) : (
        <DocumentList documents={serialized} />
      )}
    </div>
  )
}
