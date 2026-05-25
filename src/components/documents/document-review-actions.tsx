'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { submitDocumentForReview, reviewDocument } from '@/actions/documents'
import { getDocumentStatusLabel, getDocumentStatusColor } from '@/lib/labels'

interface DocumentReviewActionsProps {
  documentId: string
  status: string
  canReview: boolean
}

export function DocumentReviewActions({
  documentId,
  status,
  canReview,
}: DocumentReviewActionsProps) {
  const [comment, setComment] = useState('')
  const [isPending, startTransition] = useTransition()

  function handleSubmitForReview() {
    startTransition(async () => {
      const result = await submitDocumentForReview({ documentId })
      if ('error' in result) toast.error(result.error)
      else toast.success('Dokument sendt til godkendelse')
    })
  }

  function handleReview(decision: 'GODKENDT' | 'AFVIST') {
    startTransition(async () => {
      const result = await reviewDocument({ documentId, decision, comment })
      if ('error' in result) toast.error(result.error)
      else toast.success(decision === 'GODKENDT' ? 'Dokument godkendt' : 'Dokument afvist')
    })
  }

  return (
    <div className="space-y-3">
      <span
        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${getDocumentStatusColor(status)}`}
      >
        {getDocumentStatusLabel(status)}
      </span>

      {status === 'KLADDE' && (
        <button
          onClick={handleSubmitForReview}
          disabled={isPending}
          className="block rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
        >
          Send til godkendelse
        </button>
      )}

      {status === 'TIL_REVIEW' && canReview && (
        <div className="space-y-2">
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Kommentar (valgfri)..."
            className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm min-h-[40px] resize-y focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
          />
          <div className="flex gap-2">
            <button
              onClick={() => handleReview('GODKENDT')}
              disabled={isPending}
              className="rounded-md bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
            >
              Godkend
            </button>
            <button
              onClick={() => handleReview('AFVIST')}
              disabled={isPending}
              className="rounded-md border border-red-200 bg-white px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
            >
              Afvis
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
