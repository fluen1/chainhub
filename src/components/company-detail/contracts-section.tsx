import Link from 'next/link'
import { SectionCard } from './section-card'
import { cn } from '@/lib/utils'

export interface ContractRow {
  id: string
  iconLetters: string
  iconTone: 'red' | 'amber' | 'green'
  name: string
  meta: string
  badge: { label: string; tone: 'red' | 'amber' | 'green' }
}

export interface ContractsSectionProps {
  contracts: ContractRow[]
  totalCount: number
  companyId: string
}

const ICON_TONES: Record<string, string> = {
  red: 'bg-red-50 text-red-600',
  amber: 'bg-amber-50 text-amber-700',
  green: 'bg-green-50 text-green-700',
}

const BADGE_TONES: Record<string, string> = {
  red: 'bg-red-50 text-red-600',
  amber: 'bg-amber-50 text-amber-700',
  green: 'bg-green-50 text-green-700',
}

export function ContractsSection({ contracts, totalCount, companyId }: ContractsSectionProps) {
  const expired = contracts.filter((c) => c.badge.tone === 'red').length
  const badge =
    expired > 0
      ? { label: `${expired} udloebet`, tone: 'red' as const }
      : totalCount > 0
        ? { label: `${totalCount} aktive`, tone: 'green' as const }
        : undefined

  return (
    <SectionCard
      title="Kontrakter"
      badge={badge}
      footerLinkHref={totalCount > 3 ? `/contracts?company=${companyId}` : undefined}
      footerLinkLabel={totalCount > 3 ? `Vis alle ${totalCount} kontrakter →` : undefined}
    >
      {contracts.length === 0 ? (
        <p className="py-2 text-center text-xs text-slate-400">Ingen aktive kontrakter</p>
      ) : (
        contracts.slice(0, 3).map((c) => (
          <Link
            key={c.id}
            href={`/contracts/${c.id}`}
            className="flex items-center gap-2.5 border-b border-slate-50 py-2.5 no-underline last:border-0"
          >
            <div
              className={cn(
                'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[12px] font-extrabold',
                ICON_TONES[c.iconTone]
              )}
            >
              {c.iconLetters}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-slate-900">{c.name}</div>
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
