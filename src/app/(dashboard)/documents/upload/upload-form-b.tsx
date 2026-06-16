'use client'

import { Upload, X, FileIcon, Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useCallback, useRef, useTransition } from 'react'
import { toast } from 'sonner'
import { Breadcrumb, PageTopbar, BButton, BFieldWrap } from '@/components/ui/b'
import { formatFileSize } from '@/lib/labels'
import { cn } from '@/lib/utils'
import type { CompanyOption } from './page'

// ────────────────────────────────────────────────────────────────────────────
// UploadFormB — B-stil upload-formular til /documents/upload.
//
// Features:
//   - Company-select (combobox, valgfri — null = generelt org-dok)
//   - Drag-drop FileUpload zone (genbruger eksisterende mønster)
//   - On submit: POST FormData til /api/upload
//   - Toast.success + redirect til /documents
// ────────────────────────────────────────────────────────────────────────────

const selectBase =
  'w-full rounded-[4px] border border-b-border-strong bg-white px-2.5 py-1.5 text-[13px] text-b-1 focus:border-transparent focus:outline focus:outline-2 focus:outline-b-blue-fg focus:outline-offset-[-1px] disabled:cursor-not-allowed disabled:opacity-60'

const inputBase =
  'w-full rounded-[4px] border border-b-border-strong bg-white px-2.5 py-1.5 text-[13px] text-b-1 placeholder:text-b-3 focus:border-transparent focus:outline focus:outline-2 focus:outline-b-blue-fg focus:outline-offset-[-1px] disabled:cursor-not-allowed disabled:opacity-60'

// Max filstørrelse: 10 MB
const MAX_FILE_SIZE = 10 * 1024 * 1024
const ACCEPTED_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/png',
  'image/jpeg',
]
const ACCEPTED_EXTENSIONS = '.pdf,.docx,.png,.jpg,.jpeg'

function validateFile(file: File): string | null {
  if (file.size > MAX_FILE_SIZE) {
    return `Filen er for stor (${formatFileSize(file.size)}) — maks 10 MB`
  }
  if (!ACCEPTED_TYPES.includes(file.type) && !file.name.match(/\.(pdf|docx|png|jpe?g)$/i)) {
    return 'Filtype ikke understøttet — brug PDF, DOCX, PNG eller JPG'
  }
  return null
}

interface Props {
  companies: CompanyOption[]
}

