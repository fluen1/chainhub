'use client'

import { cn } from '@/lib/utils'

export interface KpiCardProps {
  label: string
  value: string | number
  trend?: { text: string; direction: 'up' | 'down' | 'neutral' }
  valueColor?: 'default' | 'warning' | 'danger'
  onClick?: () => void
}

export function KpiCard({ label, value, trend, valueColor = 'default', onClick }: KpiCardProps) {
  const baseClass = cn(
    'rounded-xl border border-gray-200 bg-white p-5 transition-shadow duration-200 hover:shadow-md',
    onClick && 'cursor-pointer text-left w-full'
  )
  const content = (
    <>
      <div className="text-xs font-medium text-gray-500">{label}</div>
      <div
        className={cn(
          'mt-2 text-[30px] font-bold leading-none tabular-nums',
          valueColor === 'warning' && 'text-amber-600',
          valueColor === 'danger' && 'text-red-600',
          valueColor === 'default' && 'text-slate-900'
        )}
      >
        {value}
      </div>
      {trend && (
        <div
          className={cn(
            'mt-2 inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium',
            trend.direction === 'up' && 'bg-green-50 text-green-600',
            trend.direction === 'down' && 'bg-red-50 text-red-600',
            trend.direction === 'neutral' && 'bg-slate-50 text-slate-500'
          )}
        >
          {trend.text}
        </div>
      )}
    </>
  )

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={baseClass}>
        {content}
      </button>
    )
  }

  return <div className={baseClass}>{content}</div>
}
