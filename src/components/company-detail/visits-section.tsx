import Link from 'next/link'
import { SectionCard } from './section-card'
import { cn } from '@/lib/utils'

export interface VisitRow {
  id: string
  typeLabel: string
  meta: string
  badge: { label: string; tone: 'blue' | 'green' | 'slate' }
}

export interface VisitsSectionProps {
  visits: VisitRow[]
}

const BADGE_TONES: Record<string, string> = {
  blue: 'bg-blue-50 text-blue-600',
  green: 'bg-green-50 text-green-700',
  slate: 'bg-slate-100 text-slate-500',
}

const ICON_TONES: Record<string, string> = {
  blue: 'bg-blue-50 text-blue-600',
  green: 'bg-green-50 text-green-700',
  slate: 'bg-slate-100 text-slate-500',
}

export function VisitsSection({ visits }: VisitsSectionProps) {
  return (
    <SectionCard title="Besoeg & governance">
      {visits.length === 0 ? (
        <p className="py-2 text-center text-xs text-slate-400">Ingen besoeg registreret</p>
      ) : (
        visits.slice(0, 3).map((v) => (
          <Link
            key={v.id}
            href={`/visits/${v.id}`}
            className="flex items-center gap-2.5 border-b border-slate-50 py-2.5 no-underline last:border-0"
          >
            <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[12px] font-extrabold', ICON_TONES[v.badge.tone])}>
              B
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-slate-900">{v.typeLabel}</div>
              <div className="text-[11px] text-slate-400">{v.meta}</div>
            </div>
            <span className={cn('whitespace-nowrap rounded-md px-2 py-[3px] text-[10px] font-bold', BADGE_TONES[v.badge.tone])}>
              {v.badge.label}
            </span>
          </Link>
        ))
      )}
    </SectionCard>
  )
}
