'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Building2,
  FileText,
  CheckSquare,
  FolderOpen,
  Search,
  Settings,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { usePrototype } from '@/components/prototype/PrototypeProvider'
import { getSidebarBadge } from '@/mock/helpers'

const SIDEBAR_DATA = {
  expiringContracts: 4,
  underperforming: 2,
  overdueTasks: 6,
  processingDocs: 2,
}

export function PrototypeSidebar() {
  const pathname = usePathname()
  const { activeUser } = usePrototype()

  const role = activeUser.role

  const badgeData = {
    criticalCount: SIDEBAR_DATA.underperforming,
    warningCount: SIDEBAR_DATA.underperforming,
    overdueTaskCount: SIDEBAR_DATA.overdueTasks,
    awaitingDocCount: SIDEBAR_DATA.processingDocs,
    expiringContractCount: SIDEBAR_DATA.expiringContracts,
  }

  const navigation = [
    { name: 'Overblik', href: '/proto/dashboard', icon: LayoutDashboard, badgeKey: 'dashboard' },
    { name: 'Portefølje', href: '/proto/portfolio', icon: Building2, badgeKey: 'portfolio' },
    { name: 'Kontrakter', href: '/proto/contracts', icon: FileText, badgeKey: 'contracts' },
    { name: 'Opgaver', href: '/proto/tasks', icon: CheckSquare, badgeKey: 'tasks' },
    { name: 'Dokumenter', href: '/proto/documents', icon: FolderOpen, badgeKey: 'documents' },
    { name: 'Søg & Spørg', href: '/proto/search', icon: Search, badgeKey: 'search' },
  ]

  const initials = activeUser.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  return (
    <div className="flex h-full w-64 flex-col bg-slate-950">
      {/* Logo */}
      <div className="flex h-16 items-center border-b border-slate-800 px-6">
        <Link href="/proto/dashboard" className="text-xl font-bold tracking-tight text-white">
          ChainHub
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
        {navigation.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + '/')
          const badge = getSidebarBadge(item.badgeKey, role, badgeData)

          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'flex items-center justify-between rounded-md px-3 py-2 text-sm font-medium transition-all duration-150',
                isActive
                  ? 'bg-slate-800/60 backdrop-blur-sm text-white'
                  : 'text-slate-300 hover:bg-slate-800/40 hover:text-white'
              )}
            >
              <span className="flex items-center gap-3">
                <item.icon className="h-5 w-5 shrink-0" />
                {item.name}
              </span>
              {badge !== null && badge.count > 0 && (
                <span
                  className={cn(
                    'inline-flex min-w-[1.25rem] items-center justify-center rounded-full px-2 py-0.5 text-xs font-bold',
                    badge.urgency === 'critical'
                      ? 'bg-red-500 text-white'
                      : 'bg-yellow-500 text-white'
                  )}
                >
                  {badge.count}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* Bund: indstillinger + bruger */}
      <div className="border-t border-slate-800 px-3 py-3 space-y-1">
        <Link
          href="/proto/settings"
          className={cn(
            'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-all duration-150',
            pathname.startsWith('/proto/settings')
              ? 'bg-slate-800/60 backdrop-blur-sm text-white'
              : 'text-slate-300 hover:bg-slate-800/40 hover:text-white'
          )}
        >
          <Settings className="h-5 w-5 shrink-0" />
          Indstillinger
        </Link>

        {/* Bruger-info */}
        <div className="mt-2 flex items-center gap-3 rounded-md px-3 py-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-600 text-xs font-bold text-white">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-slate-200">{activeUser.name}</p>
            <span className="mt-0.5 inline-flex items-center rounded-full bg-slate-800 px-1.5 py-0.5 text-xs text-slate-400">
              {activeUser.roleLabel}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
