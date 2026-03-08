'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  FileText,
  Image,
  FileSpreadsheet,
  Download,
  Trash2,
  ArrowLeft,
  Building2,
  Briefcase,
  Calendar,
  Eye,
  Edit2,
  Shield,
} from 'lucide-react'
import { getDocumentDownloadUrl, deleteDocument, updateDocument } from '@/actions/documents'
import { Button } from '@/components/ui/button'
import { DocumentPreview } from './DocumentPreview'
import { DocumentEditModal } from './DocumentEditModal'
import { cn } from '@/lib/utils'
import { SENSITIVITY_INFO, FILE_TYPE_LABELS } from '@/types/document'
import type { DocumentWithRelations } from '@/types/document'
import { format } from 'date-fns'
import { da } from 'date-fns/locale'

interface DocumentDetailClientProps {
  document: DocumentWithRelations
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function getFileIcon(fileType: string) {
  if (fileType === 'application/pdf') return FileText
  if (fileType.startsWith('image/')) return Image
  if (fileType.includes('spreadsheet')) return FileSpreadsheet
  return FileText
}

function canPreview(fileType: string): boolean {
  return (
    fileType === 'application/pdf' ||
    fileType === 'image/png' ||
    fileType === 'image/jpeg'
  )
}

export function DocumentDetailClient({ document: initialDoc }: DocumentDetailClientProps) {
  const router = useRouter()
  const [document, setDocument] = useState(initialDoc)
  const [isDownloading, setIsDownloading] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [isLoadingPreview, setIsLoadingPreview] = useState(false)

  const sensitivityInfo = SENSITIVITY_INFO[document.sensitivity]
  const FileIcon = getFileIcon(document.fileType)
  const fileTypeLabel = FILE_TYPE_LABELS[document.fileType] ?? document.fileType
  const showPreviewOption = canPreview(document.fileType)

  const handleDownload = async () => {
    setIsDownloading(true)
    try {
      const result = await getDocumentDownloadUrl({ documentId: document.id })
      if (result.error) {
        toast.error(result.error)
        return
      }
      // Åbn download i ny fane
      const a = window.document.createElement('a')
      a.href = result.data.url
      a.download = result.data.fileName
      a.target = '_blank'
      a.rel = 'noopener noreferrer'
      a.click()
      toast.success('Download startet')
    } finally {
      setIsDownloading(false)
    }
  }

  const handlePreview = async () => {
    if (previewUrl) {
      setPreviewUrl(null)
      return
    }
    setIsLoadingPreview(true)
    try {
      const result = await getDocumentDownloadUrl({ documentId: document.id })
      if (result.error) {
        toast.error(result.error)
        return
      }
      setPreviewUrl(result.data.url)
    } finally {
      setIsLoadingPreview(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Er du sikker på, at du vil slette dette dokument? Handlingen kan ikke fortrydes.')) {
      return
    }
    setIsDeleting(true)
    try {
      const result = await deleteDocument({ documentId: document.id })
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success('Dokumentet er slettet')
      router.push('/documents')
    } finally {
      setIsDeleting(false)
    }
  }

  const handleEditComplete = (updatedDoc: DocumentWithRelations) => {
    setDocument(updatedDoc)
    setIsEditOpen(false)
    toast.success('Dokumentet er opdateret')
  }

  return (
    <div className="space-y-6 p-6">
      {/* Tilbage-knap */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft className="h-4 w-4" />
        Tilbage til dokumenter
      </button>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Venstre kolonne: Metadata */}
        <div className="space-y-4 lg:col-span-1">
          {/* Dokument-header */}
          <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gray-100">
                <FileIcon className="h-6 w-6 text-gray-500" />
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="text-lg font-semibold text-gray-900 leading-tight">
                  {document.title}
                </h1>
                <p className="mt-0.5 text-sm text-gray-500">{document.fileName}</p>
              </div>
            </div>

            {/* Sensitivity badge */}
            <div className="mt-4">
              <span
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium',
                  sensitivityInfo.bgColor,
                  sensitivityInfo.color
                )}
              >
                <Shield className="h-3 w-3" />
                {sensitivityInfo.label}
              </span>
            </div>

            {/* Handlingsknapper */}
            <div className="mt-4 flex flex-col gap-2">
              {showPreviewOption && (
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={handlePreview}
                  disabled={isLoadingPreview}
                >
                  <Eye className="mr-2 h-4 w-4" />
                  {isLoadingPreview
                    ? 'Henter preview...'
                    : previewUrl
                    ? 'Skjul preview'
                    : 'Vis preview'}
                </Button>
              )}
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={handleDownload}
                disabled={isDownloading}
              >
                <Download className="mr-2 h-4 w-4" />
                {isDownloading ? 'Downloader...' : 'Download'}
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => setIsEditOpen(true)}
              >
                <Edit2 className="mr-2 h-4 w-4" />
                Rediger
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start text-red-600 hover:bg-red-50 hover:text-red-700"
                onClick={handleDelete}
                disabled={isDeleting}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                {isDeleting ? 'Sletter...' : 'Slet dokument'}
              </Button>
            </div>
          </div>

