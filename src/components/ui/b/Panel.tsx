import { cn } from '@/lib/utils'

// Panel — den centrale containers i B-stil.
//
// Mønster:
//   ┌──────────────────────────────┐
//   │ TITEL · meta         actions │  ← PanelHeader (#fbfbfc)
//   ├──────────────────────────────┤
//   │ body (rows / grid / ...)     │  ← PanelBody (white)
//   ├──────────────────────────────┤
//   │ footer (sum + add-CTA)       │  ← PanelFooter (#fbfbfc)
//   └──────────────────────────────┘
//
// Alle paneler er hvide med 1px #e1e4e8 border og 4px radius.

export function Panel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn('overflow-hidden rounded-[4px] border border-b-border bg-b-panel', className)}
    >
      {children}
    </div>
  )
}

export function PanelHeader({
  title,
  meta,
  actions,
  className,
}: {
  title: React.ReactNode
  meta?: React.ReactNode
  actions?: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex items-center justify-between border-b border-b-border bg-b-panel-h px-3 py-2',
        className
      )}
    >
      <div className="flex items-baseline gap-2">
        <span
          className="text-[12px] font-semibold uppercase text-b-1"
          style={{ letterSpacing: '0.4px' }}
        >
          {title}
        </span>
        {meta && <span className="text-[11px] text-b-2 b-tnum">{meta}</span>}
      </div>
      {actions && <div className="flex items-center gap-2 text-[11px] text-b-2">{actions}</div>}
    </div>
  )
}

export function PanelBody({
  children,
  className,
  noPadding = false,
}: {
  children: React.ReactNode
  className?: string
  noPadding?: boolean
}) {
  return <div className={cn(noPadding ? '' : 'px-3 py-2', className)}>{children}</div>
}

export function PanelFooter({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'border-t border-b-border bg-b-panel-h px-3 py-2 text-[11px] text-b-2',
        className
      )}
    >
      {children}
    </div>
  )
}

// Mindre uppercase group-label (bruges inde i en panel-body til at gruppere
// rækker, fx "Forfaldent" / "Denne uge").
export function PanelGroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="border-b border-b-divider bg-b-panel-h px-3 pb-1 pt-2.5 text-[10px] font-semibold uppercase text-b-2"
      style={{ letterSpacing: '0.4px' }}
    >
      {children}
    </div>
  )
}
