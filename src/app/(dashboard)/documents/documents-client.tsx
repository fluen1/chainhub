'use client'

import { useState, useMemo, useEffect } from 'react'
import Link from 'next/link'
import {
  Search,
  Upload,
  FileText,
  FileSpreadsheet,
  FileImage,
  CheckCircle2,
  Loader2,
  Plus,
  ChevronUp,
  Sparkles,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------
// Typer — afledt af Prisma-data, serialiseret fra server
// ---------------------------------------------------------------
export type DocStatus = 'processing' | 'ready_for_review' | 'reviewed' | 'archived'
export type ConfidenceLevel = 'high' | 'medium' | 'low'

export interface DocumentItem {
  id: string
  title: string
  fileName: string
  companyName: string
  uploadedAt: string // ISO string (serialiseret fra Date)
  status: DocStatus
  extractedFieldCount: number
  attentionFieldCount: number
  confidenceLevel: ConfidenceLevel | null
}

type DocFilter = 'all' | 'review' | 'processing' | 'archived'

// ---------------------------------------------------------------
// Status-helpers
// ---------------------------------------------------------------
function statusStyle(status: DocStatus): string {
  switch (status) {
    case 'ready_for_review': return 'bg-violet-50 text-violet-700'
    case 'processing':       return 'bg-blue-50 text-blue-700'
    case 'reviewed':         return 'bg-emerald-50 text-emerald-700'
    case 'archived':         return 'bg-slate-50 text-slate-600'
  }
}

function statusLabel(status: DocStatus): string {
  switch (status) {
    case 'ready_for_review': return 'Til review'
    case 'processing':       return 'Analyseres'
    case 'reviewed':         return 'Godkendt'
    case 'archived':         return 'Arkiveret'
  }
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('da-DK', { day: 'numeric', month: 'short', year: 'numeric' })
}

function fileTypeIcon(fileName: string) {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? ''
  if (['xlsx', 'xls', 'csv'].includes(ext)) return <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
  if (['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext)) return <FileImage className="w-4 h-4 text-sky-500" />
  if (ext === 'pdf') return <FileText className="w-4 h-4 text-red-500" />
  if (['doc', 'docx'].includes(ext)) return <FileText className="w-4 h-4 text-blue-500" />
  return <FileText className="w-4 h-4 text-slate-400" />
}

function fileExtLabel(fileName: string): string {
  const ext = fileName.split('.').pop()?.toUpperCase() ?? ''
  return ext
}

// ---------------------------------------------------------------
// Hovedkomponent
// ---------------------------------------------------------------
export default function DocumentsClient({ documents }: { documents: DocumentItem[] }) {
  const [isDragOver, setIsDragOver] = useState(false)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<DocFilter>('all')
  const [showScrollTop, setShowScrollTop] = useState(false)

  // Global drag-drop på siden
  useEffect(() => {
    const onDragOver = (e: DragEvent) => {
      if (e.dataTransfer?.types.includes('Files')) {
        e.preventDefault()
        setIsDragOver(true)
      }
    }
    const onDragLeave = (e: DragEvent) => {
      if (e.clientX === 0 && e.clientY === 0) setIsDragOver(false)
    }
    const onDrop = (e: DragEvent) => {
      e.preventDefault()
      setIsDragOver(false)
      if (e.dataTransfer?.files.length) {
        toast.info('Upload er under udvikling')
      }
    }
    window.addEventListener('dragover', onDragOver)
    window.addEventListener('dragleave', onDragLeave)
    window.addEventListener('drop', onDrop)
    return () => {
      window.removeEventListener('dragover', onDragOver)
      window.removeEventListener('dragleave', onDragLeave)
      window.removeEventListener('drop', onDrop)
    }
  }, [])

  // Scroll-to-top knap
  useEffect(() => {
    const handler = () => setShowScrollTop(window.scrollY > 400)
    handler()
    window.addEventListener('scroll', handler, { passive: true })
    return () => window.removeEventListener('scroll', handler)
  }, [])

  const reviewDocs = useMemo(
    () => documents.filter((d) => d.status === 'ready_for_review'),
    [documents],
  )
  const processingDocs = useMemo(
    () => documents.filter((d) => d.status === 'processing'),
    [documents],
  )

  const counts = useMemo(
    () => ({
      review:     documents.filter((d) => d.status === 'ready_for_review').length,
      processing: documents.filter((d) => d.status === 'processing').length,
      archived:   documents.filter((d) => d.status === 'reviewed' || d.status === 'archived').length,
    }),
    [documents],
  )

  const filtered = useMemo(() => {
    return documents
      .filter((d) => {
        if (filter === 'review' && d.status !== 'ready_for_review') return false
        if (filter === 'processing' && d.status !== 'processing') return false
        if (filter === 'archived' && d.status !== 'reviewed' && d.status !== 'archived') return false
        if (search.trim()) {
          const q = search.toLowerCase()
          return d.fileName.toLowerCase().includes(q) || d.companyName.toLowerCase().includes(q)
        }
        return true
      })
      .sort((a, b) => {
        const rank = { ready_for_review: 0, processing: 1, reviewed: 2, archived: 3 }
        const diff = rank[a.status] - rank[b.status]
        if (diff !== 0) return diff
        return new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
      })
  }, [documents, search, filter])

  // Tom state
  if (documents.length === 0) {
    return (
      <div className="min-h-full">
        <div className="max-w-[1280px] mx-auto">
          <h1 className="text-[20px] font-semibold tracking-tight text-slate-900">Dokumenter</h1>
          <div className="mt-8 bg-white rounded-xl ring-1 ring-slate-900/[0.06] shadow-[0_1px_2px_rgba(15,23,42,0.04)] p-16 text-center">
            <Upload className="mx-auto h-10 w-10 text-slate-200 mb-4" />
            <p className="text-[13px] font-medium text-slate-500">Ingen dokumenter endnu</p>
            <p className="text-[11px] text-slate-400 mt-1">Upload dit første dokument for at komme i gang.</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-full">
      <div className="max-w-[1280px] mx-auto">
        {/* Header */}
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-[20px] font-semibold tracking-tight text-slate-900">Dokumenter</h1>
            <p className="text-[13px] text-slate-500 mt-1">
              {documents.length} dokumenter
              {counts.review > 0 && <> · <span className="text-slate-700 font-medium">{counts.review} til review</span></>}
            </p>
          </div>
          <button
            type="button"
            onClick={() => toast.info('Upload er under udvikling')}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-900 text-white text-[12px] font-medium hover:bg-slate-800 transition-colors shadow-[0_1px_2px_rgba(15,23,42,0.1)]"
          >
            <Plus className="w-3.5 h-3.5" />
            Upload dokument
          </button>
        </div>

        {/* Filter bar */}
        <div className="flex items-center gap-2 mb-4">
          <div className="flex-1 bg-white ring-1 ring-slate-900/[0.06] rounded-lg px-3.5 py-2.5 flex items-center gap-2.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            <Search className="w-4 h-4 text-slate-400 shrink-0" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Søg filnavn, selskab..."
              className="flex-1 text-[13px] text-slate-700 placeholder:text-slate-400 bg-transparent outline-none"
            />
          </div>

          <FilterPill
            dot="bg-violet-500"
            label={`${counts.review} Til review`}
            active={filter === 'review'}
            onClick={() => setFilter(filter === 'review' ? 'all' : 'review')}
          />
          <FilterPill
            dot="bg-blue-500"
            label={`${counts.processing} Analyseres`}
            active={filter === 'processing'}
            onClick={() => setFilter(filter === 'processing' ? 'all' : 'processing')}
          />
          <FilterPill
            dot="bg-slate-400"
            label={`${counts.archived} Godkendt`}
            active={filter === 'archived'}
            onClick={() => setFilter(filter === 'archived' ? 'all' : 'archived')}
          />
        </div>

        {/* Pinned: Til review (urgency-first) */}
        {reviewDocs.length > 0 && filter === 'all' && (
          <div className="bg-white rounded-xl ring-1 ring-slate-900/[0.06] shadow-[0_1px_2px_rgba(15,23,42,0.04)] mb-4 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-violet-500" />
                <span className="text-[12px] font-semibold text-slate-900">Afventer din review</span>
                <span className="text-[11px] text-slate-400">({reviewDocs.length})</span>
              </div>
              {processingDocs.length > 0 && (
                <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                  <Loader2 className="w-3 h-3 text-blue-500 animate-spin" />
                  <span className="tabular-nums">{processingDocs.length} analyseres</span>
                </div>
              )}
            </div>
            <div className="divide-y divide-slate-50">
              {reviewDocs.slice(0, 5).map((doc) => {
                const attentionCount = doc.attentionFieldCount
                return (
                  <Link
                    key={doc.id}
                    href={`/documents/review/${doc.id}`}
                    className="flex items-center gap-3 px-5 py-2.5 hover:bg-slate-50/60 transition-colors no-underline"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-violet-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-[12px] font-medium text-slate-900 truncate">{doc.fileName}</div>
                      <div className="text-[11px] text-slate-400 truncate">
                        {doc.companyName} · {doc.extractedFieldCount} felter udtrukket
                        {attentionCount > 0 && (
                          <> · <span className="text-amber-700 font-medium">{attentionCount} kræver opmærksomhed</span></>
                        )}
                      </div>
                    </div>
                    <span className="text-[11px] text-slate-400 font-medium shrink-0">Gennemgå →</span>
                  </Link>
                )
              })}
            </div>
          </div>
        )}

        {/* Dokument-liste */}
        <div className="bg-white rounded-xl ring-1 ring-slate-900/[0.06] shadow-[0_1px_2px_rgba(15,23,42,0.04)] [overflow:clip]">
          <div className="sticky top-0 bg-white z-10 px-5 py-3 border-b border-slate-100 flex items-center justify-between">
            <div className="text-[12px] font-semibold text-slate-900">
              {filter === 'all' ? 'Alle dokumenter' : statusLabel(filter === 'review' ? 'ready_for_review' : filter === 'processing' ? 'processing' : 'archived')}
            </div>
            <div className="text-[11px] text-slate-400 tabular-nums">{filtered.length}</div>
          </div>

          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <p className="text-[13px] text-slate-500 font-medium">Ingen dokumenter fundet</p>
              <p className="text-[11px] text-slate-400 mt-1">Prøv et andet søgeord eller filter</p>
            </div>
          ) : (
            <div>
              {filtered.map((doc, idx) => {
                const prev = idx > 0 ? filtered[idx - 1] : null
                const showSeparator = filter === 'all' && prev !== null && prev.status !== doc.status
                return (
                  <div key={doc.id}>
                    {showSeparator && (
                      <div className="px-5 py-2 bg-slate-50/60 flex items-center gap-2 text-[10px] font-medium text-slate-400 uppercase tracking-[0.1em]">
                        <span className={cn(
                          'w-1 h-1 rounded-full',
                          doc.status === 'ready_for_review' && 'bg-violet-500',
                          doc.status === 'processing' && 'bg-blue-500',
                          (doc.status === 'reviewed' || doc.status === 'archived') && 'bg-slate-400',
                        )} />
                        {statusLabel(doc.status)}
                      </div>
                    )}
                    <div className="border-b border-slate-100 last:border-b-0">
                      <DocRow doc={doc} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {filtered.length > 0 && (
            <div className="px-5 py-3.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
              <span>
                {filtered.length === documents.length
                  ? `${filtered.length} dokumenter · Slut på listen`
                  : `Viser ${filtered.length} af ${documents.length} dokumenter`}
              </span>
              <span className="text-[10px] text-slate-300">● ● ●</span>
            </div>
          )}
        </div>
      </div>

      {/* Global drop overlay */}
      {isDragOver && (
        <div className="fixed inset-0 z-50 pointer-events-none flex items-center justify-center bg-slate-900/5 backdrop-blur-[1px]">
          <div className="bg-white rounded-2xl ring-2 ring-violet-400 px-8 py-6 shadow-[0_20px_60px_-20px_rgba(15,23,42,0.4)] flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-violet-50 flex items-center justify-center">
              <Upload className="w-5 h-5 text-violet-600" />
            </div>
            <div>
              <div className="text-[14px] font-semibold text-slate-900">Slip filerne for at uploade</div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                AI-analyse starter automatisk · PDF, DOCX, XLSX
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Scroll-to-top */}
      <button
        type="button"
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        className={cn(
          'fixed bottom-6 right-6 w-10 h-10 rounded-full bg-slate-900 text-white flex items-center justify-center shadow-[0_4px_16px_-4px_rgba(15,23,42,0.3)] ring-1 ring-slate-900/10 transition-all duration-200',
          showScrollTop ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 translate-y-2 pointer-events-none',
        )}
        aria-label="Scroll til toppen"
      >
        <ChevronUp className="w-4 h-4" />
      </button>
    </div>
  )
}

// ---------------------------------------------------------------
// DocRow — en dokument-række i listen
// ---------------------------------------------------------------
function DocRow({ doc }: { doc: DocumentItem }) {
  const isReview = doc.status === 'ready_for_review'
  const isProcessing = doc.status === 'processing'
  const canQuickApprove = isReview && doc.confidenceLevel === 'high' && doc.attentionFieldCount <= 1

  return (
    <div className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50/60 transition-colors">
      <div className="w-9 h-9 rounded-md bg-slate-50 flex items-center justify-center shrink-0">
        {isProcessing ? (
          <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
        ) : isReview ? (
          <Sparkles className="w-4 h-4 text-violet-500" />
        ) : (
          fileTypeIcon(doc.fileName)
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          {isReview ? (
            <Link
              href={`/documents/review/${doc.id}`}
              className="text-[12px] font-medium text-slate-900 hover:text-slate-950 no-underline truncate"
            >
              {doc.fileName}
            </Link>
          ) : (
            <span className="text-[12px] font-medium text-slate-900 truncate">{doc.fileName}</span>
          )}
          <span className="text-[9px] font-medium text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded shrink-0">
            {fileExtLabel(doc.fileName)}
          </span>
        </div>
        <div className="text-[11px] text-slate-400 truncate mt-0.5">
          {doc.companyName} · {formatDate(doc.uploadedAt)}
          {isReview && doc.extractedFieldCount > 0 && (
            <> · {doc.extractedFieldCount} felter udtrukket</>
          )}
          {isReview && doc.attentionFieldCount > 0 && (
            <> · <span className="text-amber-700 font-medium">{doc.attentionFieldCount} kræver opmærksomhed</span></>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <span className={cn('text-[10px] font-medium px-2 py-0.5 rounded', statusStyle(doc.status))}>
          {statusLabel(doc.status)}
        </span>
        <span className="text-[11px] text-slate-400 tabular-nums hidden sm:inline">{formatDate(doc.uploadedAt)}</span>

        {canQuickApprove && (
          <button
            type="button"
            onClick={() => toast.success('Dokument godkendt (simuleret)')}
            className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-900 text-white text-[11px] font-medium hover:bg-slate-800 transition-colors"
          >
            <CheckCircle2 className="w-3 h-3" />
            Godkend
          </button>
        )}

        {isReview && !canQuickApprove && (
          <Link
            href={`/documents/review/${doc.id}`}
            className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-white ring-1 ring-slate-900/[0.08] text-slate-700 text-[11px] font-medium hover:bg-slate-50 transition-colors no-underline"
          >
            Gennemgå
          </Link>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------
// Filter pill
// ---------------------------------------------------------------
function FilterPill({
  dot,
  label,
  active,
  onClick,
}: {
  dot: string
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 px-3 py-2 rounded-lg text-[12px] font-medium transition-colors bg-white ring-1 shadow-[0_1px_2px_rgba(15,23,42,0.04)] shrink-0',
        active ? 'ring-slate-900/20 text-slate-900' : 'ring-slate-900/[0.06] text-slate-600 hover:text-slate-900',
      )}
    >
      <span className={cn('w-1.5 h-1.5 rounded-full', dot)} />
      {label}
    </button>
  )
}
