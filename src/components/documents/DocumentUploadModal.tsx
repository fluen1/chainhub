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
      // Fjern filendelse som standardtitel
      setTitle(file.name.replace(/\.[^/.]+$/, ''))
    }
  }

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      setIsDragOver(false)
      const file = e.dataTransfer.files[0]
      if (file) handleFileSelect(file)
    },
    [title]
  )

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragOver(true)
  }

  const handleDragLeave = () => setIsDragOver(false)

  const handleSubmit = async () => {
    if (!selectedFile) {
      toast.error('Vælg en fil at uploade')
      return
    }
    if (!title.trim()) {
      toast.error('Angiv en titel for dokumentet')
      return
    }
    if (!companyId && !caseId) {
      toast.error('Tilknyt dokumentet til et selskab eller en sag')
      return
    }

    setStatus('uploading')
    setErrorMessage('')
    setUploadProgress(0)

    try {
      // Trin 1: Hent signeret upload-URL
      const urlResult = await requestDocumentUploadUrl({
        fileName: selectedFile.name,
        fileType: selectedFile.type,
        fileSizeBytes: selectedFile.size,
        companyId: companyId || null,
        caseId: caseId || null,
      })

      if (urlResult.error) {
        setStatus('error')
        setErrorMessage(urlResult.error)
        return
      }

      const { uploadUrl, fileKey } = urlResult.data

      // Trin 2: Upload fil direkte til R2
      const xhr = new XMLHttpRequest()
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          setUploadProgress(Math.round((e.loaded / e.total) * 100))
        }
      })

      await new Promise<void>((resolve, reject) => {
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve()
          } else {
            reject(new Error(`Upload fejlede med status ${xhr.status}`))
          }
        }
        xhr.onerror = () => reject(new Error('Netværksfejl under upload'))
        xhr.open('PUT', uploadUrl)
        xhr.setRequestHeader('Content-Type', selectedFile.type)
        xhr.send(selectedFile)
      })

      setStatus('confirming')
      setUploadProgress(100)

      // Trin 3: Bekræft upload i databasen
      const confirmResult = await confirmDocumentUpload({
        title: title.trim(),
        fileKey,
        fileName: selectedFile.name,
        fileType: selectedFile.type,
        fileSizeBytes: selectedFile.size,
        companyId: companyId || null,
        caseId: caseId || null,
        sensitivity: sensitivity as 'PUBLIC' | 'STANDARD' | 'INTERN' | 'FORTROLIG' | 'STRENGT_FORTROLIG',
        folderPath: folderPath || null,
        description: description || null,
      })

      if (confirmResult.error) {
        setStatus('error')
        setErrorMessage(confirmResult.error)
        return
      }

      setStatus('done')
      setTimeout(() => {
        onComplete()
      }, 800)
    } catch (err) {
      setStatus('error')
      setErrorMessage(
        err instanceof Error ? err.message : 'Upload fejlede — prøv igen'
      )
    }
  }

  const isUploading = status === 'uploading' || status === 'confirming'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="relative w-full max-w-lg rounded-xl bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">Upload dokument</h2>
          <button
            onClick={onClose}
            disabled={isUploading}
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Indhold */}
        <div className="space-y-4 px-6 py-4">
          {/* Drop-zone */}
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => !isUploading && fileInputRef.current?.click()}
            className={cn(
              'flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 text-center transition-colors',
              isDragOver
                ? 'border-blue-400 bg-blue-50'
                : selectedFile
                ? 'border-green-300 bg-green-50'
                : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50',
              isUploading && 'cursor-not-allowed opacity-60'
            )}
          >
            {selectedFile ? (
              <>
                <CheckCircle2 className="mb-2 h-8 w-8 text-green-500" />
                <p className="font-medium text-gray-900">{selectedFile.name}</p>
                <p className="text-sm text-gray-500">{formatFileSize(selectedFile.size)}</p>
              </>
            ) : (
              <>
                <Upload className="mb-2 h-8 w-8 text-gray-400" />
                <p className="font-medium text-gray-700">
                  Træk og slip eller klik for at vælge
                </p>
                <p className="mt-1 text-sm text-gray-500">
                  PDF, DOCX, XLSX, PNG, JPG — maks. 50MB
                </p>
              </>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept=".pdf,.docx,.xlsx,.png,.jpg,.jpeg"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) handleFileSelect(file)
            }}
          />

          {/* Upload progress */}
          {isUploading && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-gray-500">
                <span>
                  {status === 'uploading' ? 'Uploader...' : 'Gemmer...'}
                </span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
                <div
                  className="h-full bg-blue-500 transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Fejlbesked */}
          {status === 'error' && errorMessage && (
            <div className="flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Dokumenttitel */}
          <div className="space-y-1">
            <Label htmlFor="doc-title">Titel *</Label>
            <Input
              id="doc-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Dokumentets titel"
              disabled={isUploading}
            />
          </div>

          {/* Tilknytning */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Selskab</Label>
              <Select value={companyId} onValueChange={setCompanyId} disabled={isUploading}>
                <SelectTrigger>
                  <SelectValue placeholder="Vælg selskab" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Intet selskab</SelectItem>
                  {companies.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>Sag</Label>
              <Select value={caseId} onValueChange={setCaseId} disabled={isUploading}>
                <SelectTrigger>
                  <SelectValue placeholder="Vælg sag" />
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
          </div>

          {/* Sensitivity */}
          <div className="space-y-1">
            <Label>Sensitivitet</Label>
            <Select value={sensitivity} onValueChange={setSensitivity} disabled={isUploading}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SENSITIVITY_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-gray-500">
              Dokumentet arver mindst det tilknyttede elements sensitivitet
            </p>
          </div>

          {/* Mappe */}
          <div className="space-y-1">
            <Label htmlFor="folder-path">Mappesti (valgfri)</Label>
            <Input
              id="folder-path"
              value={folderPath}
              onChange={(e) => setFolderPath(e.target.value)}
              placeholder="fx kontrakter/2024"
              disabled={isUploading}
            />
          </div>

          {/* Beskrivelse */}
          <div className="space-y-1">
            <Label htmlFor="doc-description">Beskrivelse (valgfri)</Label>
            <Textarea
              id="doc-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Kort beskrivelse af dokumentet..."
              rows={2}
              disabled={isUploading}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-gray-100 px-6 py-4">
          <Button variant="outline" onClick={onClose} disabled={isUploading}>
            Annuller
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!selectedFile || isUploading || status === 'done'}
          >
            {status === 'done' ? (
              <>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Uploadet
              </>
            ) : isUploading ? (
              'Uploader...'
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Upload
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}