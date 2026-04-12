import Link from 'next/link'
import { cn } from '@/lib/utils'

export interface AlertBannerProps {
  severity: 'critical' | 'warning'
  title: string
  sub: string
  actionLabel: string
  actionHref: string
}

export function AlertBanner({ severity, title, sub, actionLabel, actionHref }: AlertBannerProps) {
  const isWarning = severity === 'warning'
  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-xl border px-4 py-3.5',
        isWarning ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200'
      )}
    >
      <div
        className={cn(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] text-base font-extrabold',
          isWarning ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-600'
        )}
      >
        !
      </div>
      <div className="flex-1 min-w-0">
        <div className={cn('text-[13px] font-bold', isWarning ? 'text-amber-900' : 'text-red-900')}>
          {title}
        </div>
        <div className={cn('mt-0.5 text-xs', isWarning ? 'text-amber-800' : 'text-red-700')}>
          {sub}
        </div>
      </div>
      <Link
        href={actionHref}
        className={cn(
          'whitespace-nowrap rounded-lg border bg-white px-3 py-1.5 text-xs font-semibold no-underline',
          isWarning ? 'border-amber-200 text-amber-700' : 'border-red-200 text-red-600'
        )}
      >
        {actionLabel}
      </Link>
    </div>
  )
}
