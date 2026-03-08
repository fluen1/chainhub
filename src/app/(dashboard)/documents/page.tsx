import { Suspense } from 'react'
import { DocumentList } from '@/components/documents/document-list'
import { DocumentCardSkeleton } from '@/components/documents/document-card'

export const metadata = {
  title: 'Dokumenter | ChainHub',
}

function DocumentsLoading() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="h-7 w-32 bg-gray-200 rounded animate-pulse" />
        <div className="h-10 w-36 bg-gray-200 rounded animate-pulse" />
      </div>
      <div className="flex gap-3">
        <div className="flex-1 h-10 bg-gray-200 rounded animate-pulse" />
        <div className="h-10 w-44 bg-gray-200 rounded animate-pulse" />
        <div className="h-10 w-36 bg-gray-200 rounded animate-pulse" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <DocumentCardSkeleton key={i} />
        ))}
      </div>
    </div>
  )
}

export default function DocumentsPage() {
  return (
    <div className="container py-6">
      <Suspense fallback={<DocumentsLoading />}>
        <DocumentList />
      </Suspense>
    </div>
  )
}