import Link from 'next/link'
import { cn } from '@/lib/utils'

export interface SectionCardProps {
  title: string
  badge?: { label: string; tone: 'red' | 'amber' | 'green' | 'purple' | 'neutral' }
  footerLinkHref?: string
  footerLinkLabel?: string
  children: React.ReactNode
}

const BADGE_TONES: Record<string, string> = {
  red: 'bg-red-50 text-red-600',
  amber: 'bg-amber-50 text-amber-700',
  green: 'bg-green-50 text-green-700',
  purple: 'bg-purple-50 text-purple-700',
  neutral: 'bg-slate-100 text-slate-600',
}

export function SectionCard({ title, badge, footerLinkHref, footerLinkLabel, children }: SectionCardProps) {
  return (
    <div className="overflow-hidden rounded-2xl bg-white shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 pb-3 pt-4">
        <span className="text-[13px] font-bold tracking-tight text-slate-900">{title}</span>
        {badge && (
          <span
            className={cn('rounded-md px-2 py-[2px] text-[10px] font-bold', BADGE_TONES[badge.tone])}
          >
            {badge.label}
          </span>
        )}
      </div>
      <div className="px-5 py-4">
        {children}
        {footerLinkHref && footerLinkLabel && (
          <div className="pt-2 text-center">
            <Link href={footerLinkHref} className="text-[11px] font-semibold text-blue-600 no-underline">
              {footerLinkLabel}
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
