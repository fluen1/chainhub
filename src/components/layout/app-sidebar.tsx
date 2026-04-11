'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Building2,
  FileText,
  CheckSquare,
  FolderOpen,
  Settings,
  Calendar,
  Users,
  Briefcase,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { SidebarBadge, NavSection } from '@/types/ui'

const ICON_MAP = {
  LayoutDashboard,
  Building2,
  FileText,
  CheckSquare,
  FolderOpen,
  Calendar,
  Users,
  Briefcase,
} as const

const SECTIONS: NavSection[] = [
  {
    label: 'Overblik',
    items: [
      { name: 'Dashboard', href: '/dashboard', iconName: 'LayoutDashboard', badgeKey: 'dashboard' },
      { name: 'Kalender',  href: '/calendar',  iconName: 'Calendar',        badgeKey: 'calendar' },
    ],
  },
  {
    label: 'Portefølje',
    items: [
      { name: 'Selskaber',  href: '/companies', iconName: 'Building2',   badgeKey: 'portfolio' },
      { name: 'Kontrakter', href: '/contracts', iconName: 'FileText',    badgeKey: 'contracts' },
      { name: 'Sager',      href: '/cases',     iconName: 'Briefcase',   badgeKey: 'cases' },
      { name: 'Opgaver',    href: '/tasks',     iconName: 'CheckSquare', badgeKey: 'tasks' },
    ],
  },
  {
    label: 'Ressourcer',
    items: [
      { name: 'Dokumenter', href: '/documents', iconName: 'FolderOpen', badgeKey: 'documents' },
      { name: 'Personer',   href: '/persons',   iconName: 'Users',      badgeKey: 'persons' },
    ],
  },
]

export interface AppSidebarProps {
  userName: string
  userRoleLabel: string
  badges: Record<string, SidebarBadge | null>
}

export function AppSidebar({ userName, userRoleLabel, badges }: AppSidebarProps) {
  const pathname = usePathname() ?? ''

  const initials = userName.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)

  return (
    <div className="flex h-full w-60 flex-col bg-[#0f172a]">
      {/* Logo */}
      <div className="flex h-16 items-center gap-2.5 border-b border-white/[0.07] px-5">
        <div className="h-2 w-2 rounded-full bg-blue-500" />
        <Link href="/dashboard" className="text-lg font-bold text-white no-underline">
          ChainHub
        </Link>
      </div>

      {/* Navigation sections */}
      <nav className="flex-1 overflow-y-auto px-4 py-4">
        {SECTIONS.map((section) => (
          <div key={section.label} className="mb-5">
            <div className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">
              {section.label}
            </div>
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const Icon = ICON_MAP[item.iconName]
                const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
                const badge = badges[item.badgeKey] ?? null

                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={cn(
                      'flex items-center justify-between rounded-lg px-3 py-2 text-[13px] font-medium transition-all duration-150 no-underline',
                      isActive
                        ? 'bg-blue-500/[0.12] text-white'
                        : 'text-slate-400 hover:bg-white/[0.05] hover:text-slate-200'
                    )}
                  >
                    <span className="flex items-center gap-2.5">
                      <Icon className={cn('h-[18px] w-[18px]', isActive ? 'text-blue-400' : '')} />
                      {item.name}
                    </span>
                    {badge && badge.count > 0 && (
                      <span
                        className={cn(
                          'inline-flex min-w-[1.25rem] items-center justify-center rounded-full px-1.5 py-0.5 text-[11px] font-semibold',
                          badge.urgency === 'critical'
                            ? 'bg-red-500/[0.15] text-red-400'
                            : 'bg-white/[0.08] text-slate-400'
                        )}
                      >
                        {badge.count}
                      </span>
                    )}
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Bottom: settings + user */}
      <div className="border-t border-white/[0.07] px-4 py-3 space-y-1">
        <Link
          href="/settings"
          className={cn(
            'flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium transition-all duration-150 no-underline',
            pathname.startsWith('/settings')
              ? 'bg-blue-500/[0.12] text-white'
              : 'text-slate-400 hover:bg-white/[0.05] hover:text-slate-200'
          )}
        >
          <Settings className="h-[18px] w-[18px]" />
          Indstillinger
        </Link>

        <div className="mt-2 flex items-center gap-3 rounded-lg px-3 py-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-700 text-xs font-bold text-white">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-slate-200">{userName}</p>
            <span className="mt-0.5 inline-flex items-center rounded-md bg-white/[0.08] px-1.5 py-0.5 text-[10px] text-slate-400">
              {userRoleLabel}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
