import { cn } from '@/lib/utils'

// AlertBar — fuld-bredde meddelelses-bar med tonet baggrund og venstre accent-line.
// Bruges typisk ved tidskritisk info (kontrakt udløber, sag haster).
//
// Brug:
//   <AlertBar tone="red" actions={<BButton primary>Start forny-flow</BButton>}>
//     <strong>Lejekontrakt udløber om 14 dage</strong> · forhandling ikke startet
//   </AlertBar>

export type AlertTone = 'red' | 'amber' | 'blue'

const toneStyles: Record<AlertTone, string> = {
  red: 'bg-b-red-bg border-[#ffc1ba] border-l-[3px] border-l-b-red-fg text-[#6e1010]',
  amber: 'bg-b-amber-bg border-[#e6d370] border-l-[3px] border-l-b-amber-fg text-[#6e5a10]',
  blue: 'bg-b-blue-bg border-[#b6e3ff] border-l-[3px] border-l-b-blue-fg text-[#0d3f7d]',
}

export function AlertBar({
  tone = 'red',
  children,
  actions,
  className,
}: {
  tone?: AlertTone
  children: React.ReactNode
  actions?: React.ReactNode
  className?: string
}) {
  return (
    <div
      role="alert"
      className={cn(
        'flex items-center justify-between gap-3 rounded-[4px] border px-3.5 py-2 text-[13px]',
        toneStyles[tone],
        className
      )}
    >
      <div>{children}</div>
      {actions && <div className="flex shrink-0 gap-1.5">{actions}</div>}
    </div>
  )
}
