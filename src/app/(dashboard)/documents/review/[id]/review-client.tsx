'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ChevronRight,
  ArrowRight,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Sparkles,
  ChevronDown,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { approveDocumentReview, saveFieldDecision } from '@/actions/document-review'

// ---------------------------------------------------------------
// Types — serialiseret fra server
// ---------------------------------------------------------------
export interface ReviewField {
  id: string
  fieldName: string
  fieldLabel: string
  extractedValue: string | null
  existingValue: string | null
  confidence: number
  confidenceLevel: 'high' | 'medium' | 'low'
  sourcePageNumber: number
  sourceParagraph: string
  sourceText: string
  hasDiscrepancy: boolean
  discrepancyType?: 'value_mismatch' | 'missing_clause' | 'new_data'
  category: string
}

export interface ReviewDocument {
  id: string
  fileName: string
  companyName: string
  extractionId: string | null
  hasExtraction: boolean
  isReviewed: boolean
  reviewedBy: string | null
  schemaVersion: string | null
  promptVersion: string | null
  fields: ReviewField[]
  decidedFieldNames: string[]
}

export interface ReviewQueueItem {
  id: string
  fileName: string
}

interface ReviewClientProps {
  document: ReviewDocument
  reviewQueue: ReviewQueueItem[]
}

// ---------------------------------------------------------------
// Mock PDF tekst-blokke — placeholder indtil ægte PDF-rendering
// ---------------------------------------------------------------
const mockPdfBlocks = [
  {
    id: 'block-p1-1',
    page: 1,
    paragraph: '§ 1 SELSKABET',
    text: 'Selskabets navn er Odense Tandlægehus ApS, CVR-nr. 38201745, med hjemsted i Odense Kommune. Selskabet er stiftet den 1. juni 2021 og driver virksomhed inden for tandlæge-ydelser.',
  },
  {
    id: 'block-p1-2',
    page: 1,
    paragraph: '§ 2 PARTER',
    text: 'Henrik Munk, CPR ..., er lokal partner i selskabet og indgår denne ejeraftale med Kædegruppen A/S. Aftalen træder i kraft den 1. juni 2021 og erstatter alle tidligere aftaler.',
  },
  {
    id: 'block-p2-1',
    page: 2,
    paragraph: '§ 3 EJERFORHOLD',
    text: 'Kædegruppen ejer 60% af selskabets kapital jf. stiftelsesdokument af 15. marts 2026. Henrik Munk ejer 40% af selskabets kapital. Ejerandelene kan kun overdrages i overensstemmelse med bestemmelserne i denne aftale.',
  },
  {
    id: 'block-p3-1',
    page: 3,
    paragraph: '§ 5 UDBYTTE',
    text: 'Der udloddes minimum 80% af selskabets årsoverskud som udbytte til anpartshaverne i forhold til deres ejerandele, medmindre der er særlige forretningsmæssige grunde til at tilbageholde udbytte.',
  },
  {
    id: 'block-p3-2',
    page: 3,
    paragraph: '§ 6 LEDELSE',
    text: 'Bestyrelsen består af 3 medlemmer: 2 udpeget af kædegruppen og 1 af partneren. Bestyrelsesformanden udpeges af kædegruppen og har den afgørende stemme ved stemmelighed.',
  },
  {
    id: 'block-p4-1',
    page: 4,
    paragraph: '§ 7 OVERDRAGELSE',
    text: 'Parterne har gensidig forkøbsret ved overdragelse af kapitalandele. Udløsningsprisen beregnes som selskabets indre værdi plus goodwillfaktor 1,5 baseret på gennemsnitlig EBITDA over de seneste 3 regnskabsår.',
  },
  {
    id: 'block-p5-1',
    page: 5,
    paragraph: '§ 9 KONKURRENCEFORBUD',
    text: 'Partneren er underlagt konkurrenceforbud i 24 måneder efter udtræden af selskabet inden for en radius af 15 km fra selskabets forretningssted.',
  },
  {
    id: 'block-p6-1',
    page: 6,
    paragraph: '§ 12 IKRAFTTRÆDELSE',
    text: 'Denne aftale erstatter ejeraftale af 1. juni 2021 og træder i kraft 15. marts 2026. Samtlige tidligere aftaler mellem parterne om ejerskab og governance af selskabet er hermed erstattet af nærværende aftale.',
  },
]

