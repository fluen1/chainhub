import { cn } from '@/lib/utils'

// BottomBar — sidens bund-meta-linje. Renderes som sidste element i b-main.
//
// Brug:
//   <BottomBar
//     left={<><SyncDot /> Sidst synkroniseret 14:32 · 32 selskaber</>}
//     right={<><KbdHint k="⌘K" label="handling" /> · <KbdHint k="G" label="derhen" /></>}
//   />

export function BottomBar({
  left,
  right,
  className,
}: {
  left?: React.ReactNode
  right?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex items-center justify-between py-1.5 text-[11px] text-b-2', className)}>
      <span>{left}</span>
      <span className="flex items-center gap-2">{right}</span>
    </div>
  )
}

// Lille grøn prik — bruges typisk i bottombar til at signalere live sync.
export function SyncDot() {
  return <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full align-middle bg-b-green-fg" />
}
