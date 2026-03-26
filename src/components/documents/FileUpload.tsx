'use client'

import { useState, useCallback, useRef } from 'react'
import { Upload, X, FileIcon, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'

interface FileUploadProps {
  companyId?: string
  caseId?: string
  className?: string
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
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
    <div className={cn('space-y-3', className)}>
      {/* Drop zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !selectedFile && fileInputRef.current?.click()}
        className={cn(
          'relative rounded-lg border-2 border-dashed p-6 text-center transition-colors cursor-pointer',
          isDragging
            ? 'border-blue-400 bg-blue-50'
            : selectedFile
              ? 'border-gray-300 bg-white cursor-default'
              : 'border-gray-300 hover:border-gray-400 bg-white'
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
            <div className="flex items-center gap-3 min-w-0">
              <FileIcon className="h-8 w-8 shrink-0 text-gray-400" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {selectedFile.name}
                </p>
                <p className="text-xs text-gray-500">
                  {formatFileSize(selectedFile.size)}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                handleRemoveFile()
              }}
              className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        ) : (
          <div>
            <Upload className="mx-auto h-8 w-8 text-gray-400" />
            <p className="mt-2 text-sm font-medium text-gray-700">
              Træk fil hertil eller klik for at vælge
            </p>
            <p className="mt-1 text-xs text-gray-500">
              PDF, DOCX, PNG eller JPG — maks 10 MB
            </p>
          </div>
        )}
      </div>

      {/* Title input + upload button */}
      {selectedFile && (
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <label htmlFor="doc-title" className="block text-sm font-medium text-gray-700 mb-1">
              Titel (valgfrit)
            </label>
            <input
              id="doc-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={selectedFile.name}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <button
            type="button"
            onClick={handleUpload}
            disabled={isUploading}
            className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isUploading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Uploader…
              </>
            ) : (
              <>
                <Upload className="h-4 w-4" />
                Upload
              </>
            )}
          </button>
        </div>
      )}
    </div>
  )
}