// ---------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------
function confidenceDot(level: ReviewField['confidenceLevel']): string {
  if (level === 'high') return 'bg-emerald-500'
  if (level === 'medium') return 'bg-amber-400'
  return 'bg-rose-500'
}

function confidenceLabel(confidence: number): string {
  return `${Math.round(confidence * 100)}%`
}

// ---------------------------------------------------------------
// Attention field row
// ---------------------------------------------------------------
interface FieldRowProps {
  field: ReviewField
  extractionId: string
  onMouseEnter: (id: string) => void
  onMouseLeave: () => void
  isHovered: boolean
  decided?: boolean
  onDecide?: (fieldId: string) => void
}

function AttentionFieldRow({
  field,
  extractionId,
  onMouseEnter,
  onMouseLeave,
  isHovered,
  decided,
  onDecide,
}: FieldRowProps) {
  const [isPending, startTransition] = useTransition()
  const isMissingClause = field.discrepancyType === 'missing_clause'

  function decide(
    decision: 'use_ai' | 'keep_existing' | 'manual' | 'accept_missing' | 'add_manual',
    label: string
  ) {
    startTransition(async () => {
      const result = await saveFieldDecision({
        extractionId,
        fieldName: field.fieldName,
        decision,
        aiValue: field.extractedValue,
        existingValue: field.existingValue,
        confidence: field.confidence,
      })
      if (result.error) {
        toast.error(result.error)
        return
      }
      onDecide?.(field.id)
      toast.success(`${field.fieldLabel}: ${label}`)
    })
  }

  return (
    <div
      className={cn(
        'px-5 py-3.5 border-b border-slate-100 last:border-b-0 transition-colors',
        decided && 'bg-emerald-50/30',
        isHovered ? 'bg-amber-50' : !decided && 'hover:bg-slate-50/60'
      )}
      onMouseEnter={() => onMouseEnter(field.id)}
      onMouseLeave={onMouseLeave}
    >
      {/* Label + konfidence */}
      <div className="flex items-center gap-2 mb-2">
        <span
          className={cn('w-1.5 h-1.5 rounded-full shrink-0', confidenceDot(field.confidenceLevel))}
        />
        <span className="text-[12px] font-semibold text-slate-900">{field.fieldLabel}</span>
        <span className="text-[10px] text-slate-400 tabular-nums">
          {confidenceLabel(field.confidence)} konfidence
        </span>
        {decided && (
          <span className="ml-auto flex items-center gap-1 text-[10px] font-medium text-emerald-600">
            <CheckCircle2 className="w-3 h-3" />
            Besluttet
          </span>
        )}
      </div>

      {/* Delta display */}
      {!isMissingClause && (
        <div className="ml-3.5 space-y-1 mb-3">
          <div className="flex items-start gap-2">
            <span className="text-[11px] text-slate-400 w-20 shrink-0 pt-0.5">AI-fandt:</span>
            <span className="text-[11px] font-medium text-amber-800 bg-amber-50 ring-1 ring-amber-200/60 px-2 py-0.5 rounded">
              {field.extractedValue ?? '(tom)'}
            </span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-[11px] text-slate-400 w-20 shrink-0 pt-0.5">I systemet:</span>
            <span className="text-[11px] text-slate-600">
              {field.existingValue ?? '(ikke registreret)'}
            </span>
          </div>
        </div>
      )}

      {/* Kilde */}
      <p className="ml-3.5 text-[10px] text-slate-400 mb-3 font-medium tracking-wide">
        Side {field.sourcePageNumber} · {field.sourceParagraph}
      </p>

      {/* Handlingsknapper */}
      {!decided && (
        <div className="ml-3.5 flex flex-wrap gap-1.5">
          {!isMissingClause ? (
            <>
              <button
                disabled={isPending}
                onClick={() => decide('use_ai', 'AI-værdi brugt')}
                className="bg-slate-900 text-white text-[11px] font-medium px-2.5 py-1 rounded-md hover:bg-slate-800 transition-colors disabled:opacity-50"
              >
                Brug AI-værdi
              </button>
              <button
                disabled={isPending}
                onClick={() => decide('keep_existing', 'Beholder eksisterende')}
                className="bg-white ring-1 ring-slate-900/[0.08] text-slate-700 text-[11px] font-medium px-2.5 py-1 rounded-md hover:bg-slate-50 transition-colors disabled:opacity-50"
              >
                Behold eksisterende
              </button>
              <button
                disabled={isPending}
                onClick={() => decide('manual', 'Ret manuelt')}
                className="text-slate-500 text-[11px] font-medium px-2.5 py-1 rounded-md hover:bg-slate-50 transition-colors disabled:opacity-50"
              >
                Ret manuelt
              </button>
            </>
          ) : (
            <>
              <button
                disabled={isPending}
                onClick={() => decide('add_manual', 'Tilføjet manuelt')}
                className="bg-slate-900 text-white text-[11px] font-medium px-2.5 py-1 rounded-md hover:bg-slate-800 transition-colors disabled:opacity-50"
              >
                Tilføj manuelt
              </button>
              <button
                disabled={isPending}
                onClick={() => decide('accept_missing', 'Accepteret som manglende')}
                className="bg-white ring-1 ring-slate-900/[0.08] text-slate-700 text-[11px] font-medium px-2.5 py-1 rounded-md hover:bg-slate-50 transition-colors disabled:opacity-50"
              >
                Accepter
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------
// High confidence row (compact)
// ---------------------------------------------------------------
function HighConfidenceRow({
  field,
  onMouseEnter,
  onMouseLeave,
  isHovered,
}: Omit<FieldRowProps, 'extractionId' | 'decided' | 'onDecide'>) {
  return (
    <div
      className={cn(
        'flex items-center gap-2.5 px-5 py-2 border-b border-slate-50 last:border-b-0 transition-colors',
        isHovered ? 'bg-amber-50' : 'hover:bg-slate-50/60'
      )}
      onMouseEnter={() => onMouseEnter(field.id)}
      onMouseLeave={onMouseLeave}
    >
      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
      <span className="text-[11px] font-medium text-slate-700 w-32 shrink-0 truncate">
        {field.fieldLabel}
      </span>
      <span className="text-[11px] text-slate-500 flex-1 truncate">{field.extractedValue}</span>
      <span className="text-[10px] text-slate-300 shrink-0 tabular-nums">
        s.{field.sourcePageNumber}
      </span>
    </div>
  )
}

// ---------------------------------------------------------------
// Hovedkomponent
// ---------------------------------------------------------------
export default function ReviewClient({ document: doc, reviewQueue }: ReviewClientProps) {
  const router = useRouter()
  const [hoveredFieldId, setHoveredFieldId] = useState<string | null>(null)
  const [showHighConf, setShowHighConf] = useState(true)
  const [decidedIds, setDecidedIds] = useState<Set<string>>(() => new Set(doc.decidedFieldNames))
  const [isApproving, startApprove] = useTransition()

  function markDecided(fieldId: string) {
    setDecidedIds((prev) => {
      const next = new Set(prev)
      next.add(fieldId)
      return next
    })
  }

  const currentIndex = reviewQueue.findIndex((d) => d.id === doc.id)
  const nextDoc =
    currentIndex >= 0 && currentIndex < reviewQueue.length - 1
      ? reviewQueue[currentIndex + 1]
      : null

  // Graceful degradation — ingen ekstraktion
  if (!doc.hasExtraction) {
    return (
      <div className="min-h-full bg-slate-50/60 p-8">
        <div className="max-w-[1280px] mx-auto">
          <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mb-4">
            <Link href="/documents" className="hover:text-slate-900 transition-colors no-underline">
              Dokumenter
            </Link>
            <ChevronRight className="w-3 h-3" />
            <span className="text-slate-700 font-medium truncate">{doc.fileName}</span>
          </div>
          <div className="bg-white rounded-xl ring-1 ring-slate-900/[0.06] p-16 text-center">
            <XCircle className="mx-auto h-10 w-10 text-slate-200 mb-3" />
            <p className="text-[13px] font-medium text-slate-700 mb-1">Ikke AI-behandlet</p>
            <p className="text-[12px] text-slate-400">
              Dette dokument har ikke gennemgået AI-ekstraktion endnu.
            </p>
            <Link
              href="/documents"
              className="inline-flex items-center gap-1 mt-4 text-[12px] font-medium text-slate-900 hover:underline no-underline"
            >
              <ChevronRight className="w-3 h-3 rotate-180" />
              Tilbage til dokumenter
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // Allerede godkendt
  if (doc.isReviewed) {
    return (
      <div className="min-h-full bg-slate-50/60 p-8">
        <div className="max-w-[1280px] mx-auto">
          <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mb-4">
            <Link href="/documents" className="hover:text-slate-900 transition-colors no-underline">
              Dokumenter
            </Link>
            <ChevronRight className="w-3 h-3" />
            <span className="text-slate-700 font-medium truncate">{doc.fileName}</span>
          </div>
          <div className="bg-white rounded-xl ring-1 ring-slate-900/[0.06] p-16 text-center">
            <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-400 mb-3" />
            <p className="text-[13px] font-medium text-slate-700 mb-1">Allerede godkendt</p>
            <p className="text-[12px] text-slate-400">
              Dette dokument er allerede gennemgået og godkendt.
            </p>
            <Link
              href="/documents"
              className="inline-flex items-center gap-1 mt-4 text-[12px] font-medium text-slate-900 hover:underline no-underline"
            >
              <ChevronRight className="w-3 h-3 rotate-180" />
              Tilbage til dokumenter
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const { fields } = doc
  const highConfidenceFields = fields.filter(
    (f) => f.confidenceLevel === 'high' && !f.hasDiscrepancy
  )
  const attentionFields = fields.filter((f) => f.hasDiscrepancy || f.confidenceLevel !== 'high')
  const missingClauseFields = fields.filter((f) => f.discrepancyType === 'missing_clause')
  const totalReady = highConfidenceFields.length
  const totalFields = fields.length

  const hoveredSourceText = hoveredFieldId
    ? (fields.find((f) => f.id === hoveredFieldId)?.sourceText ?? null)
    : null

  const totalNeedsDecision = attentionFields.length
  const decidedCount = attentionFields.filter((f) => decidedIds.has(f.id)).length
  const allDecided = totalNeedsDecision === 0 || decidedCount === totalNeedsDecision
  const progressPct = totalNeedsDecision > 0 ? (decidedCount / totalNeedsDecision) * 100 : 100

  function handleApprove() {
    if (!allDecided || !doc.extractionId) return
    startApprove(async () => {
      const result = await approveDocumentReview(doc.extractionId!)
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success('Dokument godkendt')
      router.push('/documents')
    })
  }

  function handleNext() {
    const hasUnsaved = decidedCount > 0 && !allDecided
    if (hasUnsaved) {
      const remaining = totalNeedsDecision - decidedCount
      const ok = window.confirm(
        `Du har ${remaining} ubehandlede felter på dette dokument.\n\nFortsæt uden at færdiggøre? Dine fremskridt gemmes, men review er ikke fuldført.`
      )
      if (!ok) return
    }
    if (nextDoc) {
      router.push(`/documents/review/${nextDoc.id}`)
    } else {
      toast.info('Ingen flere dokumenter i køen')
    }
  }

  return (
    <div className="min-h-full bg-slate-50/60 p-8">
      <div className="max-w-[1280px] mx-auto flex flex-col h-[calc(100vh-4rem)]">
        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mb-4">
          <Link href="/documents" className="hover:text-slate-900 transition-colors no-underline">
            Dokumenter
          </Link>
          <ChevronRight className="w-3 h-3" />
          <span className="text-slate-700 font-medium truncate">{doc.fileName}</span>
        </div>

        {/* Header */}
        <div className="bg-white rounded-xl ring-1 ring-slate-900/[0.06] shadow-[0_1px_2px_rgba(15,23,42,0.04)] p-5 mb-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <h1 className="text-[18px] font-semibold tracking-tight text-slate-900 truncate">
                {doc.fileName}
              </h1>
              <div className="flex items-center gap-3 text-[12px] text-slate-500 mt-1">
                <span>{doc.companyName}</span>
                <span>·</span>
                <span className="flex items-center gap-1.5">
                  <Sparkles className="w-3 h-3 text-violet-500" />
                  AI-ekstraheret
                </span>
                <span>·</span>
                <span className="tabular-nums">
                  {totalReady}/{totalFields} auto-klar
                </span>
              </div>
            </div>

            {/* Queue progress */}
            {reviewQueue.length > 1 && currentIndex >= 0 && (
              <div className="shrink-0 text-right">
                <div className="text-[10px] font-medium text-slate-400 uppercase tracking-[0.08em]">
                  Review-kø
                </div>
                <div className="flex items-center gap-1.5 mt-1.5 justify-end">
                  {reviewQueue.map((_, i) => (
                    <span
                      key={i}
                      className={cn(
                        'h-1 rounded-full transition-all',
                        i === currentIndex
                          ? 'bg-slate-900 w-6'
                          : i < currentIndex
                            ? 'bg-slate-300 w-3'
                            : 'bg-slate-200 w-3'
                      )}
                    />
                  ))}
                </div>
                <div className="text-[11px] font-medium text-slate-600 mt-1 tabular-nums">
                  Dokument {currentIndex + 1} af {reviewQueue.length}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Split layout */}
        <div className="grid grid-cols-[1.6fr_1fr] gap-4 flex-1 min-h-0">
          {/* === LEFT: Mock PDF preview === */}
          <div className="bg-white rounded-xl ring-1 ring-slate-900/[0.06] shadow-[0_1px_2px_rgba(15,23,42,0.04)] flex flex-col [overflow:clip]">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100">
              <span className="text-[11px] font-medium text-slate-500 truncate">
                {doc.fileName}
              </span>
              <span className="text-[11px] text-slate-400 shrink-0 ml-2 tabular-nums">
                Side 1 af 12
              </span>
            </div>
            <div className="flex-1 overflow-y-auto bg-slate-50/40 p-6">
              <div className="bg-white rounded-lg ring-1 ring-slate-200/60 shadow-sm px-10 py-10 space-y-7 text-[13px] leading-relaxed text-slate-700 max-w-[640px] mx-auto">
                {mockPdfBlocks.map((block) => {
                  const isHighlighted =
                    hoveredSourceText !== null &&
                    block.text.includes(hoveredSourceText.slice(0, 20))
                  return (
                    <div key={block.id}>
                      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-[0.1em] mb-1.5">
                        {block.paragraph}
                      </p>
                      <p
                        className={cn(
                          'transition-all rounded px-1.5 -mx-1.5 py-0.5',
                          isHighlighted && 'bg-amber-200/70 ring-1 ring-amber-300'
                        )}
                      >
                        {block.text}
                      </p>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* === RIGHT: Extraction panel === */}
          <div className="bg-white rounded-xl ring-1 ring-slate-900/[0.06] shadow-[0_1px_2px_rgba(15,23,42,0.04)] flex flex-col [overflow:clip]">
            <div className="px-5 py-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-violet-50 flex items-center justify-center">
                  <Sparkles className="w-3.5 h-3.5 text-violet-600" />
                </div>
                <span className="text-[12px] font-semibold text-slate-900">AI-ekstraktion</span>
              </div>
              <p className="text-[10px] text-slate-400 mt-1 ml-8">
                Hover et felt for at se det i dokumentet
              </p>
            </div>

            {/* Scrollable sections */}
            <div className="flex-1 overflow-y-auto">
              {/* Attention section */}
              {attentionFields.length > 0 && (
                <div>
                  <div className="px-5 py-2.5 border-b border-slate-100 flex items-center gap-2 bg-amber-50/30">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                    <span className="text-[11px] font-semibold text-slate-900">
                      Kræver opmærksomhed
                    </span>
                    <span className="text-[10px] text-slate-400">({attentionFields.length})</span>
                  </div>
                  {attentionFields
                    .filter((f) => f.discrepancyType !== 'missing_clause')
                    .map((field) => (
                      <AttentionFieldRow
                        key={field.id}
                        field={field}
                        extractionId={doc.extractionId!}
                        isHovered={hoveredFieldId === field.id}
                        onMouseEnter={setHoveredFieldId}
                        onMouseLeave={() => setHoveredFieldId(null)}
                        decided={decidedIds.has(field.id)}
                        onDecide={markDecided}
                      />
                    ))}
                </div>
              )}

              {/* Missing clauses */}
              {missingClauseFields.length > 0 && (
                <div>
                  <div className="px-5 py-2.5 border-b border-slate-100 flex items-center gap-2 bg-rose-50/30">
                    <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                    <span className="text-[11px] font-semibold text-slate-900">
                      Manglende klausuler
                    </span>
                    <span className="text-[10px] text-slate-400">
                      ({missingClauseFields.length})
                    </span>
                  </div>
                  {missingClauseFields.map((field) => {
                    const isDecided = decidedIds.has(field.id)
                    return (
                      <MissingClauseRow
                        key={field.id}
                        field={field}
                        extractionId={doc.extractionId!}
                        isDecided={isDecided}
                        onDecide={markDecided}
                      />
                    )
                  })}
                </div>
              )}

              {/* High confidence — collapsible */}
              {highConfidenceFields.length > 0 && (
                <div>
                  <button
                    type="button"
                    onClick={() => setShowHighConf(!showHighConf)}
                    className="w-full px-5 py-2.5 border-b border-slate-100 flex items-center gap-2 bg-emerald-50/20 hover:bg-emerald-50/40 transition-colors text-left"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-[11px] font-semibold text-slate-900">
                      Høj konfidence · auto-godkendt
                    </span>
                    <span className="text-[10px] text-slate-400">
                      ({highConfidenceFields.length})
                    </span>
                    <ChevronDown
                      className={cn(
                        'w-3.5 h-3.5 text-slate-400 ml-auto transition-transform',
                        showHighConf && 'rotate-180'
                      )}
                    />
                  </button>
                  {showHighConf && (
                    <div>
                      {highConfidenceFields.map((field) => (
                        <HighConfidenceRow
                          key={field.id}
                          field={field}
                          isHovered={hoveredFieldId === field.id}
                          onMouseEnter={setHoveredFieldId}
                          onMouseLeave={() => setHoveredFieldId(null)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Tom state — ingen felter */}
              {fields.length === 0 && (
                <div className="p-8 text-center">
                  <p className="text-[12px] text-slate-400">Ingen ekstraherede felter fundet</p>
                </div>
              )}
            </div>

            {/* Bottom action bar */}
            <div className="border-t border-slate-100 bg-slate-50/40">
              {/* Progress bar */}
              {totalNeedsDecision > 0 && (
                <div className="px-4 pt-3 pb-2">
                  <div className="flex items-center justify-between text-[10px] font-medium text-slate-500 mb-1.5">
                    <span>Beslutninger</span>
                    <span className="tabular-nums">
                      {decidedCount} af {totalNeedsDecision} besluttet
                    </span>
                  </div>
                  <div className="h-1 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all duration-300',
                        allDecided ? 'bg-emerald-500' : 'bg-slate-900'
                      )}
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between gap-2 px-4 py-3">
                <button
                  onClick={() => toast.info('Dokument afvist (funktion kommer senere)')}
                  className="bg-white ring-1 ring-slate-900/[0.08] text-slate-700 text-[12px] font-medium px-3 py-1.5 rounded-md hover:bg-slate-50 transition-colors"
                >
                  Afvis
                </button>
                <div className="flex items-center gap-1.5">
                  <button
                    disabled={!allDecided || isApproving}
                    title={
                      allDecided
                        ? 'Godkend dokumentet og fortsæt'
                        : `Behandl de ${totalNeedsDecision - decidedCount} resterende felter før du kan godkende`
                    }
                    onClick={handleApprove}
                    className={cn(
                      'text-[12px] font-medium px-3.5 py-1.5 rounded-md transition-colors',
                      allDecided && !isApproving
                        ? 'bg-slate-900 text-white hover:bg-slate-800'
                        : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                    )}
                  >
                    {isApproving ? 'Godkender...' : 'Godkend'}
                  </button>
                  <button
                    onClick={handleNext}
                    className="flex items-center gap-1 bg-white ring-1 ring-slate-900/[0.08] text-slate-700 text-[12px] font-medium px-3 py-1.5 rounded-md hover:bg-slate-50 transition-colors"
                  >
                    Næste
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
              {/* Helper text under disabled Godkend */}
              {!allDecided && totalNeedsDecision > 0 && (
                <div className="px-4 pb-3 -mt-1 text-right text-[10px] text-slate-400">
                  Behandl de {totalNeedsDecision - decidedCount} resterende felter for at godkende
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------
// Missing clause row — extracted from inline JSX for cleanliness
// ---------------------------------------------------------------
function MissingClauseRow({
  field,
  extractionId,
  isDecided,
  onDecide,
}: {
  field: ReviewField
  extractionId: string
  isDecided: boolean
  onDecide: (id: string) => void
}) {
  const [isPending, startTransition] = useTransition()

  function decide(decision: 'add_manual' | 'accept_missing', label: string) {
    startTransition(async () => {
      const result = await saveFieldDecision({
        extractionId,
        fieldName: field.fieldName,
        decision,
        aiValue: field.extractedValue,
        existingValue: field.existingValue,
        confidence: field.confidence,
      })
      if (result.error) {
        toast.error(result.error)
        return
      }
      onDecide(field.id)
      toast.success(`${field.fieldLabel}: ${label}`)
    })
  }

  return (
    <div
      className={cn(
        'px-5 py-3.5 border-b border-slate-100 last:border-b-0',
        isDecided && 'bg-emerald-50/30'
      )}
    >
      <div className="flex items-start gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-rose-500 mt-1.5 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-[12px] font-semibold text-slate-900">{field.fieldLabel}</p>
            {isDecided && (
              <span className="ml-auto flex items-center gap-1 text-[10px] font-medium text-emerald-600">
                <CheckCircle2 className="w-3 h-3" />
                Besluttet
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
            Klausulen er ikke fundet i dokumentet, men optræder i eksisterende aftale:{' '}
            <span className="font-medium text-slate-700">{field.existingValue}</span>
          </p>
          <p className="text-[10px] text-slate-400 mt-1 font-medium tracking-wide">
            Side {field.sourcePageNumber} · {field.sourceParagraph}
          </p>
          {!isDecided && (
            <div className="mt-2 flex gap-1.5">
              <button
                disabled={isPending}
                onClick={() => decide('add_manual', 'tilføjet manuelt')}
                className="bg-slate-900 text-white text-[11px] font-medium px-2.5 py-1 rounded-md hover:bg-slate-800 disabled:opacity-50"
              >
                Tilføj manuelt
              </button>
              <button
                disabled={isPending}
                onClick={() => decide('accept_missing', 'accepteret som manglende')}
                className="bg-white ring-1 ring-slate-900/[0.08] text-slate-700 text-[11px] font-medium px-2.5 py-1 rounded-md hover:bg-slate-50 disabled:opacity-50"
              >
                Accepter
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
