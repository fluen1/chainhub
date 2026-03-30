import { cn } from '@/lib/utils'

interface CoverageBarProps {
  label: string
  covered: number
  total: number
  className?: string
}

export function CoverageBar({ label, covered, total, className }: CoverageBarProps) {
  const pct = total > 0 ? Math.round((covered / total) * 100) : 0
  const isComplete = covered >= total

  return (
    <div className={cn('space-y-1', className)}>
      <div className="flex items-center justify-between text-xs text-gray-600">
        <span>{label}</span>
        <span>
          {covered}/{total} ({pct}%)
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-gray-200 overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full transition-all duration-500',
            isComplete ? 'bg-green-500' : 'bg-amber-400',
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
