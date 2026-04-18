import Link from 'next/link'
import { SectionCard } from './section-card'
import { cn } from '@/lib/utils'

export interface CaseRow {
  id: string
  iconLetter: string
  iconTone: 'red' | 'amber'
  title: string
  meta: string
  badge: { label: string; tone: 'red' | 'amber' }
}

export interface CasesSectionProps {
  cases: CaseRow[]
  totalCount: number
}

const ICON_TONES: Record<string, string> = {
  red: 'bg-red-50 text-red-600',
  amber: 'bg-amber-50 text-amber-700',
}

const BADGE_TONES: Record<string, string> = {
  red: 'bg-red-50 text-red-600',
  amber: 'bg-amber-50 text-amber-700',
}

export function CasesSection({ cases, totalCount }: CasesSectionProps) {
  const badge = totalCount > 0 ? { label: `${totalCount} aktive`, tone: 'red' as const } : undefined

  return (
    <SectionCard title="Åbne sager" badge={badge}>
      {cases.length === 0 ? (
        <p className="py-2 text-center text-xs text-slate-400">Ingen åbne sager</p>
      ) : (
        cases.slice(0, 3).map((c) => (
          <Link
            key={c.id}
            href={`/cases/${c.id}`}
            className="flex items-center gap-2.5 border-b border-slate-50 py-2.5 no-underline last:border-0"
          >
            <div
              className={cn(
                'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[12px] font-extrabold',
                ICON_TONES[c.iconTone]
              )}
            >
              {c.iconLetter}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-slate-900">{c.title}</div>
              <div className="text-[11px] text-slate-400">{c.meta}</div>
            </div>
            <span
              className={cn(
                'whitespace-nowrap rounded-md px-2 py-[3px] text-[10px] font-bold',
                BADGE_TONES[c.badge.tone]
              )}
            >
              {c.badge.label}
            </span>
          </Link>
        ))
      )}
    </SectionCard>
  )
}
