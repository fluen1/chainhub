import { cn } from '@/lib/utils'

export interface FinRowProps {
  label: string
  value: string
  valueColor?: string
  trend?: { text: string; direction: 'up' | 'down' }
}

export function FinRow({ label, value, valueColor, trend }: FinRowProps) {
  return (
    <div className="flex items-baseline justify-between border-b border-slate-50 py-2.5 last:border-none">
      <div className="text-[13px] text-slate-500">{label}</div>
      <div className="flex items-center gap-2">
        <span
          className="text-base font-semibold tabular-nums"
          style={{ color: valueColor || '#0f172a' }}
        >
          {value}
        </span>
        {trend && (
          <span
            className={cn(
              'rounded-md px-1.5 py-0.5 text-[11px] font-medium',
              trend.direction === 'up' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'
            )}
          >
            {trend.text}
          </span>
        )}
      </div>
    </div>
  )
}
