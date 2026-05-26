'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut, useSession } from 'next-auth/react'
import { LogOut } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { SidebarBadge } from '@/types/ui'
import { BrandMark } from '@/components/ui/b'
import { NotificationBell } from './NotificationBell'

// ────────────────────────────────────────────────────────────────────────────
// B-stil sidebar (Linear/Superhuman dense, 220px lys)
// Reference: docs/design/handoff/project/Dashboard polish.html
// ────────────────────────────────────────────────────────────────────────────

interface BNavItem {
  name: string
  href: string
  badgeKey?: string
}

interface BNavSection {
  label: string
  items: BNavItem[]
}

// Struktur matcher design-mockup'en: 3 grupper hvor Søg og Indstillinger
// ligger i hhv. Overblik og Ressourcer (i stedet for separat top/bottom).
const SECTIONS: BNavSection[] = [
  {
    label: 'Overblik',
    items: [
      { name: 'Forside', href: '/dashboard', badgeKey: 'dashboard' },
      { name: 'Kalender', href: '/calendar', badgeKey: 'calendar' },
      { name: 'Søg', href: '/search' },
    ],
  },
  {
    label: 'Portefølje',
    items: [
      { name: 'Selskaber', href: '/companies', badgeKey: 'portfolio' },
      { name: 'Kontrakter', href: '/contracts', badgeKey: 'contracts' },
      { name: 'Sager', href: '/cases', badgeKey: 'cases' },
      { name: 'Opgaver', href: '/tasks', badgeKey: 'tasks' },
    ],
  },
  {
    label: 'Ressourcer',
    items: [
      { name: 'Dokumenter', href: '/documents', badgeKey: 'documents' },
      { name: 'Personer', href: '/persons', badgeKey: 'persons' },
      { name: 'Indstillinger', href: '/settings' },
    ],
  },
]

export interface BSidebarProps {
  badges: Record<string, SidebarBadge | null>
  alertCount?: number
}

export function BSidebar({ badges, alertCount = 0 }: BSidebarProps) {
  const pathname = usePathname() ?? ''
  const { data: session } = useSession()
  const userName = session?.user?.name ?? session?.user?.email ?? null

  return (
    <aside className="sticky top-0 flex h-screen w-[220px] shrink-0 flex-col overflow-y-auto border-r border-b-border bg-b-sidebar px-2 py-3.5 text-[13px]">
      <div className="flex items-center justify-between px-2.5 pb-3.5 pt-1">
        <BrandMark withText />
        <NotificationBell count={alertCount} />
      </div>

      <div className="flex-1">
        {SECTIONS.map((section) => (
          <div key={section.label} className="mb-4">
            <div
              className="px-2.5 pb-1 text-[10px] font-semibold uppercase text-b-2"
              style={{ letterSpacing: '0.5px' }}
            >
              {section.label}
            </div>
            <ul className="space-y-px">
              {section.items.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
                const badge = item.badgeKey ? (badges[item.badgeKey] ?? null) : null

                return (
                  <li key={item.name}>
                    <Link
                      href={item.href}
                      className={cn(
                        'flex items-center justify-between rounded-[4px] px-2.5 py-1 text-b-1 no-underline transition-colors',
                        isActive ? 'bg-[#e8eaee] font-medium' : 'hover:bg-[#ecedf0]'
                      )}
                    >
                      <span>{item.name}</span>
                      {badge && badge.count > 0 && (
                        <span
                          className={cn(
                            'b-tnum text-[11px]',
                            badge.urgency === 'critical'
                              ? 'font-semibold text-[#b91c1c]'
                              : 'text-b-2'
                          )}
                        >
                          {badge.count}
                        </span>
                      )}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </div>

      {userName && (
        <div className="mt-2 border-t border-b-border pt-3">
          <div
            className="px-2.5 pb-1.5 text-[10px] font-semibold uppercase text-b-2"
            style={{ letterSpacing: '0.5px' }}
          >
            Konto
          </div>
          <div className="truncate px-2.5 pb-2 text-[12px] text-b-1" title={userName}>
            {userName}
          </div>
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="flex w-full items-center gap-2 rounded-[4px] px-2.5 py-1 text-left text-b-1 hover:bg-[#ecedf0]"
          >
            <LogOut className="h-3.5 w-3.5" aria-hidden />
            <span>Log ud</span>
          </button>
        </div>
      )}
    </aside>
  )
}
