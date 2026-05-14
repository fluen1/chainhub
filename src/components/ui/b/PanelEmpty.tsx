import { cn } from '@/lib/utils'

// PanelEmpty — fælles empty-state for små panel-kroppe (Personer, Ejere, Aktivitet osv.)
//
// Brug:
//   <PanelEmpty>Ingen sager</PanelEmpty>                            // én linje
//   <PanelEmpty title="Ingen parter" hint="Tilføj for at signere" /> // to linjer

export function PanelEmpty({
  children,
  title,
  hint,
  className,
}: {
  children?: React.ReactNode
  title?: React.ReactNode
  hint?: React.ReactNode
  className?: string
}) {
  if (title || hint) {
    return (
      <div className={cn('px-3 py-4 text-center text-[12px]', className)}>
        {title && <div className="font-medium text-b-1">{title}</div>}
        {hint && <div className={cn('text-b-3', title ? 'mt-0.5' : '')}>{hint}</div>}
      </div>
    )
  }
  return (
    <div className={cn('px-3 py-3 text-center text-[12px] text-b-3', className)}>{children}</div>
  )
}
