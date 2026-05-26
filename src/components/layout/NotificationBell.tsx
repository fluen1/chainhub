'use client'

import Link from 'next/link'
import { Bell } from 'lucide-react'
import { cn } from '@/lib/utils'

// ────────────────────────────────────────────────────────────────────────────
// NotificationBell — viser antal aktive advarsler som badge på klokken
// ────────────────────────────────────────────────────────────────────────────

interface NotificationBellProps {
  count: number
}

export function NotificationBell({ count }: NotificationBellProps) {
  const displayCount = count > 99 ? '99+' : String(count)
  const hasAlerts = count > 0

  return (
    <Link
      href="/dashboard"
      aria-label={hasAlerts ? `${count} aktive advarsler — gå til dashboard` : 'Ingen advarsler'}
      className={cn(
        'relative flex h-7 w-7 items-center justify-center rounded-[4px] transition-colors',
        hasAlerts ? 'hover:bg-[#ecedf0]' : 'opacity-50 hover:bg-[#ecedf0]'
      )}
    >
      <Bell className="h-4 w-4 text-b-1" aria-hidden />
      {hasAlerts && (
        <span
          className="absolute -right-1 -top-1 flex h-[14px] min-w-[14px] items-center justify-center rounded-full bg-[#b91c1c] px-0.5 text-[9px] font-semibold text-white"
          aria-hidden
        >
          {displayCount}
        </span>
      )}
    </Link>
  )
}
