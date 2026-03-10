import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { FolderOpen } from 'lucide-react'

export default async function DocumentsPage() {
  const session = await auth()
  if (!session) redirect('/login')

  const documents = await prisma.document.findMany({
    where: {
      organization_id: session.user.organizationId,
      deleted_at: null,
    },
    include: {
      company: { select: { name: true } },
    },
    orderBy: { uploaded_at: 'desc' },
    take: 50,
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dokumenter</h1>
        <p className="mt-1 text-sm text-gray-500">Alle dokumenter på tværs af selskaber</p>
      </div>

      {documents.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-gray-300 p-12 text-center">
          <FolderOpen className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-semibold text-gray-900">Ingen dokumenter endnu</h3>
          <p className="mt-1 text-sm text-gray-500">Upload det første dokument for et selskab.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border bg-white shadow-sm">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Titel</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Selskab</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Uploadet</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {documents.map((doc) => (
                <tr key={doc.id} className="hover:bg-gray-50">
                  <td className="whitespace-nowrap px-6 py-4 font-medium text-gray-900">{doc.title}</td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">{doc.company?.name || '—'}</td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">{doc.file_type}</td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
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
