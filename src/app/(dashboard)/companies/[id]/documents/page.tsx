import { auth } from '@/lib/auth'
import { redirect, notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import { canAccessCompany } from '@/lib/permissions'
import { FolderOpen } from 'lucide-react'

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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Dokumenter</h2>
          <p className="text-sm text-gray-500 mt-0.5">Filer og dokumenter tilknyttet dette selskab</p>
        </div>
      </div>

      {documents.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-gray-300 p-12 text-center">
          <FolderOpen className="mx-auto h-10 w-10 text-gray-400" />
          <h3 className="mt-2 text-sm font-semibold text-gray-900">Ingen dokumenter</h3>
          <p className="mt-1 text-sm text-gray-500">
            Dokumenthåndtering er tilgængeligt i Sprint 3.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border bg-white shadow-sm overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Filnavn</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Uploadet</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {documents.map((doc) => (
                <tr key={doc.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{doc.file_name}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{doc.file_type}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {new Date(doc.uploaded_at).toLocaleDateString('da-DK')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
