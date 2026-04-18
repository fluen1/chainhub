'use client'

import { useState, useCallback, useRef } from 'react'
import { Upload, X, FileIcon, Loader2, ChevronDown, ChevronUp } from 'lucide-react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { createContractVersion } from '@/actions/contract-versions'
import { CHANGE_TYPE_LABELS, formatFileSize } from '@/lib/labels'

interface UploadVersionFormProps {
  contractId: string
  companyId: string
}

const CHANGE_TYPE_OPTIONS = [
  { value: 'NY_VERSION', label: CHANGE_TYPE_LABELS.NY_VERSION },
  { value: 'REDAKTIONEL', label: CHANGE_TYPE_LABELS.REDAKTIONEL },
  { value: 'MATERIEL', label: CHANGE_TYPE_LABELS.MATERIEL },
  { value: 'ALLONGE', label: CHANGE_TYPE_LABELS.ALLONGE },
] as const

export function UploadVersionForm({ contractId, companyId }: UploadVersionFormProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [changeType, setChangeType] = useState<
    'REDAKTIONEL' | 'MATERIEL' | 'ALLONGE' | 'NY_VERSION'
  >('NY_VERSION')
  const [changeNote, setChangeNote] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  const resetForm = () => {
    setSelectedFile(null)
    setChangeType('NY_VERSION')
    setChangeNote('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

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

    try {
      // Step 1: Upload file via /api/upload
      const formData = new FormData()
      formData.append('file', selectedFile)
      formData.append('companyId', companyId)

      const uploadRes = await fetch('/api/upload', { method: 'POST', body: formData })
      const uploadResult = await uploadRes.json()

      if (uploadResult.error) {
        toast.error(uploadResult.error)
        return
      }

      // Step 2: Create contract version with server action
      const result = await createContractVersion({
        contractId,
        fileUrl: uploadResult.data.file_url,
        fileName: selectedFile.name,
        fileSizeBytes: selectedFile.size,
        changeType,
        changeNote: changeNote.trim() || undefined,
      })

      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(`Version ${result.data!.version_number} oprettet`)
        resetForm()
        setIsOpen(false)
        router.refresh()
      }
    } catch {
      toast.error('Upload fejlede — prøv igen')
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-800"
      >
        {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        Upload ny version
      </button>

      {isOpen && (
        <div className="mt-3 space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-4">
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
              'relative rounded-lg border-2 border-dashed p-4 text-center transition-colors cursor-pointer',
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
              accept=".pdf,.docx"
              onChange={handleFileSelect}
              className="hidden"
            />

            {selectedFile ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <FileIcon className="h-6 w-6 shrink-0 text-gray-400" />
                  <div className="min-w-0 text-left">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {selectedFile.name}
                    </p>
                    <p className="text-xs text-gray-500">{formatFileSize(selectedFile.size)}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    setSelectedFile(null)
                    if (fileInputRef.current) fileInputRef.current.value = ''
                  }}
                  className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div>
                <Upload className="mx-auto h-6 w-6 text-gray-400" />
                <p className="mt-1 text-sm font-medium text-gray-700">
                  Træk fil hertil eller klik for at vælge
                </p>
                <p className="mt-0.5 text-xs text-gray-500">PDF eller DOCX — maks 10 MB</p>
              </div>
            )}
          </div>

          {/* Change type + note */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="change-type" className="block text-sm font-medium text-gray-700 mb-1">
                Ændringstype
              </label>
              <select
                id="change-type"
                value={changeType}
                onChange={(e) =>
                  setChangeType(
                    e.target.value as 'REDAKTIONEL' | 'MATERIEL' | 'ALLONGE' | 'NY_VERSION'
                  )
                }
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {CHANGE_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="change-note" className="block text-sm font-medium text-gray-700 mb-1">
                Ændringsnote (valgfrit)
              </label>
              <textarea
                id="change-note"
                value={changeNote}
                onChange={(e) => setChangeNote(e.target.value)}
                placeholder="Beskriv ændringen..."
                rows={1}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
              />
            </div>
          </div>

          {/* Upload button */}
          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleUpload}
              disabled={!selectedFile || isUploading}
              className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isUploading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Uploader...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  Upload version
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
