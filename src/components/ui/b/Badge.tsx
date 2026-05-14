import { cn } from '@/lib/utils'

// Badge — inline 11px funktionel etikette. Farve = mening:
//   red    kritisk / udløb
//   amber  advarsel / mid-term
//   green  OK / aktiv
//   blue   info / link / kommende
//   gray   neutral

export type BadgeTone = 'red' | 'amber' | 'green' | 'blue' | 'gray'

const tones: Record<BadgeTone, string> = {
  red: 'bg-b-red-bg text-b-red-fg',
  amber: 'bg-b-amber-bg text-b-amber-fg',
  green: 'bg-b-green-bg text-b-green-fg',
  blue: 'bg-b-blue-bg text-b-blue-fg',
  gray: 'bg-b-gray-bg text-b-gray-fg',
}

export function Badge({
  tone = 'gray',
  children,
  className,
}: {
  tone?: BadgeTone
  children: React.ReactNode
  className?: string
}) {
  return (
    <span
      className={cn(
        'b-tnum inline-flex items-center whitespace-nowrap rounded-[3px] px-1.5 py-px text-[11px] font-medium',
        tones[tone],
        className
      )}
    >
      {children}
    </span>
  )
}
