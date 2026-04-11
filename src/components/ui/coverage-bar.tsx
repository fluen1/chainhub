import { cn } from '@/lib/utils'

export interface CoverageBarProps {
  label: string
  percentage: number
}

export function CoverageBar({ label, percentage }: CoverageBarProps) {
  const fillColor = percentage >= 100
    ? 'bg-green-500'
    : percentage >= 75
      ? 'bg-blue-500'
      : 'bg-amber-500'

  return (
    <div className="flex items-center gap-3 mb-3.5">
      <div className="w-28 shrink-0 text-[13px] text-slate-500">{label}</div>
      <div className="flex-1 h-2 rounded bg-slate-100 overflow-hidden">
        <div
          className={cn('h-full rounded transition-all duration-400', fillColor)}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <div className="w-10 text-right text-[13px] font-semibold tabular-nums text-slate-500">
        {percentage}%
      </div>
    </div>
  )
}