export function UploadFormB({ companies }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [isDragging, setIsDragging] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [companyId, setCompanyId] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

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
    if (!file) return
    const err = validateFile(file)
    if (err) {
      setFileError(err)
      return
    }
    setFileError(null)
    setSelectedFile(file)
  }, [])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const err = validateFile(file)
    if (err) {
      setFileError(err)
      return
    }
    setFileError(null)
    setSelectedFile(file)
  }, [])

  const handleRemoveFile = () => {
    setSelectedFile(null)
    setFileError(null)
    setTitle('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleSubmit = () => {
    if (!selectedFile) {
      toast.error('Vælg en fil før upload')
      return
    }

    startTransition(async () => {
      const formData = new FormData()
      formData.append('file', selectedFile)
      if (companyId) formData.append('companyId', companyId)
      if (title.trim()) formData.append('title', title.trim())

      try {
        const res = await fetch('/api/upload', { method: 'POST', body: formData })
        const result = (await res.json()) as { error?: string }
        if (result.error) {
          toast.error(result.error)
          return
        }
        toast.success('Dokument uploadet')
        router.push('/documents')
      } catch {
        toast.error('Upload fejlede — tjek din forbindelse og prøv igen')
      }
    })
  }

  const canSubmit = !!selectedFile && !fileError && !isPending

  return (
    <div className="flex flex-col gap-4">
      <Breadcrumb trail={[{ label: 'Dokumenter', href: '/documents' }]} current="Upload dokument" />

      <PageTopbar
        title="Upload dokument"
        meta={companies.length > 0 ? `${companies.length} selskaber` : undefined}
      />

      {/* Formular-panel */}
      <div className="rounded-[6px] border border-b-border bg-white">
        {/* Panel-header */}
        <div className="border-b border-b-border bg-b-panel-h px-4 py-2.5">
          <span className="text-[13px] font-semibold text-b-1">Nyt dokument</span>
        </div>

        <div className="flex flex-col gap-4 px-4 py-4">
          {/* Selskab (valgfrit) */}
          <BFieldWrap
            label="Tilknyt selskab (valgfrit)"
            hint="Vælg intet for at oprette et generelt organisationsdokument"
          >
            <select
              value={companyId}
              onChange={(e) => setCompanyId(e.target.value)}
              className={selectBase}
              disabled={isPending}
            >
              <option value="">Intet selskab — generelt dokument</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </BFieldWrap>

          {/* Titel (valgfrit) */}
          <BFieldWrap label="Titel (valgfrit)" hint="Hvis tom bruges filnavnet som titel">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={selectedFile?.name ?? 'fx Lejekontrakt 2026'}
              disabled={isPending}
              className={inputBase}
            />
          </BFieldWrap>

          {/* Fil — drag-drop zone */}
          <BFieldWrap label="Fil" required error={fileError}>
            <div
              role="button"
              tabIndex={selectedFile ? -1 : 0}
              aria-label="Vælg fil eller træk og slip"
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => !selectedFile && !isPending && fileInputRef.current?.click()}
              onKeyDown={(e) => {
                if (!selectedFile && !isPending && (e.key === 'Enter' || e.key === ' ')) {
                  e.preventDefault()
                  fileInputRef.current?.click()
                }
              }}
              className={cn(
                'relative rounded-[4px] border-2 border-dashed p-6 text-center transition-colors',
                isPending && 'opacity-60 cursor-not-allowed',
                !isPending && isDragging && 'border-b-blue-fg bg-blue-50',
                !isPending &&
                  selectedFile &&
                  !isDragging &&
                  'border-b-border-strong bg-white cursor-default',
                !isPending &&
                  !selectedFile &&
                  !isDragging &&
                  'border-b-border-strong hover:border-b-blue-fg bg-white cursor-pointer'
              )}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED_EXTENSIONS}
                onChange={handleFileSelect}
                disabled={isPending}
                className="hidden"
              />

              {selectedFile ? (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <FileIcon className="h-8 w-8 shrink-0 text-b-2" />
                    <div className="min-w-0 text-left">
                      <p className="truncate text-[13px] font-medium text-b-1">
                        {selectedFile.name}
                      </p>
                      <p className="text-[11px] text-b-2">{formatFileSize(selectedFile.size)}</p>
                    </div>
                  </div>
                  {!isPending && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleRemoveFile()
                      }}
                      className="rounded-[4px] p-1 text-b-2 hover:bg-b-row-hover hover:text-b-1"
                      aria-label="Fjern valgt fil"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ) : (
                <div>
                  <Upload className="mx-auto h-8 w-8 text-b-3" />
                  <p className="mt-2 text-[13px] font-medium text-b-1">
                    Træk fil hertil eller klik for at vælge
                  </p>
                  <p className="mt-1 text-[11px] text-b-2">PDF, DOCX, PNG eller JPG — maks 10 MB</p>
                </div>
              )}
            </div>
          </BFieldWrap>
        </div>

        {/* Panel-footer med handlingsknapper */}
        <div className="flex items-center justify-end gap-2 border-t border-b-border bg-b-panel-h px-4 py-3">
          <BButton href="/documents">Annuller</BButton>
          <BButton primary onClick={handleSubmit} disabled={!canSubmit}>
            {isPending ? (
              <span className="inline-flex items-center gap-1.5">
                <Loader2 className="h-3 w-3 animate-spin" />
                Uploader…
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5">
                <Upload className="h-3 w-3" />
                Upload dokument
              </span>
            )}
          </BButton>
        </div>
      </div>
    </div>
  )
}
