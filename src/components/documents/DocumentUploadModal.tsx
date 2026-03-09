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

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false)
  }, [])

  const handleUpload = async () => {
    if (!selectedFile || !companyId) {
      toast.error('Vælg en fil og et selskab')
      return
    }

    setStatus('uploading')
    setUploadProgress(0)
    setErrorMessage('')

    try {
      const urlResult = await requestDocumentUploadUrl({
        fileName: selectedFile.name,
        fileType: selectedFile.type,
        fileSizeBytes: selectedFile.size,
        companyId,
        caseId: caseId || undefined,
        title: title || selectedFile.name,
        sensitivity,
        description: description || undefined,
        folderPath: folderPath || undefined,
      })

      if (urlResult.error) {
        setStatus('error')
        setErrorMessage(urlResult.error)
        return
      }

      const { uploadUrl, documentId } = urlResult.data!

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            setUploadProgress(Math.round((e.loaded / e.total) * 100))
          }
        })
        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve()
          } else {
            reject(new Error(`Upload fejlede med status ${xhr.status}`))
          }
        })
        xhr.addEventListener('error', () => reject(new Error('Netværksfejl under upload')))
        xhr.open('PUT', uploadUrl)
        xhr.setRequestHeader('Content-Type', selectedFile.type)
        xhr.send(selectedFile)
      })

      setStatus('confirming')
      setUploadProgress(100)

      const confirmResult = await confirmDocumentUpload({ documentId })
      if (confirmResult.error) {
        setStatus('error')
        setErrorMessage(confirmResult.error)
        return
      }

      setStatus('done')
      toast.success('Dokument uploadet')
      setTimeout(() => {
        onComplete()
      }, 1000)
    } catch (err) {
      setStatus('error')
      setErrorMessage(err instanceof Error ? err.message : 'Upload fejlede')
    }
  }

  const canUpload =
    selectedFile && companyId && status === 'idle' && title.trim().length > 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg overflow-hidden rounded-xl bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">Upload dokument</h2>
          <button
            onClick={onClose}
            className="rounded p-1 text-gray-400 hover:bg-gray-100"
            disabled={status === 'uploading' || status === 'confirming'}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 px-6 py-4 max-h-[70vh] overflow-y-auto">
          {/* Dropzone */}
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              'cursor-pointer rounded-lg border-2 border-dashed p-8 text-center transition-colors',
              isDragOver
                ? 'border-blue-400 bg-blue-50'
                : selectedFile
                ? 'border-green-400 bg-green-50'
                : 'border-gray-300 hover:border-gray-400'
            )}
          >
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept={ACCEPTED_FILE_TYPES}
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleFileSelect(file)
              }}
            />
            {selectedFile ? (
              <div className="flex flex-col items-center gap-2">
                <FileText className="h-8 w-8 text-green-500" />
                <p className="font-medium text-green-700">{selectedFile.name}</p>
                <p className="text-sm text-green-600">
                  {formatFileSize(selectedFile.size)}
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <Upload className="h-8 w-8 text-gray-400" />
                <p className="font-medium text-gray-700">
                  Træk fil hertil eller klik for at vælge
                </p>
                <p className="text-xs text-gray-500">
                  PDF, DOCX, XLSX, PNG, JPG — maks 50MB
                </p>
              </div>
            )}
          </div>

          {/* Titel */}
          <div className="space-y-1">
            <Label htmlFor="title">Titel *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Dokumentets titel"
            />
          </div>

          {/* Selskab */}
          <div className="space-y-1">
            <Label>Selskab *</Label>
            <Select value={companyId} onValueChange={setCompanyId}>
              <SelectTrigger>
                <SelectValue placeholder="Vælg selskab..." />
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

          {/* Sag (valgfri) */}
          {cases.length > 0 && (
            <div className="space-y-1">
              <Label>Sag (valgfri)</Label>
              <Select value={caseId} onValueChange={setCaseId}>
                <SelectTrigger>
                  <SelectValue placeholder="Vælg sag..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Ingen sag</SelectItem>
                  {cases.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.title}
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

          {/* Mappe */}
          <div className="space-y-1">
            <Label htmlFor="folderPath">Mappe (valgfri)</Label>
            <Input
              id="folderPath"
              value={folderPath}
              onChange={(e) => setFolderPath(e.target.value)}
              placeholder="f.eks. kontrakter/2024"
            />
          </div>

          {/* Beskrivelse */}
          <div className="space-y-1">
            <Label htmlFor="description">Beskrivelse (valgfri)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Kort beskrivelse af dokumentet..."
              rows={2}
            />
          </div>

          {/* Upload progress */}
          {(status === 'uploading' || status === 'confirming') && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">
                  {status === 'uploading' ? 'Uploader...' : 'Bekræfter...'}
                </span>
                <span className="font-medium">{uploadProgress}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-gray-200">
                <div
                  className="h-full bg-blue-600 transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Fejlbesked */}
          {status === 'error' && (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Succes */}
          {status === 'done' && (
            <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>Dokument uploadet!</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 border-t border-gray-200 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={status === 'uploading' || status === 'confirming'}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Annuller
          </button>
          <button
            type="button"
            onClick={handleUpload}
            disabled={!canUpload}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            Upload
          </button>
        </div>
      </div>
    </div>
  )
}