'use client'

import { useRouter } from 'next/navigation'
import { useRef, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { createContractVersion } from '@/actions/contract-versions'
import { BModal, BTextareaField, BSegmentedField, BFieldWrap, Badge } from '@/components/ui/b'
import { cn } from '@/lib/utils'

// ────────────────────────────────────────────────────────────────────────────
// UploadVersionModal — drop-zone + 2-step upload-flow.
//
// Step 1: POST /api/upload med filen → returnerer Document
// Step 2: Kald createContractVersion med file_url/name/size + change-type/note
// ────────────────────────────────────────────────────────────────────────────

type ChangeType = 'NY_VERSION' | 'REDAKTIONEL' | 'MATERIEL' | 'ALLONGE'

const CHANGE_TYPES: Array<{ value: ChangeType; label: string; hint: string }> = [
  { value: 'NY_VERSION', label: 'Ny version', hint: 'Komplet udskiftning' },
  {
    value: 'REDAKTIONEL',
    label: 'Redaktionel',
    hint: 'Korrekturændringer uden materiel betydning',
  },
  { value: 'MATERIEL', label: 'Materiel', hint: 'Ændrer rettigheder/forpligtelser' },
  { value: 'ALLONGE', label: 'Allonge', hint: 'Tillæg/bilag der ikke ændrer hovedteksten' },
]

const ALLOWED_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/png',
  'image/jpeg',
]
const MAX_FILE_SIZE = 10 * 1024 * 1024

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  const mb = bytes / (1024 * 1024)
  return mb >= 10 ? `${Math.round(mb)} MB` : `${mb.toFixed(1).replace('.', ',')} MB`
}

function extFromName(name: string): string {
  return (name.split('.').pop() ?? '').toUpperCase()
}

function extTone(ext: string): 'red' | 'blue' | 'green' | 'gray' {
  if (ext === 'PDF') return 'red'
  if (ext === 'DOCX' || ext === 'DOC') return 'blue'
  if (ext === 'PNG' || ext === 'JPG' || ext === 'JPEG') return 'green'
  return 'gray'
}

