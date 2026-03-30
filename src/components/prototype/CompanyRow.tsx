'use client'

import { cn } from '@/lib/utils'

interface CompanyRowProps {
  initials: string
  name: string
  meta: string
  status: { label: string; type: 'ok' | 'warning' | 'critical' }
  avatarColor: string
  href?: string
}

export function CompanyRow({ initials, name, meta, status, avatarColor, href }: CompanyRowProps) {
  const Wrapper = href ? 'a' : 'div'
  return (
    <Wrapper
      href={href}
      className="flex items-center gap-3 border-b border-slate-50 py-2.5 last:border-none cursor-pointer"
    >
      <div
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold text-white"
        style={{ backgroundColor: avatarColor }}
      >
        {initials}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-medium text-slate-800">{name}</div>
        <div className="text-xs text-gray-400">{meta}</div>
      </div>
      <span
        className={cn(
          'rounded-md px-2.5 py-0.5 text-[11px] font-medium',
          status.type === 'ok' && 'bg-green-50 text-green-600',
          status.type === 'warning' && 'bg-amber-50 text-amber-600',
          status.type === 'critical' && 'bg-red-50 text-red-600'
        )}
      >
        {status.label}
      </span>
    </Wrapper>
  )
}
