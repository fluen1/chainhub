'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Upload, FileText } from 'lucide-react'
import { listDocuments } from '@/actions/documents'
import { DocumentList } from './DocumentList'
import { DocumentUploadModal } from './DocumentUploadModal'
import { Button } from '@/components/ui/button'
import { useRouter } from 'next/navigation'
import type { DocumentWithRelations } from '@/types/document'

interface CompanyDocumentsProps {
  companyId: string
  companyName: string
  cases: { id: string; title: string }[]
  storageConfigured: boolean
}

export function CompanyDocuments({
  companyId,
  companyName,
  cases,
  storageConfigured,
}: CompanyDocumentsProps) {
  const router = useRouter()
  const [documents, setDocuments] = useState<DocumentWithRelations[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const [isUploadOpen, setIsUploadOpen] = useState(false)

  const PAGE_SIZE = 10

  useEffect(() => {
    fetchDocuments(1)
  }, [companyId])

  const fetchDocuments = async (currentPage: number) => {
    setIsLoading(true)
    try {
      const result = await listDocuments({
        companyId,
        page: currentPage,
        pageSize: PAGE_SIZE,
      })
      if (result.error) {
        toast.error(result.error)
        return
      }
      setDocuments(result.data.documents)
      setTotal(result.data.total)
      setPage(currentPage)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async (documentId: string) => {
    const { deleteDocument } = await import('@/actions/documents')
    const result = await deleteDocument({ documentId })
    if (result.error) {
      toast.error(result.error)
      return
    }
    toast.success('Dokumentet er slettet')
    fetchDocuments(page)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Dokumenter</h2>
          <p className="text-sm text-gray-500">{total} dokument{total !== 1 ? 'er' : ''}</p>
        </div>
        <Button
          size="sm"
          onClick={() => setIsUploadOpen(true)}
          disabled={!storageConfigured}
        >
          <Upload className="mr-2 h-4 w-4" />
          Upload
        </Button>
      </div>

      <DocumentList
        documents={documents}
        total={total}
        page={page}
        pageSize={PAGE_SIZE}
        isLoading={isLoading}
        onPageChange={fetchDocuments}
        onDelete={handleDelete}
        onDocumentClick={(id) => router.push(`/documents/${id}`)}
      />

      {isUploadOpen && (
        <DocumentUploadModal
          companies={[{ id: companyId, name: companyName }]}
          cases={cases}
          initialCompanyId={companyId}
          onClose={() => setIsUploadOpen(false)}
          onComplete={() => {
            setIsUploadOpen(false)
            toast.success('Dokumentet er uploadet')
            fetchDocuments(1)
          }}
        />
      )}
    </div>
  )
}