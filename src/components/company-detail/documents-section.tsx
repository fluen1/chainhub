import Link from 'next/link'
import { SectionCard } from './section-card'
import { cn } from '@/lib/utils'

export interface DocumentRow {
  id: string
  isAiExtracted: boolean
  fileName: string
  meta: string
  badge: { label: string; tone: 'purple' | 'green' }
}

export interface DocumentsSectionProps {
  documents: DocumentRow[]
  awaitingReviewCount: number
}

const BADGE_TONES: Record<string, string> = {
  purple: 'bg-purple-50 text-purple-700',
  green: 'bg-green-50 text-green-700',
}

export function DocumentsSection({ documents, awaitingReviewCount }: DocumentsSectionProps) {
  const badge =
    awaitingReviewCount > 0
      ? { label: `${awaitingReviewCount} til review`, tone: 'purple' as const }
      : undefined

  return (
    <SectionCard title="Seneste dokumenter" badge={badge}>
      {documents.length === 0 ? (
        <p className="py-2 text-center text-xs text-slate-400">Ingen dokumenter uploadet</p>
      ) : (
        documents.slice(0, 3).map((d) => (
          <Link
            key={d.id}
            href={`/documents/review/${d.id}`}
            className="flex items-center gap-2.5 border-b border-slate-50 py-2.5 no-underline last:border-0"
          >
            <div
              className={cn(
                'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[12px] font-extrabold',
                d.isAiExtracted ? 'bg-purple-50 text-purple-700' : 'bg-slate-100 text-slate-500'
              )}
            >
              {d.isAiExtracted ? 'AI' : 'PDF'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-slate-900">{d.fileName}</div>
              <div className="text-[11px] text-slate-400">{d.meta}</div>
            </div>
            <span
              className={cn('whitespace-nowrap rounded-md px-2 py-[3px] text-[10px] font-bold', BADGE_TONES[d.badge.tone])}
            >
              {d.badge.label}
            </span>
          </Link>
        ))
      )}
    </SectionCard>
  )
}
