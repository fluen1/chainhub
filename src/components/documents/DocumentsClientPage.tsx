'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Search, Upload, Filter, X } from 'lucide-react'
import { listDocuments, deleteDocument } from '@/actions/documents'
import { DocumentList } from './DocumentList'
import { DocumentUploadModal } from './DocumentUploadModal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { DocumentWithRelations } from '@/types/document'

interface Company {
  id: string
  name: string
}

interface CaseItem {
  id: string
  title: string
}

interface DocumentsClientPageProps {
  companies: Company[]
  cases: CaseItem[]
  storageConfigured: boolean
}

const SENSITIVITY_OPTIONS = [
  { value: 'PUBLIC', label: 'Offentlig' },
  { value: 'STANDARD', label: 'Standard' },
  { value: 'INTERN', label: 'Intern' },
  { value: 'FORTROLIG', label: 'Fortrolig' },
  { value: 'STRENGT_FORTROLIG', label: 'Strengt fortrolig' },
]

const FILE_TYPE_OPTIONS = [
  { value: 'application/pdf', label: 'PDF' },
  { value: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', label: 'Word' },
  { value: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', label: 'Excel' },
  { value: 'image/png', label: 'PNG' },
  { value: 'image/jpeg', label: 'JPEG' },
]

export function DocumentsClientPage({
  companies,
  cases,
  storageConfigured,
}: DocumentsClientPageProps) {
  const router = useRouter()
  const [documents, setDocuments] = useState<DocumentWithRelations[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [isLoading, setIsLoading] = useState(false)
  const [isUploadOpen, setIsUploadOpen] = useState(false)

  // Filtres
  const [search, setSearch] = useState('')
  const [selectedCompany, setSelectedCompany] = useState<string>('')
  const [selectedCase, setSelectedCase] = useState<string>('')
  const [selectedSensitivity, setSelectedSensitivity] = useState<string>('')
  const [selectedFileType, setSelectedFileType] = useState<string>('')

  const PAGE_SIZE = 20

  const fetchDocuments = useCallback(async (currentPage = 1) => {
    setIsLoading(true)
    try {
      const result = await listDocuments({
        search: search || undefined,
        companyId: selectedCompany || undefined,
        caseId: selectedCase || undefined,
        sensitivity: (selectedSensitivity as 'PUBLIC' | 'STANDARD' | 'INTERN' | 'FORTROLIG' | 'STRENGT_FORTROLIG') || undefined,
        fileType: selectedFileType || undefined,
        page: currentPage,
        pageSize: PAGE_SIZE,
      })

      if (result.error) {
        toast.error(result.error)
        return
      }

      setDocuments(result.data!.documents)
      setTotal(result.data!.total)
      setPage(currentPage)
    } finally {
      setIsLoading(false)
    }
  }, [search, selectedCompany, selectedCase, selectedSensitivity, selectedFileType])

  // Indlæs ved mount
  useState(() => {
    fetchDocuments(1)
  })

  const handleSearch = () => {
    fetchDocuments(1)
  }

  const handleClearFilters = () => {
    setSearch('')
    setSelectedCompany('')
    setSelectedCase('')
    setSelectedSensitivity('')
    setSelectedFileType('')
    // Fetch med tomme filtre
    setTimeout(() => fetchDocuments(1), 0)
  }

  const handleDelete = async (documentId: string) => {
    const result = await deleteDocument({ documentId })
    if (result.error) {
      toast.error(result.error)
      return
    }
    toast.success('Dokumentet er slettet')
    fetchDocuments(page)
  }

  const handleUploadComplete = () => {
    setIsUploadOpen(false)
    toast.success('Dokumentet er uploadet')
    fetchDocuments(1)
  }

  const hasActiveFilters =
    search || selectedCompany || selectedCase || selectedSensitivity || selectedFileType

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-1 items-center gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              placeholder="Søg i dokumenter..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="pl-9"
            />
          </div>
          <Button variant="outline" onClick={handleSearch} size="sm">
            Søg
          </Button>
        </div>

        <div className="flex items-center gap-2">
          {/* Selskabsfilter */}
          <Select value={selectedCompany} onValueChange={setSelectedCompany}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Alle selskaber" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Alle selskaber</SelectItem>
              {companies.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Sagsfilter */}
          <Select value={selectedCase} onValueChange={setSelectedCase}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Alle sager" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Alle sager</SelectItem>
              {cases.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Sensitivity-filter */}
          <Select value={selectedSensitivity} onValueChange={setSelectedSensitivity}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Alle niveauer" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Alle niveauer</SelectItem>
              {SENSITIVITY_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Filtype-filter */}
          <Select value={selectedFileType} onValueChange={setSelectedFileType}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Alle typer" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Alle typer</SelectItem>
              {FILE_TYPE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={handleClearFilters}>
              <X className="mr-1 h-4 w-4" />
              Ryd filtre
            </Button>
          )}
        </div>

        <Button
          onClick={() => setIsUploadOpen(true)}
          disabled={!storageConfigured}
          className="ml-auto"
        >
          <Upload className="mr-2 h-4 w-4" />
          Upload dokument
        </Button>
      </div>

      {/* Dokumentliste */}
      <DocumentList
        documents={documents}
        total={total}
        page={page}
        pageSize={PAGE_SIZE}
        isLoading={isLoading}
        onPageChange={(p) => fetchDocuments(p)}
        onDelete={handleDelete}
        onDocumentClick={(id) => router.push(`/documents/${id}`)}
      />

      {/* Upload modal */}
      {isUploadOpen && (
        <DocumentUploadModal
          companies={companies}
          cases={cases}
          onClose={() => setIsUploadOpen(false)}
          onComplete={handleUploadComplete}
        />
      )}
    </div>
  )
}