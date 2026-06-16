'use client'

import { Upload, X, FileIcon, Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useCallback, useRef } from 'react'
import { toast } from 'sonner'
import { BButton, BTextField } from '@/components/ui/b'
import { formatFileSize } from '@/lib/labels'
import { cn } from '@/lib/utils'

// ─────────────────────────────────────────────────────────────────────────────
// FileUpload — B-stil port. Drag-and-drop zone + titel-felt + upload-knap.
// Funktionalitet bevaret 1:1 — kun visuelt porteret.
// ─────────────────────────────────────────────────────────────────────────────

interface FileUploadProps {
  companyId?: string
  caseId?: string
  className?: string
}

export function FileUpload({ companyId, caseId, className }: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [title, setTitle] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) setSelectedFile(file)
  }, [])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) setSelectedFile(file)
  }, [])

  const handleUpload = async () => {
    if (!selectedFile) return
    setIsUploading(true)

    const formData = new FormData()
    formData.append('file', selectedFile)
    if (companyId) formData.append('companyId', companyId)
    if (caseId) formData.append('caseId', caseId)
    if (title) formData.append('title', title)

    try {
      const res = await fetch('/api/upload', { method: 'POST', body: formData })
      const result = await res.json()
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('Dokument uploadet')
        setSelectedFile(null)
        setTitle('')
        if (fileInputRef.current) fileInputRef.current.value = ''
        router.refresh()
      }
    } catch {
      toast.error('Upload fejlede — prøv igen')
    } finally {
      setIsUploading(false)
    }
  }

  const handleRemoveFile = () => {
    setSelectedFile(null)
    setTitle('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div className={cn('space-y-2', className)}>
      {/* Drop zone */}
      <div
        role="button"
        tabIndex={selectedFile ? -1 : 0}
        aria-label="Vælg fil eller træk og slip"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !selectedFile && fileInputRef.current?.click()}
        onKeyDown={(e) => {
          if (!selectedFile && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault()
            fileInputRef.current?.click()
          }
        }}
        className={cn(
          'relative rounded-[4px] border-2 border-dashed p-5 text-center transition-colors',
          isDragging
            ? 'cursor-copy border-b-blue-fg bg-b-blue-bg'
            : selectedFile
              ? 'cursor-default border-b-border bg-b-panel'
              : 'cursor-pointer border-b-border bg-b-panel hover:border-b-border-strong hover:bg-b-row-hover'
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.docx,.png,.jpg,.jpeg"
          onChange={handleFileSelect}
          className="hidden"
        />

        {selectedFile ? (
          <div className="flex items-center justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <FileIcon className="h-6 w-6 shrink-0 text-b-2" />
              <div className="min-w-0">
                <p className="truncate text-[13px] font-medium text-b-1">{selectedFile.name}</p>
                <p className="text-[11px] text-b-3">{formatFileSize(selectedFile.size)}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                handleRemoveFile()
              }}
              aria-label="Fjern valgt fil"
              className="rounded-[4px] p-1 text-b-3 hover:bg-b-row-hover hover:text-b-1"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div>
            <Upload className="mx-auto h-6 w-6 text-b-3" />
            <p className="mt-1.5 text-[13px] font-medium text-b-2">
              Træk fil hertil eller klik for at vælge
            </p>
            <p className="mt-0.5 text-[11px] text-b-3">PDF, DOCX, PNG eller JPG — maks 10 MB</p>
          </div>
        )}
      </div>

      {/* Titel + upload knap */}
      {selectedFile && (
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <BTextField
              label="Titel (valgfrit)"
              value={title}
              onChange={setTitle}
              placeholder={selectedFile.name}
              disabled={isUploading}
            />
          </div>
          <BButton primary onClick={handleUpload} disabled={isUploading} className="shrink-0">
            {isUploading ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Uploader…
              </>
            ) : (
              <>
                <Upload className="h-3.5 w-3.5" />
                Upload
              </>
            )}
          </BButton>
        </div>
      )}
    </div>
  )
}
