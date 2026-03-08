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
      setDocuments(result.data)
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
        <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Upload dokument
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Upload dokumenter</DialogTitle>
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
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <form onSubmit={handleSearch} className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              type="search"
              placeholder="Søg i dokumenter..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </form>
        <Select value={sensitivity} onValueChange={setSensitivity}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Sensitivitet" />
          </SelectTrigger>
          <SelectContent>
            {SENSITIVITY_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={fileType} onValueChange={setFileType}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Filtype" />
          </SelectTrigger>
          <SelectContent>
            {FILE_TYPE_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Content */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <DocumentCardSkeleton key={i} />
          ))}
        </div>
      ) : error ? (
        <div className="text-center py-12">
          <p className="text-red-600">{error}</p>
          <Button variant="outline" className="mt-4" onClick={fetchDocuments}>
            Prøv igen
          </Button>
        </div>
      ) : documents.length === 0 ? (
        <div className="text-center py-12">
          <FileX className="mx-auto h-12 w-12 text-gray-300" />
          <h3 className="mt-4 text-lg font-medium text-gray-900">
            Ingen dokumenter fundet
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            {search || sensitivity !== 'all' || fileType !== 'all'
              ? 'Prøv at ændre dine filtre'
              : 'Upload det første dokument for at komme i gang'}
          </p>
          {!search && sensitivity === 'all' && fileType === 'all' && (
            <Button
              className="mt-4"
              onClick={() => setShowUploadDialog(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Upload dokument
            </Button>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {documents.map((document) => (
            <DocumentCard
              key={document.id}
              document={document}
              onDeleted={fetchDocuments}
            />
          ))}
        </div>
      )}
    </div>
  )
}