export function UploadVersionModal({
  open,
  onClose,
  contractId,
  contractName,
  companyId,
  companyName,
  currentVersion,
}: {
  open: boolean
  onClose: () => void
  contractId: string
  contractName: string
  companyId: string
  companyName: string
  currentVersion: number | null
}) {
  const router = useRouter()
  const [file, setFile] = useState<File | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [fileError, setFileError] = useState<string | null>(null)
  const [changeType, setChangeType] = useState<ChangeType>('NY_VERSION')
  const [note, setNote] = useState('')
  const [autoExtract, setAutoExtract] = useState(true)
  const [submitting, startTransition] = useTransition()
  const inputRef = useRef<HTMLInputElement>(null)

  const nextVersion = currentVersion != null ? currentVersion + 1 : 1

  function validateFile(f: File): string | null {
    if (!ALLOWED_TYPES.includes(f.type)) {
      return 'Filtypen er ikke tilladt (PDF, DOCX, PNG, JPG)'
    }
    if (f.size > MAX_FILE_SIZE) {
      return 'Filen er for stor (max 10 MB)'
    }
    return null
  }

  function handleFile(f: File | null) {
    if (!f) {
      setFile(null)
      setFileError(null)
      return
    }
    const err = validateFile(f)
    if (err) {
      setFile(null)
      setFileError(err)
      return
    }
    setFile(f)
    setFileError(null)
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDragOver(false)
    const f = e.dataTransfer.files?.[0]
    if (f) handleFile(f)
  }

  function handleSubmit() {
    if (!file || submitting) return
    startTransition(async () => {
      // Step 1: upload fil til /api/upload (returnerer document med file_url)
      const formData = new FormData()
      formData.append('file', file)
      formData.append('companyId', companyId)
      formData.append('contractId', autoExtract ? contractId : '')
      formData.append('title', `${contractName} v${nextVersion}`)

      const uploadRes = await fetch('/api/upload', { method: 'POST', body: formData })
      if (!uploadRes.ok) {
        const err = await uploadRes.json().catch(() => ({ error: 'Upload fejlede' }))
        toast.error(err.error ?? 'Upload fejlede')
        return
      }
      const { data: doc } = await uploadRes.json()

      // Step 2: opret contract version med file-referencen
      const result = await createContractVersion({
        contractId,
        fileUrl: doc.file_url,
        fileName: doc.file_name,
        fileSizeBytes: doc.file_size_bytes,
        changeType,
        changeNote: note.trim() || undefined,
      })

      if ('error' in result) {
        toast.error(result.error)
        return
      }

      toast.success(
        `v${nextVersion} uploadet · ${CHANGE_TYPES.find((c) => c.value === changeType)?.label}`
      )
      setFile(null)
      setNote('')
      onClose()
      router.refresh()
    })
  }

  return (
    <BModal
      open={open}
      onClose={onClose}
      title={`Upload ny version · ${contractName}`}
      subtitle={
        currentVersion != null
          ? `${companyName} · Aktuelt v${currentVersion} → bliver v${nextVersion}`
          : `${companyName} · Første version`
      }
      submitLabel={`Upload v${nextVersion}`}
      submitDisabled={!file}
      submitting={submitting}
      onSubmit={handleSubmit}
    >
      {/* Drop-zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            inputRef.current?.click()
          }
        }}
        className={cn(
          'flex h-[180px] cursor-pointer flex-col items-center justify-center rounded-[4px] border-2 border-dashed px-4 text-center transition-colors',
          fileError
            ? 'border-b-red-fg bg-b-red-bg'
            : file
              ? 'border-b-green-fg bg-b-green-bg/30'
              : dragOver
                ? 'border-solid border-b-blue-fg bg-b-blue-bg'
                : 'border-b-border-strong bg-b-panel-h hover:border-b-blue-fg hover:bg-b-blue-bg/30'
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ALLOWED_TYPES.join(',')}
          onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
          className="hidden"
        />
        {file ? (
          <div className="flex flex-col items-center gap-2">
            <div className="flex items-center gap-2">
              <Badge tone={extTone(extFromName(file.name))}>{extFromName(file.name)}</Badge>
              <span className="text-[13px] font-medium text-b-1">{file.name}</span>
              <span className="text-[11px] text-b-2">{formatSize(file.size)}</span>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setFile(null)
                if (inputRef.current) inputRef.current.value = ''
              }}
              className="text-[11px] text-b-blue-fg hover:underline"
            >
              Skift fil
            </button>
          </div>
        ) : (
          <>
            <div className="mb-1.5 text-[24px] leading-none">↑</div>
            <div className="text-[13px] font-medium text-b-1">
              Træk PDF/DOCX/PNG/JPG hertil eller klik for at vælge
            </div>
            <div className="mt-1 text-[11px] text-b-2">Max 10 MB</div>
          </>
        )}
      </div>

      {fileError && (
        <div className="-mt-2 rounded-[4px] border-l-[3px] border-l-b-red-fg border border-[#ffc1ba] bg-b-red-bg px-3 py-2 text-[12px] text-[#6e1010]">
          {fileError}
        </div>
      )}

      <BSegmentedField
        label="Ændringstype"
        options={CHANGE_TYPES.map((c) => ({ value: c.value, label: c.label }))}
        value={changeType}
        onChange={setChangeType}
        required
        hint={CHANGE_TYPES.find((c) => c.value === changeType)?.hint}
      />

      {changeType === 'MATERIEL' && (
        <div className="rounded-[4px] border border-[#e6d370] border-l-[3px] border-l-b-amber-fg bg-b-amber-bg px-3 py-2 text-[12px] text-[#6e5a10]">
          ⚠ Materielle ændringer kræver typisk bestyrelses-notifikation. Sørg for at notere
          begrundelsen i versionsnotatet.
        </div>
      )}

      <BTextareaField
        label="Versionsnotat (valgfri)"
        value={note}
        onChange={setNote}
        placeholder={`Beskriv hvad der er ændret${currentVersion ? ` siden v${currentVersion}` : ''}`}
        rows={2}
      />

      <BFieldWrap
        label="AI-extraction"
        hint="Dokumentet sendes til AI-extraction og afventer manuelt review"
      >
        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={autoExtract}
            onChange={(e) => setAutoExtract(e.target.checked)}
            className="h-4 w-4 rounded border-b-border-strong text-b-blue-fg focus:ring-2 focus:ring-b-blue-bg"
          />
          <span className="text-[13px] text-b-1">Kør AI-extraction automatisk efter upload</span>
        </label>
      </BFieldWrap>

      {autoExtract && file && (
        <div className="rounded-[4px] border border-b-ai-border bg-[linear-gradient(135deg,#f3e8ff_0%,#ede9fe_100%)] px-3 py-2 text-[12px] text-b-ai-fg">
          ⚡ Kontrakten queues til extraction. Du får besked når review er klar (typisk 2-5
          minutter).
        </div>
      )}
    </BModal>
  )
}
