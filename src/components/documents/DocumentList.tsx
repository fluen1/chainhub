'use client'

import { FileText, Image, FileSpreadsheet, MoreVertical, Download, Trash2, Eye } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import type { DocumentWithRelations } from '@/types/document'
import { SENSITIVITY_INFO, FILE_TYPE_LABELS } from '@/types/document'
import { formatDistanceToNow } from 'date-fns'
import { da } from 'date-fns/locale'

interface DocumentListProps {
  documents: DocumentWithRelations[]
  total: number
  page: number
  pageSize: number
  isLoading: boolean
  onPageChange: (page: number) => void
  onDelete: (id: string) => void
  onDocumentClick: (id: string) => void
}

function getFileIcon(fileType: string) {
  if (fileType === 'application/pdf') return FileText
  if (fileType.startsWith('image/')) return Image
  if (fileType.includes('spreadsheet')) return FileSpreadsheet
  return FileText
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function DocumentList({
  documents,
  total,
  page,
  pageSize,
  isLoading,
  onPageChange,
  onDelete,
  onDocumentClick,
}: DocumentListProps) {
  const totalPages = Math.ceil(total / pageSize)

  if (isLoading) {
    return (
      <div className="space-y-2 animate-pulse">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 rounded-lg border border-gray-100 bg-white p-4"
          >
            <div className="h-10 w-10 rounded bg-gray-200" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-48 rounded bg-gray-200" />
              <div className="h-3 w-32 rounded bg-gray-200" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (documents.length === 0) {
    return (
      <div className="rounded-lg border-2 border-dashed border-gray-200 py-16 text-center">
        <FileText className="mx-auto h-12 w-12 text-gray-300" />
        <p className="mt-3 text-sm font-medium text-gray-900">Ingen dokumenter fundet</p>
        <p className="mt-1 text-sm text-gray-500">
          Upload det første dokument for at komme i gang
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="text-sm text-gray-500">
        Viser {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} af {total} dokumenter
      </div>

      <div className="space-y-2">
        {documents.map((doc) => {
          const FileIcon = getFileIcon(doc.fileType)
          const sensitivityInfo = SENSITIVITY_INFO[doc.sensitivity]
          const fileTypeLabel = FILE_TYPE_LABELS[doc.fileType] ?? doc.fileType

          return (
            <div
              key={doc.id}
              className="group flex items-center gap-4 rounded-lg border border-gray-100 bg-white p-4 hover:border-gray-200 hover:bg-gray-50 transition-colors cursor-pointer"
              onClick={() => onDocumentClick(doc.id)}
            >
              {/* Fil-ikon */}
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-100">
                <FileIcon className="h-5 w-5 text-gray-500" />
              </div>

              {/* Dokumentinfo */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate font-medium text-gray-900">
                    {doc.title}
                  </span>
                  <span className="shrink-0 text-xs text-gray-400">{fileTypeLabel}</span>
                </div>
                <div className="mt-0.5 flex items-center gap-3 text-xs text-gray-500">
                  <span>{doc.fileName}</span>
                  <span>•</span>
                  <span>{formatFileSize(doc.fileSizeBytes)}</span>
                  {doc.company && (
                    <>
                      <span>•</span>
                      <span>{doc.company.name}</span>
                    </>
                  )}
                  {doc.case && (
                    <>
                      <span>•</span>
                      <span>{doc.case.title}</span>
                    </>
                  )}
                  <span>•</span>
                  <span>
                    {formatDistanceToNow(new Date(doc.uploadedAt), {
                      addSuffix: true,
                      locale: da,
                    })}
                  </span>
                </div>
              </div>

              {/* Sensitivity badge */}
              <span
                className={cn(
                  'shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium',
                  sensitivityInfo.bgColor,
                  sensitivityInfo.color
                )}
              >
                {sensitivityInfo.label}
              </span>

              {/* Handlinger */}
              <div
                className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => e.stopPropagation()}
              >
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onDocumentClick(doc.id)}>
                      <Eye className="mr-2 h-4 w-4" />
                      Vis detaljer
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-red-600"
                      onClick={() => onDelete(doc.id)}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Slet
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          )
        })}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
          >
            Forrige
          </Button>
          <span className="text-sm text-gray-600">
            Side {page} af {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
          >
            Næste
          </Button>
        </div>
      )}
    </div>
  )
}