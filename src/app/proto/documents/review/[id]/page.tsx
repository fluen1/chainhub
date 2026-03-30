'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, ArrowRight, CheckCircle2, XCircle, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import { usePrototype } from '@/components/prototype/PrototypeProvider'
import { CollapsibleSection } from '@/components/ui/CollapsibleSection'
import { getDocumentById, getExtractedFields } from '@/mock/documents'
import { cn } from '@/lib/utils'
import type { MockExtractedField } from '@/mock/types'

// Mock PDF tekst-blokke — tilknyttet feltid via sourceText
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

function confidenceDot(level: MockExtractedField['confidenceLevel']): string {
  switch (level) {
    case 'high': return 'bg-green-500'
    case 'medium': return 'bg-amber-400'
    case 'low': return 'bg-red-500'
  }
}

function confidenceLabel(confidence: number): string {
  return `${Math.round(confidence * 100)}% konfidence`
}

interface FieldRowProps {
  field: MockExtractedField
  onMouseEnter: (id: string) => void
  onMouseLeave: () => void
  isHovered: boolean
}

function AttentionFieldRow({ field, onMouseEnter, onMouseLeave, isHovered }: FieldRowProps) {
  const isMissingClause = field.discrepancyType === 'missing_clause'

  return (
    <div
      className={cn(
        'px-5 py-4 border-b last:border-b-0 transition-colors',
        isHovered ? 'bg-yellow-50' : 'hover:bg-gray-50'
      )}
      onMouseEnter={() => onMouseEnter(field.id)}
      onMouseLeave={onMouseLeave}
    >
      {/* Label + konfidence */}
      <div className="flex items-center gap-2 mb-2">
        <span className={cn('h-2 w-2 rounded-full shrink-0', confidenceDot(field.confidenceLevel))} />
        <span className="text-xs font-semibold text-gray-800">{field.fieldLabel}</span>
        <span className="text-xs text-gray-400">{confidenceLabel(field.confidence)}</span>
      </div>

      {/* Delta display */}
      {!isMissingClause && (
        <div className="ml-4 space-y-1 mb-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400 w-20 shrink-0">AI-fandt:</span>
            <span className="text-xs font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded">
              {field.extractedValue ?? '(tom)'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400 w-20 shrink-0">I systemet:</span>
            <span className="text-xs text-gray-600">
              {field.existingValue ?? '(ikke registreret)'}
            </span>
          </div>
        </div>
      )}

      {/* Kilde */}
      <p className="ml-4 text-xs text-gray-400 mb-3">
        Side {field.sourcePageNumber}, {field.sourceParagraph}
      </p>

      {/* Handlingsknapper */}
      <div className="ml-4 flex flex-wrap gap-2">
        {!isMissingClause ? (
          <>
            <button
              onClick={() => toast.success(`"${field.fieldLabel}" opdateret til AI-værdi (simuleret)`)}
              className="bg-gray-900 text-white text-xs px-3 py-1 rounded hover:bg-gray-700 transition-colors"
            >
              Brug AI-værdi
            </button>
            <button
              onClick={() => toast.info(`Beholder eksisterende værdi for "${field.fieldLabel}" (simuleret)`)}
              className="bg-white border border-gray-300 text-gray-700 text-xs px-3 py-1 rounded hover:bg-gray-50 transition-colors"
            >
              Behold eksisterende
            </button>
            <button
              onClick={() => toast.info(`Manuel redigering ikke tilgængelig i prototypen`)}
              className="bg-white border border-gray-300 text-gray-700 text-xs px-3 py-1 rounded hover:bg-gray-50 transition-colors"
            >
              Ret manuelt
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => toast.info(`Tilføj manuelt ikke tilgængeligt i prototypen`)}
              className="bg-gray-900 text-white text-xs px-3 py-1 rounded hover:bg-gray-700 transition-colors"
            >
              Tilføj manuelt
            </button>
            <button
              onClick={() => toast.info(`Manglende klausul accepteret (simuleret)`)}
              className="bg-white border border-gray-300 text-gray-700 text-xs px-3 py-1 rounded hover:bg-gray-50 transition-colors"
            >
              Accepter
            </button>
          </>
        )}
      </div>
    </div>
  )
}

