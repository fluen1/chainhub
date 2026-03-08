'use client'

import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import {
  ALLOWED_FILE_TYPES,
  MAX_FILE_SIZE_BYTES,
  isStorageConfigured,
} from '@/lib/storage'
import {
  formatFileSize,
  getFileTypeName,
} from '@/lib/validations/document'
import { requestUploadUrl, createDocument } from '@/actions/documents'
import { SensitivityLevel } from '@prisma/client'
import { Upload, File, X, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'

interface DocumentUploadProps {
  companyId?: string
  caseId?: string
  contractId?: string
  sensitivity?: SensitivityLevel
  folderPath?: string
  onUploadComplete?: (documentId: string) => void
  onCancel?: () => void
}

type UploadState = 'idle' | 'uploading' | 'success' | 'error'

interface FileUpload {
  file: File
  state: UploadState
  progress: number
  error?: string
  documentId?: string
}

export function DocumentUpload({
  companyId,
  caseId,
  contractId,
  sensitivity = 'STANDARD',
  folderPath,
  onUploadComplete,
  onCancel,
}: DocumentUploadProps) {
  const [uploads, setUploads] = useState<FileUpload[]>([])

  const updateUpload = useCallback(
    (index: number, updates: Partial<FileUpload>) => {
      setUploads((prev) =>
        prev.map((u, i) => (i === index ? { ...u, ...updates } : u))
      )
    },
    []
  )

  const uploadFile = useCallback(
    async (fileUpload: FileUpload, index: number) => {
      const { file } = fileUpload

      updateUpload(index, { state: 'uploading', progress: 10 })

      try {
        // 1. Få signeret upload URL
        const urlResult = await requestUploadUrl({
          fileName: file.name,
          fileType: file.type,
          fileSizeBytes: file.size,
          entityType: 'document',
        })

        if (urlResult.error) {
          throw new Error(urlResult.error)
        }

        updateUpload(index, { progress: 30 })

        // 2. Upload filen til R2
        const uploadResponse = await fetch(urlResult.data.uploadUrl, {
          method: 'PUT',
          body: file,
          headers: {
            'Content-Type': file.type,
          },
        })

        if (!uploadResponse.ok) {
          throw new Error('Upload fejlede')
        }

        updateUpload(index, { progress: 70 })

        // 3. Opret dokument-record
        const createResult = await createDocument({
          title: file.name.replace(/\.[^/.]+$/, ''), // Fjern extension
          fileUrl: urlResult.data.storagePath,
          fileName: file.name,
          fileSizeBytes: file.size,
          fileType: file.type,
          companyId: companyId || null,
          caseId: caseId || null,
          contractId: contractId || null,
          sensitivity,
          folderPath: folderPath || null,
        })

        if (createResult.error) {
          throw new Error(createResult.error)
        }

        updateUpload(index, {
          state: 'success',
          progress: 100,
          documentId: createResult.data.id,
        })

        if (onUploadComplete) {
          onUploadComplete(createResult.data.id)
        }
      } catch (error) {
        updateUpload(index, {
          state: 'error',
          error: error instanceof Error ? error.message : 'Upload fejlede',
        })
      }
    },
    [companyId, caseId, contractId, sensitivity, folderPath, onUploadComplete, updateUpload]
  )

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      // Filtrer filer
      const validFiles = acceptedFiles.filter((file) => {
        if (!ALLOWED_FILE_TYPES.includes(file.type as any)) {
          toast.error(`${file.name}: Filtypen er ikke tilladt`)
          return false
        }
        if (file.size > MAX_FILE_SIZE_BYTES) {
          toast.error(`${file.name}: Filen er for stor (maks 50MB)`)
          return false
        }
        return true
      })

      if (validFiles.length === 0) return

      // Tilføj til uploads
      const newUploads: FileUpload[] = validFiles.map((file) => ({
        file,
        state: 'idle' as const,
        progress: 0,
      }))

      setUploads((prev) => [...prev, ...newUploads])

      // Start uploads
      const startIndex = uploads.length
      newUploads.forEach((fileUpload, i) => {
        uploadFile(fileUpload, startIndex + i)
      })
    },
    [uploads.length, uploadFile]
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'image/png': ['.png'],
      'image/jpeg': ['.jpg', '.jpeg'],
    },
    maxSize: MAX_FILE_SIZE_BYTES,
    multiple: true,
  })

  const removeUpload = (index: number) => {
    setUploads((prev) => prev.filter((_, i) => i !== index))
  }

  const hasActiveUploads = uploads.some((u) => u.state === 'uploading')
  const allComplete = uploads.length > 0 && uploads.every((u) => u.state === 'success')

  // Mock UI hvis storage ikke er konfigureret
  if (!isStorageConfigured) {
    return (
      <div className="rounded-lg border border-dashed border-yellow-300 bg-yellow-50 p-6 text-center">
        <AlertCircle className="mx-auto h-12 w-12 text-yellow-500" />
        <h3 className="mt-4 text-lg font-medium text-yellow-900">
          Filstorage er ikke konfigureret
        </h3>
        <p className="mt-2 text-sm text-yellow-700">
          For at aktivere dokumentupload skal følgende miljøvariabler sættes:
        </p>
        <ul className="mt-3 text-left text-sm text-yellow-700 list-disc list-inside space-y-1">
          <li>R2_ACCOUNT_ID</li>
          <li>R2_ACCESS_KEY_ID</li>
          <li>R2_SECRET_ACCESS_KEY</li>
          <li>R2_BUCKET_NAME</li>
        </ul>
        <p className="mt-4 text-xs text-yellow-600">
          Se dokumentation for opsætning af Cloudflare R2.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Dropzone */}
      <div
        {...getRootProps()}
        className={cn(
          'rounded-lg border-2 border-dashed p-8 text-center cursor-pointer transition-colors',
          isDragActive
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
        )}
      >
        <input {...getInputProps()} />
        <Upload className="mx-auto h-10 w-10 text-gray-400" />
        <p className="mt-2 text-sm font-medium text-gray-700">
          {isDragActive
            ? 'Slip filerne her...'
            : 'Træk og slip filer her, eller klik for at vælge'}
        </p>
        <p className="mt-1 text-xs text-gray-500">
          PDF, DOCX, XLSX, PNG, JPG — maks 50MB pr. fil
        </p>
      </div>

      {/* Upload liste */}
      {uploads.length > 0 && (
        <div className="space-y-2">
          {uploads.map((upload, index) => (
            <div
              key={`${upload.file.name}-${index}`}
              className="flex items-center gap-3 rounded-lg border p-3"
            >
              <File className="h-8 w-8 flex-shrink-0 text-gray-400" />
              <div className="flex-1 min-w-0">
                <p className="truncate text-sm font-medium text-gray-900">
                  {upload.file.name}
                </p>
                <p className="text-xs text-gray-500">
                  {getFileTypeName(upload.file.type)} • {formatFileSize(upload.file.size)}
                </p>
                {upload.state === 'uploading' && (
                  <Progress value={upload.progress} className="mt-1 h-1" />
                )}
                {upload.state === 'error' && (
                  <p className="mt-1 text-xs text-red-600">{upload.error}</p>
                )}
              </div>
              <div className="flex-shrink-0">
                {upload.state === 'idle' && (
                  <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                )}
                {upload.state === 'uploading' && (
                  <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
                )}
                {upload.state === 'success' && (
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                )}
                {upload.state === 'error' && (
                  <button
                    onClick={() => removeUpload(index)}
                    className="rounded p-1 hover:bg-gray-100"
                  >
                    <X className="h-5 w-5 text-red-500" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      {(onCancel || allComplete) && (
        <div className="flex justify-end gap-2">
          {onCancel && (
            <Button variant="outline" onClick={onCancel} disabled={hasActiveUploads}>
              {allComplete ? 'Luk' : 'Annullér'}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}