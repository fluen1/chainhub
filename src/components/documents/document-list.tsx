'use client'

import { useState, useEffect } from 'react'
import { DocumentCard, DocumentCardSkeleton } from './document-card'
import { DocumentUpload } from './document-upload'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { listDocuments } from '@/actions/documents'
import { DocumentWithRelations } from '@/types/document'
import { SensitivityLevel } from '@prisma/client'
import { Plus, Search, FileX } from 'lucide-react'

interface DocumentListProps {
  companyId?: string
  caseId?: string
  contractId?: string
}

const SENSITIVITY_OPTIONS = [
  { value: 'all', label: 'Alle sensitiviteter' },
  { value: 'PUBLIC', label: 'Offentlig' },
  { value: 'STANDARD', label: 'Standard' },
  { value: 'INTERN', label: 'Intern' },
  { value: 'FORTROLIG', label: 'Fortrolig' },
  { value: 'STRENGT_FORTROLIG', label: 'Strengt fortrolig' },
]

const FILE_TYPE_OPTIONS = [
  { value: 'all', label: 'Alle filtyper' },
  { value: 'application/pdf', label: 'PDF' },
  {
    value: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    label: 'Word',
  },
  {
    value: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    label: 'Excel',
  },
  { value: 'image/png', label: 'PNG' },
  { value: 'image/jpeg', label: 'JPG' },
]

export function DocumentList({ companyId, caseId, contractId }: DocumentListProps) {
  const [documents, setDocuments] = useState<DocumentWithRelations[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [sensitivity, setSensitivity] = useState('all')
  const [fileType, setFileType] = useState('all')
  const [showUploadDialog, setShowUploadDialog] = useState(false)

  const fetchDocuments = async () => {
    setLoading(true)
    setError(null)

    const result = await listDocuments({
      companyId,
      caseId,
      contractId,
      search: search || undefined,
      sensitivity: sensitivity !== 'all' ? (sensitivity as SensitivityLevel) : undefined,
      fileType: fileType !== 'all' ? fileType : undefined,
    })

    if (result.error) {
      setError(result.error)
    } else {
      setDocuments(result.data!)
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchDocuments()
  }, [companyId, caseId, contractId, sensitivity, fileType])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    fetchDocuments()
  }

  const handleUploadComplete = () => {
    setShowUploadDialog(false)
    fetchDocuments()
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-semibold">Dokumenter</h2>
        <Button size="sm" onClick={() => setShowUploadDialog(true)}>
          <Plus className="h-4 w-4 mr-1" />
          Upload dokument
        </Button>
      </div>

      {/* Filtre */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <form onSubmit={handleSearch} className="flex flex-1 gap-2">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Søg i dokumenter..."
            className="flex-1"
          />
          <Button type="submit" variant="outline" size="sm">
            <Search className="h-4 w-4" />
          </Button>
        </form>

        <Select value={sensitivity} onValueChange={setSensitivity}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SENSITIVITY_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={fileType} onValueChange={setFileType}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FILE_TYPE_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Indhold */}
      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <DocumentCardSkeleton key={i} />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : documents.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-gray-500">
          <FileX className="mx-auto h-8 w-8 mb-2 opacity-50" />
          <p>Ingen dokumenter fundet</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {documents.map((doc) => (
            <DocumentCard
              key={doc.id}
              document={doc}
              onDeleted={fetchDocuments}
            />
          ))}
        </div>
      )}

      {/* Upload dialog */}
      {showUploadDialog && (
        <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Upload dokument</DialogTitle>
            </DialogHeader>
            <DocumentUpload
              companyId={companyId}
              caseId={caseId}
              contractId={contractId}
              onUploadComplete={handleUploadComplete}
              onCancel={() => setShowUploadDialog(false)}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}