          {/* Metadata */}
          <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-sm font-semibold text-gray-700">Detaljer</h2>
            <dl className="space-y-3">
              <div>
                <dt className="text-xs text-gray-500">Filtype</dt>
                <dd className="mt-0.5 text-sm text-gray-900">{fileTypeLabel}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">Størrelse</dt>
                <dd className="mt-0.5 text-sm text-gray-900">
                  {formatFileSize(document.fileSizeBytes)}
                </dd>
              </div>
              {document.company && (
                <div>
                  <dt className="flex items-center gap-1 text-xs text-gray-500">
                    <Building2 className="h-3 w-3" />
                    Selskab
                  </dt>
                  <dd className="mt-0.5 text-sm text-gray-900">
                    {document.company.name}
                  </dd>
                </div>
              )}
              {document.case && (
                <div>
                  <dt className="flex items-center gap-1 text-xs text-gray-500">
                    <Briefcase className="h-3 w-3" />
                    Sag
                  </dt>
                  <dd className="mt-0.5 text-sm text-gray-900">
                    {document.case.title}
                  </dd>
                </div>
              )}
              {document.folderPath && (
                <div>
                  <dt className="text-xs text-gray-500">Mappe</dt>
                  <dd className="mt-0.5 font-mono text-xs text-gray-700">
                    {document.folderPath}
                  </dd>
                </div>
              )}
              <div>
                <dt className="flex items-center gap-1 text-xs text-gray-500">
                  <Calendar className="h-3 w-3" />
                  Uploadet
                </dt>
                <dd className="mt-0.5 text-sm text-gray-900">
                  {format(new Date(document.uploadedAt), 'dd. MMM yyyy HH:mm', {
                    locale: da,
                  })}
                </dd>
              </div>
              {document.lastViewedAt && (
                <div>
                  <dt className="text-xs text-gray-500">Sidst set</dt>
                  <dd className="mt-0.5 text-sm text-gray-900">
                    {format(new Date(document.lastViewedAt), 'dd. MMM yyyy HH:mm', {
                      locale: da,
                    })}
                  </dd>
                </div>
              )}
              {document.description && (
                <div>
                  <dt className="text-xs text-gray-500">Beskrivelse</dt>
                  <dd className="mt-0.5 text-sm text-gray-700">
                    {document.description}
                  </dd>
                </div>
              )}
            </dl>
          </div>
        </div>

        {/* Højre kolonne: Preview */}
        <div className="lg:col-span-2">
          {previewUrl ? (
            <DocumentPreview
              url={previewUrl}
              fileType={document.fileType}
              fileName={document.fileName}
            />
          ) : (
            <div className="flex h-96 items-center justify-center rounded-xl border-2 border-dashed border-gray-200 bg-white">
              <div className="text-center">
                <FileIcon className="mx-auto h-12 w-12 text-gray-300" />
                <p className="mt-3 text-sm text-gray-500">
                  {showPreviewOption
                    ? 'Klik på "Vis preview" for at åbne dokumentet'
                    : 'Preview er ikke tilgængeligt for denne filtype'}
                </p>
                {!showPreviewOption && (
                  <p className="mt-1 text-xs text-gray-400">
                    Download filen for at åbne den
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Redigér modal */}
      {isEditOpen && (
        <DocumentEditModal
          document={document}
          onClose={() => setIsEditOpen(false)}
          onComplete={handleEditComplete}
        />
      )}
    </div>
  )
}