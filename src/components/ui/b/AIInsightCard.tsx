import { cn } from '@/lib/utils'

// AIInsightCard — den lilla AI-output card.
// AFGRÆNSET til AI-sektioner: ingen ikke-AI brug, så den lilla farve bevarer
// sin betydning på tværs af systemet.
//
// Brug:
//   <AIInsightCard label="⚡ Renewal-risk" confidence="82% konfidens" cite="...">
//     Forventet markedsleje for Østerbrogade-segmentet er <strong>10–12% over</strong>...
//   </AIInsightCard>

export function AIInsightCard({
  label,
  confidence,
  children,
  cite,
  actionHref,
  actionLabel,
  className,
}: {
  label: React.ReactNode
  confidence?: React.ReactNode
  children: React.ReactNode
  cite?: React.ReactNode
  actionHref?: string
  actionLabel?: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'rounded-[3px] border border-b-ai-border bg-[linear-gradient(135deg,#f3e8ff_0%,#ede9fe_100%)] px-3 py-2.5',
        className
      )}
    >
      <div className="mb-1.5 flex items-center justify-between">
        <span
          className="text-[10px] font-bold uppercase text-b-ai-accent"
          style={{ letterSpacing: '0.5px' }}
        >
          {label}
        </span>
        {confidence && <span className="b-tnum text-[10px] text-b-ai-accent">{confidence}</span>}
      </div>
      <div className="text-[12px] leading-[1.5] text-b-ai-fg">{children}</div>
      {cite && <div className="mt-1.5 text-[11px] italic text-b-ai-accent">{cite}</div>}
      {actionHref && (
        <div className="mt-2">
          <a
            href={actionHref}
            className="text-[11px] font-semibold text-b-ai-accent no-underline hover:underline"
          >
            {actionLabel ?? 'Se mere →'}
          </a>
        </div>
      )}
    </div>
  )
}

// Lille "PLUS"-badge der bruges i panel-headere ved AI-features.
export function PlusBadge() {
  return (
    <span
      className="rounded-[3px] bg-[#f3e8ff] px-1.5 py-0.5 text-[9px] font-bold uppercase text-b-ai-accent"
      style={{ letterSpacing: '0.4px' }}
    >
      Plus
    </span>
  )
}
