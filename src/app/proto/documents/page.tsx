'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Upload, FileText, CheckCircle2, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { usePrototype } from '@/components/prototype/PrototypeProvider'
import { CollapsibleSection } from '@/components/ui/CollapsibleSection'
import {
  getDocuments,
  getDocumentsAwaitingReview,
  getDocumentsProcessing,
} from '@/mock/documents'
import type { MockDocument } from '@/mock/types'

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('da-DK', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function ReviewDocRow({ doc }: { doc: MockDocument }) {
  const isHighConfidence = doc.confidenceLevel === 'high' && (doc.attentionFieldCount ?? 0) <= 1

  return (
    <div className="flex items-center justify-between px-5 py-3 border-b last:border-b-0 hover:bg-gray-50 transition-colors">
      <div className="flex items-start gap-3 min-w-0">
        <FileText className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">{doc.fileName}</p>
          <p className="text-xs text-gray-500 mt-0.5">
            {doc.extractedFieldCount ?? 0} felter udtrukket
            {(doc.attentionFieldCount ?? 0) > 0 && (
              <span className="ml-2 text-amber-600 font-medium">
                · {doc.attentionFieldCount} kræver opmærksomhed
              </span>
            )}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0 ml-4">
        {isHighConfidence && (
          <button
            onClick={() =>
              toast.success('Dokument godkendt (simuleret)')
            }
            className="inline-flex items-center gap-1 bg-gray-900 text-white text-xs px-3 py-1.5 rounded hover:bg-gray-700 transition-colors"
          >
            <CheckCircle2 className="h-3 w-3" />
            Hurtig-godkend
          </button>
        )}
        <Link
          href={`/proto/documents/review/${doc.id}`}
          className="inline-flex items-center gap-1 bg-white border border-gray-300 text-gray-700 text-xs px-3 py-1.5 rounded hover:bg-gray-50 transition-colors"
        >
          Gennemgå →
        </Link>
      </div>
    </div>
  )
}

function ProcessingDocRow({ doc }: { doc: MockDocument }) {
  const progress = doc.processingProgress ?? 0

  return (
    <div className="px-5 py-3 border-b last:border-b-0">
      <div className="flex items-center gap-3">
        <Loader2 className="h-4 w-4 text-blue-500 animate-spin shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">{doc.fileName}</p>
          <p className="text-xs text-gray-500 mt-0.5">
            {doc.processingStage ?? 'Behandler...'} · Typisk 30-45 sek.
          </p>
          <div className="mt-2 h-1.5 bg-gray-200 rounded-full overflow-hidden w-full max-w-xs">
            <div
              className="h-full bg-blue-500 rounded-full transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
        <span className="text-xs text-gray-400 shrink-0">{progress}%</span>
      </div>
    </div>
  )
}

function RecentDocRow({ doc }: { doc: MockDocument }) {
  return (
    <div className="flex items-center justify-between px-5 py-3 border-b last:border-b-0 hover:bg-gray-50 transition-colors">
      <div className="flex items-center gap-3 min-w-0">
        <FileText className="h-4 w-4 text-gray-300 shrink-0" />
        <div className="min-w-0">
          <p className="text-sm text-gray-800 truncate">{doc.fileName}</p>
          <p className="text-xs text-gray-400 mt-0.5">{doc.companyName}</p>
        </div>
      </div>
      <span className="text-xs text-gray-400 shrink-0 ml-4">{formatDate(doc.uploadedAt)}</span>
    </div>
  )
}

export default function PrototypeDocumentsPage() {
  const { dataScenario } = usePrototype()
  const [isDragOver, setIsDragOver] = useState(false)

  const allDocuments = getDocuments(dataScenario)
  const reviewDocs = getDocumentsAwaitingReview()
  const processingDocs = getDocumentsProcessing()
  const recentDocs = allDocuments
    .filter((d) => d.status === 'reviewed' || d.status === 'archived')
    .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime())
    .slice(0, 10)

  const handleUploadClick = () => {
    toast.info('Upload simuleret — i prototypen behandles dokumenter ikke reelt')
  }

  if (dataScenario === 'empty') {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">Dokumenter</h1>
        <div className="rounded-lg border bg-white p-12 text-center shadow-sm">
          <Upload className="mx-auto h-10 w-10 text-gray-300" />
          <p className="mt-4 text-sm font-medium text-gray-900">Ingen dokumenter endnu.</p>
          <p className="mt-1 text-sm text-gray-500">
            Upload dit første dokument for at komme i gang.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dokumenter</h1>
        <p className="mt-1 text-sm text-gray-500">
          {allDocuments.length} dokumenter · {processingDocs.length} analyseres · {reviewDocs.length} klar til gennemgang
        </p>
      </div>

      {/* Upload zone */}
      <div
        role="button"
        tabIndex={0}
        onClick={handleUploadClick}
        onKeyDown={(e) => e.key === 'Enter' && handleUploadClick()}
        onDragOver={(e) => { e.preventDefault(); setIsDragOver(true) }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setIsDragOver(false); handleUploadClick() }}
        className={`
          border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
          ${isDragOver
            ? 'border-gray-500 bg-gray-50'
            : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
          }
        `}
      >
        <Upload className="mx-auto h-8 w-8 text-gray-400" />
        <p className="mt-3 text-sm font-medium text-gray-700">
          Træk filer hertil — AI-analyse starter automatisk
        </p>
        <p className="mt-1 text-xs text-gray-400">
          PDF, DOCX, XLSX · Maks 10 MB. Du kan fortsætte dit arbejde imens.
        </p>
      </div>

      {/* Klar til gennemgang */}
      {reviewDocs.length > 0 && (
        <CollapsibleSection
          title="Klar til gennemgang"
          count={reviewDocs.length}
          defaultOpen={true}
        >
          <div>
            {reviewDocs.map((doc) => (
              <ReviewDocRow key={doc.id} doc={doc} />
            ))}
          </div>
        </CollapsibleSection>
      )}

      {/* Analyseres nu */}
      {processingDocs.length > 0 && (
        <CollapsibleSection
          title="Analyseres nu"
          count={processingDocs.length}
          defaultOpen={true}
        >
          <div>
            {processingDocs.map((doc) => (
              <ProcessingDocRow key={doc.id} doc={doc} />
            ))}
          </div>
        </CollapsibleSection>
      )}

      {/* Seneste dokumenter */}
      {recentDocs.length > 0 && (
        <CollapsibleSection
          title="Seneste dokumenter"
          count={recentDocs.length}
          defaultOpen={true}
        >
          <div>
            {recentDocs.map((doc) => (
              <RecentDocRow key={doc.id} doc={doc} />
            ))}
          </div>
        </CollapsibleSection>
      )}
    </div>
  )
}
