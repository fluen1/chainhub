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
import { usePrototype } from '@/components/prototype/PrototypeProvider'
import { getSidebarBadge } from '@/mock/helpers'
import { getExpiringContracts } from '@/mock/contracts'
import { getOverdueTasks } from '@/mock/tasks'
import { getDocumentsProcessing } from '@/mock/documents'
import { getCompanies } from '@/mock/companies'
import { getOpenCases } from '@/mock/cases'

interface NavItem {
  name: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  badgeKey: string
}

interface NavSection {
  label: string
  items: NavItem[]
}

export function PrototypeSidebar() {
  const pathname = usePathname()
  const { activeUser, dataScenario } = usePrototype()
  const role = activeUser.role

  const companies = getCompanies(dataScenario)
  const criticalCount = companies.filter((c) => c.healthStatus === 'critical').length
  const warningCount = companies.filter((c) => c.healthStatus === 'warning').length
  const overdueTaskCount = getOverdueTasks().length
  const expiringContractCount = getExpiringContracts(90).length
  const processingDocsCount = getDocumentsProcessing().length
  const openCaseCount = getOpenCases().length

  const badgeData = {
    criticalCount, warningCount, overdueTaskCount,
    awaitingDocCount: processingDocsCount, expiringContractCount, openCaseCount,
  }

  const sections: NavSection[] = [
    {
      label: 'Overblik',
      items: [
        { name: 'Dashboard', href: '/proto/dashboard', icon: LayoutDashboard, badgeKey: 'dashboard' },
        { name: 'Kalender', href: '/proto/calendar', icon: Calendar, badgeKey: 'calendar' },
      ],
    },
    {
      label: 'Portefølje',
      items: [
        { name: 'Selskaber', href: '/proto/portfolio', icon: Building2, badgeKey: 'portfolio' },
        { name: 'Kontrakter', href: '/proto/contracts', icon: FileText, badgeKey: 'contracts' },
        { name: 'Sager', href: '/proto/portfolio', icon: Briefcase, badgeKey: 'cases' },
        { name: 'Opgaver', href: '/proto/tasks', icon: CheckSquare, badgeKey: 'tasks' },
      ],
    },
    {
      label: 'Ressourcer',
      items: [
        { name: 'Dokumenter', href: '/proto/documents', icon: FolderOpen, badgeKey: 'documents' },
        { name: 'Personer', href: '/proto/search', icon: Users, badgeKey: 'persons' },
      ],
    },
  ]

  const initials = activeUser.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)

  return (
    <div className="flex h-full w-60 flex-col bg-[#0f172a]">
      {/* Logo */}
      <div className="flex h-16 items-center gap-2.5 border-b border-white/[0.07] px-5">
        <div className="h-2 w-2 rounded-full bg-blue-500" />
        <Link href="/proto/dashboard" className="text-lg font-bold text-white">
          ChainHub
        </Link>
      </div>

      {/* Navigation sections */}
      <nav className="flex-1 overflow-y-auto px-4 py-4">
        {sections.map((section) => (
          <div key={section.label} className="mb-5">
            <div className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">
              {section.label}
            </div>
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
                const badge = getSidebarBadge(item.badgeKey, role, badgeData)

                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={cn(
                      'flex items-center justify-between rounded-lg px-3 py-2 text-[13px] font-medium transition-all duration-150',
                      isActive
                        ? 'bg-blue-500/[0.12] text-white'
                        : 'text-slate-400 hover:bg-white/[0.05] hover:text-slate-200'
                    )}
                  >
                    <span className="flex items-center gap-2.5">
                      <item.icon className={cn('h-[18px] w-[18px]', isActive ? 'text-blue-400' : '')} />
                      {item.name}
                    </span>
                    {badge !== null && badge.count > 0 && (
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
          href="/proto/settings"
          className={cn(
            'flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium transition-all duration-150',
            pathname.startsWith('/proto/settings')
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
            <p className="truncate text-xs font-medium text-slate-200">{activeUser.name}</p>
            <span className="mt-0.5 inline-flex items-center rounded-md bg-white/[0.08] px-1.5 py-0.5 text-[10px] text-slate-400">
              {activeUser.roleLabel}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
