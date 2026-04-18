'use client'

import { cn } from '@/lib/utils'
import type { UrgencyItem } from '@/types/ui'

export interface UrgencyListProps {
  title: string
  items: UrgencyItem[]
  viewAllHref?: string
}

export function UrgencyList({ title, items, viewAllHref }: UrgencyListProps) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <div className="mb-4 flex items-center justify-between text-sm font-semibold text-slate-900">
        {title}
        {viewAllHref && (
          <a href={viewAllHref} className="text-xs font-medium text-blue-500 hover:text-blue-600">
            Se alle →
          </a>
        )}
      </div>
      <div className="space-y-0">
        {items.map((item) => (
          <div
            key={item.id}
            className="flex items-center gap-3 border-b border-slate-50 py-2.5 last:border-none"
          >
            <div
              className={cn(
                'w-1 self-stretch rounded-full',
                item.indicator === 'red' && 'bg-red-500',
                item.indicator === 'amber' && 'bg-amber-500',
                item.indicator === 'blue' && 'bg-blue-500'
              )}
            />
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-medium text-slate-800">{item.name}</div>
              <div className="text-xs text-gray-400">{item.subtitle}</div>
            </div>
            <div
              className={cn(
                'shrink-0 text-xs tabular-nums',
                item.overdue ? 'font-medium text-red-600' : 'text-gray-400'
              )}
            >
              {item.days}
            </div>
          </div>
        ))}
        {items.length === 0 && (
          <div className="py-6 text-center text-xs text-gray-400">Ingen punkter</div>
        )}
      </div>
    </div>
  )
}
