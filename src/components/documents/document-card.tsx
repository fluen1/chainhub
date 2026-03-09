'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { DocumentPreview } from './document-preview'
import { formatFileSize, getFileTypeName } from '@/lib/validations/document'
import { getDocumentDownloadUrl, deleteDocument } from '@/actions/documents'
import { Document, Company, Case, SensitivityLevel } from '@prisma/client'
import {
  FileText,
  FileSpreadsheet,
  Image,
  File,
  MoreVertical,
  Download,
  Eye,
  Trash2,
  Building2,
  Briefcase,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface DocumentCardProps {
  document: Document & {
    company?: Company | null
    case?: Case | null
  }
  onDeleted?: () => void
}

const SENSITIVITY_COLORS: Record<SensitivityLevel, string> = {
  PUBLIC: 'bg-gray-100 text-gray-800',
  STANDARD: 'bg-blue-100 text-blue-800',
  INTERN: 'bg-yellow-100 text-yellow-800',
  FORTROLIG: 'bg-orange-100 text-orange-800',
  STRENGT_FORTROLIG: 'bg-red-100 text-red-800',
}

const SENSITIVITY_LABELS: Record<SensitivityLevel, string> = {
  PUBLIC: 'Offentlig',
  STANDARD: 'Standard',
  INTERN: 'Intern',
  FORTROLIG: 'Fortrolig',
  STRENGT_FORTROLIG: 'Strengt fortrolig',
}

function getFileIcon(fileType: string) {
  if (fileType === 'application/pdf') {
    return <FileText className="h-8 w-8 text-red-500" />
  }
  if (
    fileType ===
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) {
    return <FileText className="h-8 w-8 text-blue-500" />
  }
  if (
    fileType ===
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ) {
    return <FileSpreadsheet className="h-8 w-8 text-green-500" />
  }
  if (fileType === 'image/png' || fileType === 'image/jpeg') {
    return <Image className="h-8 w-8 text-purple-500" />
  }
  return <File className="h-8 w-8 text-gray-400" />
}

export function DocumentCard({ document, onDeleted }: DocumentCardProps) {
  const [showPreview, setShowPreview] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const handleDownload = async () => {
    const result = await getDocumentDownloadUrl(document.id)
    if (result.error) {
      toast.error(result.error)
      return
    }
    window.open(result.data!.downloadUrl, '_blank')
  }

  const handleDelete = async () => {
    if (!confirm('Er du sikker på, at du vil slette dette dokument?')) {
      return
    }

    setIsDeleting(true)
    const result = await deleteDocument(document.id)
    setIsDeleting(false)

    if (result.error) {
      toast.error(result.error)
      return
    }

    toast.success('Dokument slettet')
    onDeleted?.()
  }

  return (
    <>
      <Card className="group hover:shadow-md transition-shadow">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 mt-1">
              {getFileIcon(document.fileType)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-gray-900 truncate">{document.title}</p>
                  <p className="text-sm text-gray-500 truncate">{document.fileName}</p>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="flex-shrink-0 opacity-0 group-hover:opacity-100"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setShowPreview(true)}>
                      <Eye className="h-4 w-4 mr-2" />
                      Forhåndsvis
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleDownload}>
                      <Download className="h-4 w-4 mr-2" />
                      Download
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={handleDelete}
                      disabled={isDeleting}
                      className="text-red-600"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Slet
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <div className="flex flex-wrap items-center gap-2 mt-2">
                <Badge
                  className={cn(
                    'text-xs',
                    SENSITIVITY_COLORS[document.sensitivity as SensitivityLevel]
                  )}
                >
                  {SENSITIVITY_LABELS[document.sensitivity as SensitivityLevel]}
                </Badge>
                <span className="text-xs text-gray-400">
                  {getFileTypeName(document.fileType)}
                </span>
                <span className="text-xs text-gray-400">
                  {formatFileSize(document.fileSizeBytes)}
                </span>
              </div>

              {(document.company || document.case) && (
                <div className="flex flex-wrap items-center gap-3 mt-2">
                  {document.company && (
                    <div className="flex items-center gap-1 text-xs text-gray-500">
                      <Building2 className="h-3 w-3" />
                      {document.company.name}
                    </div>
                  )}
                  {document.case && (
                    <div className="flex items-center gap-1 text-xs text-gray-500">
                      <Briefcase className="h-3 w-3" />
                      {document.case.title}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <DocumentPreview
        documentId={document.id}
        fileName={document.fileName}
        fileType={document.fileType}
        fileSizeBytes={document.fileSizeBytes}
        open={showPreview}
        onOpenChange={setShowPreview}
      />
    </>
  )
}

export function DocumentCardSkeleton() {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start gap-3 animate-pulse">
          <div className="h-8 w-8 bg-gray-200 rounded mt-1 flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-gray-200 rounded w-3/4" />
            <div className="h-3 bg-gray-100 rounded w-1/2" />
            <div className="flex gap-2">
              <div className="h-5 bg-gray-100 rounded w-16" />
              <div className="h-5 bg-gray-100 rounded w-12" />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}