function HighConfidenceRow({ field, onMouseEnter, onMouseLeave, isHovered }: FieldRowProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-3 px-5 py-2.5 border-b last:border-b-0 transition-colors',
        isHovered ? 'bg-yellow-50' : 'hover:bg-gray-50'
      )}
      onMouseEnter={() => onMouseEnter(field.id)}
      onMouseLeave={onMouseLeave}
    >
      <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
      <span className="text-xs font-medium text-gray-700 w-36 shrink-0">{field.fieldLabel}</span>
      <span className="text-xs text-gray-500 flex-1 truncate">{field.extractedValue}</span>
      <span className="text-xs text-gray-300 shrink-0">Side {field.sourcePageNumber}</span>
    </div>
  )
}

export default function DocumentReviewPage({ params }: { params: { id: string } }) {
  const { id } = params

  const { } = usePrototype()
  const [hoveredFieldId, setHoveredFieldId] = useState<string | null>(null)

  const doc = getDocumentById(id)
  const fields = getExtractedFields(id)

  if (!doc) {
    return (
      <div className="space-y-4">
        <Link href="/proto/documents" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 transition-colors">
          <ArrowLeft className="h-4 w-4" />
          Dokumenter
        </Link>
        <div className="rounded-lg border bg-white p-12 text-center shadow-sm">
          <XCircle className="mx-auto h-10 w-10 text-gray-300" />
          <p className="mt-4 text-sm text-gray-500">Dokument ikke fundet</p>
        </div>
      </div>
    )
  }

  const highConfidenceFields = fields.filter(
    (f) => f.confidenceLevel === 'high' && !f.hasDiscrepancy
  )
  const attentionFields = fields.filter(
    (f) => f.hasDiscrepancy || f.confidenceLevel !== 'high'
  )
  const missingClauseFields = fields.filter(
    (f) => f.discrepancyType === 'missing_clause'
  )
  const totalReady = highConfidenceFields.length
  const totalFields = fields.length

  // Map hovered field id to source text for highlighting
  const hoveredSourceText = hoveredFieldId
    ? fields.find((f) => f.id === hoveredFieldId)?.sourceText ?? null
    : null

  return (
    <div className="space-y-4">
      {/* Breadcrumb */}
      <Link
        href="/proto/documents"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Dokumenter
      </Link>

      <h1 className="text-lg font-bold text-gray-900 truncate">{doc.fileName}</h1>

      {/* Split layout */}
      <div className="grid grid-cols-5 gap-6 h-[calc(100vh-12rem)]">

        {/* === LEFT PANEL: Mock PDF preview === */}
        <div className="col-span-3 flex flex-col bg-gray-100 rounded-lg border overflow-hidden">
          {/* PDF header */}
          <div className="flex items-center justify-between px-4 py-2.5 bg-white border-b">
            <span className="text-xs font-medium text-gray-700 truncate">{doc.fileName}</span>
            <span className="text-xs text-gray-400 shrink-0 ml-2">Side 1 af 12</span>
          </div>

          {/* PDF content area */}
          <div className="flex-1 overflow-y-auto p-6">
            <div className="bg-white rounded shadow-sm px-8 py-8 min-h-full space-y-6 text-sm leading-relaxed text-gray-700">
              {mockPdfBlocks.map((block) => {
                const isHighlighted =
                  hoveredSourceText !== null &&
                  block.text.includes(hoveredSourceText.slice(0, 20))

                return (
                  <div key={block.id}>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
                      {block.paragraph}
                    </p>
                    <p
                      className={cn(
                        'transition-colors rounded px-1 -mx-1',
                        isHighlighted ? 'bg-yellow-200' : ''
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

        {/* === RIGHT PANEL: AI extraction === */}
        <div className="col-span-2 flex flex-col overflow-hidden rounded-lg border bg-white">
          {/* Panel header */}
          <div className="flex items-center gap-2 px-5 py-3 bg-gray-50 border-b">
            <span className="text-sm font-semibold text-gray-900">AI-ekstraktion</span>
            <span className="text-xs text-green-600 font-medium">
              {totalReady}/{totalFields} klar ✓
            </span>
          </div>

          {/* Scrollable field sections */}
          <div className="flex-1 overflow-y-auto">

            {/* Høj konfidence — collapsible, closed by default */}
            {highConfidenceFields.length > 0 && (
              <div className="border-b">
                <CollapsibleSection
                  title="Høj konfidence (auto)"
                  count={highConfidenceFields.length}
                  defaultOpen={false}
                >
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
                </CollapsibleSection>
              </div>
            )}

            {/* Kræver opmærksomhed — open by default */}
            {attentionFields.length > 0 && (
              <div className="border-b">
                <CollapsibleSection
                  title={`Kræver opmærksomhed`}
                  count={attentionFields.length}
                  defaultOpen={true}
                >
                  <div>
                    {attentionFields.map((field) => (
                      <AttentionFieldRow
                        key={field.id}
                        field={field}
                        isHovered={hoveredFieldId === field.id}
                        onMouseEnter={setHoveredFieldId}
                        onMouseLeave={() => setHoveredFieldId(null)}
                      />
                    ))}
                  </div>
                </CollapsibleSection>
              </div>
            )}

            {/* Manglende klausuler */}
            {missingClauseFields.length > 0 && (
              <div className="border-b">
                <CollapsibleSection
                  title="Manglende klausuler"
                  count={missingClauseFields.length}
                  defaultOpen={true}
                >
                  <div>
                    {missingClauseFields.map((field) => (
                      <div key={field.id} className="px-5 py-4 border-b last:border-b-0">
                        <div className="flex items-start gap-2 mb-2">
                          <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                          <div>
                            <p className="text-xs font-semibold text-gray-800">{field.fieldLabel}</p>
                            <p className="text-xs text-gray-500 mt-1">
                              Klausulen er ikke fundet i dette dokument, men optræder i eksisterende aftale:{' '}
                              <span className="font-medium">{field.existingValue}</span>
                            </p>
                            <p className="text-xs text-gray-400 mt-1">
                              Side {field.sourcePageNumber}, {field.sourceParagraph}
                            </p>
                          </div>
                        </div>
                        <div className="ml-6 flex gap-2">
                          <button
                            onClick={() => toast.info('Tilføj manuelt ikke tilgængeligt i prototypen')}
                            className="bg-gray-900 text-white text-xs px-3 py-1 rounded hover:bg-gray-700 transition-colors"
                          >
                            Tilføj manuelt
                          </button>
                          <button
                            onClick={() => toast.info('Manglende klausul accepteret (simuleret)')}
                            className="bg-white border border-gray-300 text-gray-700 text-xs px-3 py-1 rounded hover:bg-gray-50 transition-colors"
                          >
                            Accepter
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CollapsibleSection>
              </div>
            )}
          </div>

          {/* Bottom action bar */}
          <div className="flex items-center justify-end gap-2 px-4 py-3 bg-white border-t">
            <button
              onClick={() => toast.info('Dokument afvist (simuleret)')}
              className="bg-white border border-gray-300 text-gray-700 text-sm px-4 py-1.5 rounded hover:bg-gray-50 transition-colors"
            >
              Afvis
            </button>
            <button
              onClick={() => toast.success('Dokument godkendt (simuleret)')}
              className="bg-gray-900 text-white text-sm px-4 py-1.5 rounded hover:bg-gray-700 transition-colors"
            >
              Godkend
            </button>
            <button
              onClick={() => toast.info('Næste dokument ikke tilgængeligt i prototypen')}
              className="inline-flex items-center gap-1 bg-white border border-gray-300 text-gray-700 text-sm px-4 py-1.5 rounded hover:bg-gray-50 transition-colors"
            >
              Næste dok
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
