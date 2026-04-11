'use client'

import Link from 'next/link'
import { cn } from '@/lib/utils'

export interface CompanyRowProps {
  initials: string
  name: string
  meta: string
  status: { label: string; type: 'ok' | 'warning' | 'critical' }
  avatarColor: string
  href?: string
}

export function CompanyRow({ initials, name, meta, status, avatarColor, href }: CompanyRowProps) {
  const content = (
    <>
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
    </>
  )

  const className = 'flex items-center gap-3 border-b border-slate-50 py-2.5 last:border-none'

  if (href) {
    return <Link href={href} className={cn(className, 'cursor-pointer hover:bg-slate-50')}>{content}</Link>
  }
  return <div className={className}>{content}</div>
}
