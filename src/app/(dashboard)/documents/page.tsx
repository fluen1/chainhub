import { Suspense } from 'react'
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { canAccessModule } from '@/lib/permissions'
import { isStorageConfigured } from '@/lib/storage'
import { DocumentsClientPage } from '@/components/documents/DocumentsClientPage'
import { StorageNotConfiguredBanner } from '@/components/documents/StorageNotConfiguredBanner'
import { DocumentsPageSkeleton } from '@/components/documents/DocumentsPageSkeleton'
import { prisma } from '@/lib/db'

export const metadata = {
  title: 'Dokumenter — ChainHub',
}

export default async function DocumentsPage() {
  const session = await auth()
  if (!session?.user) redirect('/login')

  const hasAccess = await canAccessModule(session.user.id, 'documents')
  if (!hasAccess) {
    return (
      <div className="p-6">
        <div className="rounded-lg bg-red-50 p-4 text-red-700">
          Du har ikke adgang til dokumentmodulet. Kontakt din administrator.
        </div>
      </div>
    )
  }

  // Hent selskaber og sager til filtrering
  const [companies, cases] = await Promise.all([
    prisma.company.findMany({
      where: {
        organizationId: session.user.organizationId,
        deletedAt: null,
      },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    prisma.case.findMany({
      where: {
        organizationId: session.user.organizationId,
        deletedAt: null,
      },
      select: { id: true, title: true },
      orderBy: { title: 'asc' },
    }),
  ])

  const storageConfigured = isStorageConfigured()

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dokumenter</h1>
          <p className="mt-1 text-sm text-gray-500">
            Upload, søg og administrer dokumenter
          </p>
        </div>
      </div>

      {!storageConfigured && <StorageNotConfiguredBanner />}

      <Suspense fallback={<DocumentsPageSkeleton />}>
        <DocumentsClientPage
          companies={companies}
          cases={cases}
          storageConfigured={storageConfigured}
        />
      </Suspense>
    </div>
  )
}