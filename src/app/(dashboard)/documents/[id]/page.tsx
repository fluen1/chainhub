import { notFound, redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { canAccessModule } from '@/lib/permissions'
import { getDocument } from '@/actions/documents'
import { DocumentDetailClient } from '@/components/documents/DocumentDetailClient'

interface DocumentDetailPageProps {
  params: { id: string }
}

export default async function DocumentDetailPage({ params }: DocumentDetailPageProps) {
  const session = await auth()
  if (!session?.user) redirect('/login')

  const hasAccess = await canAccessModule(session.user.id, 'documents')
  if (!hasAccess) {
    return (
      <div className="p-6">
        <div className="rounded-lg bg-red-50 p-4 text-red-700">
          Du har ikke adgang til dokumentmodulet.
        </div>
      </div>
    )
  }

  const result = await getDocument({ documentId: params.id })

  if (result.error) {
    if (result.error.includes('ikke fundet')) notFound()
    return (
      <div className="p-6">
        <div className="rounded-lg bg-red-50 p-4 text-red-700">{result.error}</div>
      </div>
    )
  }

  return <DocumentDetailClient document={result.data!} />
}