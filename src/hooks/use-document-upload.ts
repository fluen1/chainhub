'use client'

import { useState, useCallback } from 'react'
import { requestUploadUrl, createDocument } from '@/actions/documents'
import { SensitivityLevel } from '@prisma/client'
import { ALLOWED_FILE_TYPES, MAX_FILE_SIZE_BYTES } from '@/lib/storage'

interface UploadOptions {
  companyId?: string
  caseId?: string
  contractId?: string
  sensitivity?: SensitivityLevel
  folderPath?: string
}

interface UploadProgress {
  fileName: string
  progress: number
  status: 'pending' | 'uploading' | 'success' | 'error'
  error?: string
  documentId?: string
}

export function useDocumentUpload(options: UploadOptions = {}) {
  const [uploads, setUploads] = useState<UploadProgress[]>([])
  const [isUploading, setIsUploading] = useState(false)

  const updateUpload = useCallback((fileName: string, updates: Partial<UploadProgress>) => {
    setUploads((prev) =>
      prev.map((u) => (u.fileName === fileName ? { ...u, ...updates } : u))
    )
  }, [])

  const uploadFile = useCallback(
    async (file: File): Promise<{ success: boolean; documentId?: string; error?: string }> => {
      // Validér fil
      if (!ALLOWED_FILE_TYPES.includes(file.type as any)) {
        return { success: false, error: 'Filtypen er ikke tilladt' }
      }
      if (file.size > MAX_FILE_SIZE_BYTES) {
        return { success: false, error: 'Filen er for stor (maks 50MB)' }
      }

      // Tilføj til uploads
      setUploads((prev) => [
        ...prev,
        { fileName: file.name, progress: 0, status: 'pending' },
      ])

      try {
        updateUpload(file.name, { status: 'uploading', progress: 10 })

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

        updateUpload(file.name, { progress: 30 })

        // 2. Upload til R2
        const uploadResponse = await fetch(urlResult.data.uploadUrl, {
          method: 'PUT',
          body: file,
          headers: { 'Content-Type': file.type },
        })

        if (!uploadResponse.ok) {
          throw new Error('Upload fejlede')
        }

        updateUpload(file.name, { progress: 70 })

        // 3. Opret dokument-record
        const createResult = await createDocument({
          title: file.name.replace(/\.[^/.]+$/, ''),
          fileUrl: urlResult.data.storagePath,
          fileName: file.name,
          fileSizeBytes: file.size,
          fileType: file.type,
          companyId: options.companyId || null,
          caseId: options.caseId || null,
          contractId: options.contractId || null,
          sensitivity: options.sensitivity,
          folderPath: options.folderPath || null,
        })

        if (createResult.error) {
          throw new Error(createResult.error)
        }

        updateUpload(file.name, {
          status: 'success',
          progress: 100,
          documentId: createResult.data.id,
        })

        return { success: true, documentId: createResult.data.id }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Upload fejlede'
        updateUpload(file.name, { status: 'error', error: errorMessage })
        return { success: false, error: errorMessage }
      }
    },
    [options, updateUpload]
  )

  const uploadFiles = useCallback(
    async (files: File[]) => {
      setIsUploading(true)
      const results = await Promise.all(files.map(uploadFile))
      setIsUploading(false)
      return results
    },
    [uploadFile]
  )

  const clearUploads = useCallback(() => {
    setUploads([])
  }, [])

  const removeUpload = useCallback((fileName: string) => {
    setUploads((prev) => prev.filter((u) => u.fileName !== fileName))
  }, [])

  return {
    uploads,
    isUploading,
    uploadFile,
    uploadFiles,
    clearUploads,
    removeUpload,
  }
}