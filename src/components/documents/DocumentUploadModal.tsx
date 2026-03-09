'use client'

import { useState, useRef, useCallback } from 'react'
import { X, Upload, FileText, AlertCircle, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'
import { requestDocumentUploadUrl, confirmDocumentUpload } from '@/actions/documents'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { ACCEPTED_FILE_TYPES, MAX_FILE_SIZE_BYTES, ACCEPTED_MIME_TYPES } from '@/lib/storage'

interface Company {
  id: string
  name: string
}

interface CaseItem {
  id: string
  title: string
}

interface DocumentUploadModalProps {
  companies: Company[]
  cases: CaseItem[]
  onClose: () => void
  onComplete: () => void
  // Forudindstillede værdier
  initialCompanyId?: string
  initialCaseId?: string
}

type UploadStatus = 'idle' | 'uploading' | 'confirming' | 'done' | 'error'

const SENSITIVITY_OPTIONS = [
  { value: 'PUBLIC', label: 'Offentlig' },
  { value: 'STANDARD', label: 'Standard' },
  { value: 'INTERN', label: 'Intern' },
  { value: 'FORTROLIG', label: 'Fortrolig' },
  { value: 'STRENGT_FORTROLIG', label: 'Strengt fortrolig' },
]

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function DocumentUploadModal({
  companies,
  cases,
  onClose,
  onComplete,
  initialCompanyId,
  initialCaseId,
}: DocumentUploadModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [status, setStatus] = useState<UploadStatus>('idle')
  const [errorMessage, setErrorMessage] = useState('')

  // Form-felter
  const [title, setTitle] = useState('')
  const [companyId, setCompanyId] = useState(initialCompanyId ?? '')
  const [caseId, setCaseId] = useState(initialCaseId ?? '')
  const [sensitivity, setSensitivity] = useState('STANDARD')
  const [description, setDescription] = useState('')
  const [folderPath, setFolderPath] = useState('')

  const validateFile = (file: File): string | null => {
    if (!ACCEPTED_MIME_TYPES.includes(file.type as (typeof ACCEPTED_MIME_TYPES)[number])) {
      return `Filtypen "${file.type}" er ikke tilladt. Accepterede typer: PDF, DOCX, XLSX, PNG, JPG`
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return `Filen er for stor (${formatFileSize(file.size)}). Maksimum er 50MB`
    }
    return null
  }

  const handleFileSelect = (file: File) => {
    const error = validateFile(file)
    if (error) {
      toast.error(error)
      return
    }
    setSelectedFile(file)
    if (!title) {
      setTitle(file.name.replace(/\.[^/.]+$/, ''))
    }
  }

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragOver(false)
      const file = e.dataTransfer.files[0]
      if (file) handleFileSelect(file)
    },
    [title]
  )

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }

  const handleDragLeave = () => setIsDragOver(false)

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFileSelect(file)
  }

  const handleUpload = async () => {
    if (!selectedFile || !title.trim()) {
      toast.error('Vælg en fil og angiv en titel')
      return
    }

    setStatus('uploading')
    setUploadProgress(0)
    setErrorMessage('')

    try {
      // 1. Anmod om upload URL
      const urlResult = await requestDocumentUploadUrl({
        fileName: selectedFile.name,
        fileType: selectedFile.type,
        fileSizeBytes: selectedFile.size,
        companyId: companyId || undefined,
        caseId: caseId || undefined,
      })

      if (urlResult.error) {
        throw new Error(urlResult.error)
      }

      setUploadProgress(20)

      // 2. Upload til storage
      const uploadResponse = await fetch(urlResult.data!.uploadUrl, {
        method: 'PUT',
        body: selectedFile,
        headers: { 'Content-Type': selectedFile.type },
      })

      if (!uploadResponse.ok) {
        throw new Error('Upload til storage fejlede')
      }

      setUploadProgress(70)
      setStatus('confirming')

      // 3. Bekræft upload og gem metadata
      const confirmResult = await confirmDocumentUpload({
        storageKey: urlResult.data!.storageKey,
        title: title.trim(),
        fileName: selectedFile.name,
        fileType: selectedFile.type,
        fileSizeBytes: selectedFile.size,
        companyId: companyId || undefined,
        caseId: caseId || undefined,
        sensitivity: sensitivity as 'PUBLIC' | 'STANDARD' | 'INTERN' | 'FORTROLIG' | 'STRENGT_FORTROLIG',
        description: description || undefined,
        folderPath: folderPath || undefined,
      })

      if (confirmResult.error) {
        throw new Error(confirmResult.error)
      }

      setUploadProgress(100)
      setStatus('done')
      toast.success('Dokument uploadet')
      setTimeout(() => onComplete(), 1000)
    } catch (err) {
      setStatus('error')
      setErrorMessage(err instanceof Error ? err.message : 'Upload fejlede')
      toast.error('Upload fejlede')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h2 className="text-lg font-semibold">Upload dokument</h2>
          <button
            onClick={onClose}
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 px-6 py-4">
          {/* Drop zone */}
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              'cursor-pointer rounded-lg border-2 border-dashed p-6 text-center transition-colors',
              isDragOver
                ? 'border-blue-400 bg-blue-50'
                : 'border-gray-300 hover:border-gray-400'
            )}
          >
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept={ACCEPTED_FILE_TYPES}
              onChange={handleInputChange}
            />
            {selectedFile ? (
              <div className="flex items-center justify-center gap-3">
                <FileText className="h-8 w-8 text-blue-500" />
                <div className="text-left">
                  <p className="font-medium text-sm">{selectedFile.name}</p>
                  <p className="text-xs text-gray-500">{formatFileSize(selectedFile.size)}</p>
                </div>
              </div>
            ) : (
              <div>
                <Upload className="mx-auto h-8 w-8 text-gray-400 mb-2" />
                <p className="text-sm text-gray-600">
                  Træk fil hertil eller <span className="text-blue-600">klik for at vælge</span>
                </p>
                <p className="text-xs text-gray-400 mt-1">PDF, DOCX, XLSX, PNG, JPG — maks 50MB</p>
              </div>
            )}
          </div>

          {/* Titel */}
          <div className="space-y-1">
            <Label htmlFor="doc-title">Titel *</Label>
            <Input
              id="doc-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Dokumenttitel"
            />
          </div>

          {/* Selskab */}
          {companies.length > 0 && (
            <div className="space-y-1">
              <Label>Selskab</Label>
              <Select value={companyId} onValueChange={setCompanyId}>
                <SelectTrigger>
                  <SelectValue placeholder="Vælg selskab (valgfrit)" />
                </SelectTrigger>
                <SelectContent>
                  {companies.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Sensitivitet */}
          <div className="space-y-1">
            <Label>Sensitivitet</Label>
            <Select value={sensitivity} onValueChange={setSensitivity}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SENSITIVITY_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Status/progress */}
          {status === 'uploading' || status === 'confirming' ? (
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-gray-500">
                <span>{status === 'confirming' ? 'Gemmer metadata...' : 'Uploader...'}</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="h-2 w-full rounded-full bg-gray-200">
                <div
                  className="h-2 rounded-full bg-blue-600 transition-all"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          ) : null}

          {status === 'error' && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              {errorMessage}
            </div>
          )}

          {status === 'done' && (
            <div className="flex items-center gap-2 rounded-lg bg-green-50 p-3 text-sm text-green-700">
              <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
              Dokument uploadet!
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 border-t px-6 py-4">
          <Button variant="outline" onClick={onClose} disabled={status === 'uploading' || status === 'confirming'}>
            Annuller
          </Button>
          <Button
            onClick={handleUpload}
            disabled={!selectedFile || !title.trim() || status === 'uploading' || status === 'confirming' || status === 'done'}
          >
            <Upload className="h-4 w-4 mr-2" />
            Upload
          </Button>
        </div>
      </div>
    </div>
  )
}