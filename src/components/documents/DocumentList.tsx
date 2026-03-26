'use client'

import { useState } from 'react'
import { FileText, Image, File as FileIcon, Download, Trash2, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { deleteDocument } from '@/actions/documents'

interface DocumentItem {
  id: string
  title: string
  file_name: string
  file_url: string
  file_size_bytes: number
  file_type: string
  uploaded_at: string
}

interface DocumentListProps {
  documents: DocumentItem[]
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function getFileIcon(fileType: string) {
  if (fileType === 'application/pdf') return FileText
  if (fileType.startsWith('image/')) return Image
  return FileIcon
}

function getFileTypeLabel(fileType: string): string {
  switch (fileType) {
    case 'application/pdf':
      return 'PDF'
    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      return 'DOCX'
    case 'image/png':
      return 'PNG'
    case 'image/jpeg':
      return 'JPG'
    default:
      return fileType.split('/').pop()?.toUpperCase() ?? 'FIL'
  }
}

export function DocumentList({ documents }: DocumentListProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const router = useRouter()

  const handleDelete = async (doc: DocumentItem) => {
    const confirmed = window.confirm(
      `Er du sikker på, at du vil slette "${doc.title}"?`
    )
    if (!confirmed) return

    setDeletingId(doc.id)
    const result = await deleteDocument(doc.id)
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success('Dokument slettet')
      router.refresh()
    }
    setDeletingId(null)
  }

  if (documents.length === 0) {
    return (
      <p className="text-sm text-gray-500">Ingen dokumenter endnu.</p>
    )
  }

  return (
    <div className="divide-y divide-gray-200 rounded-lg border bg-white shadow-sm">
      {documents.map((doc) => {
        const Icon = getFileIcon(doc.file_type)
        return (
          <div
            key={doc.id}
            className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-gray-50"
          >
            <div className="flex items-center gap-3 min-w-0">
              <Icon className="h-5 w-5 shrink-0 text-gray-400" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {doc.title}
                </p>
                <p className="text-xs text-gray-500">
                  {doc.file_name} · {getFileTypeLabel(doc.file_type)} ·{' '}
                  {formatFileSize(doc.file_size_bytes)} ·{' '}
                  {new Date(doc.uploaded_at).toLocaleDateString('da-DK')}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <a
                href={doc.file_url}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                title="Download"
              >
                <Download className="h-4 w-4" />
              </a>
              <button
                type="button"
                onClick={() => handleDelete(doc)}
                disabled={deletingId === doc.id}
                className="rounded-md p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                title="Slet"
              >
                {deletingId === doc.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
