'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Building2,
  FileText,
  Briefcase,
  CheckSquare,
  Users,
  FolderOpen,
  MapPin,
  Settings,
  LogOut,
  Clock,
} from 'lucide-react'
import { signOut } from 'next-auth/react'
import { cn } from '@/lib/utils'
import type { SidebarData } from '@/lib/sidebar-data'

interface SidebarProps {
  data: SidebarData
  userName: string
  onNavigate?: () => void
}

export function Sidebar({ data, userName, onNavigate }: SidebarProps) {
  const pathname = usePathname()

  const navigation = [
    {
      name: 'Dashboard',
      href: '/dashboard',
      icon: LayoutDashboard,
      count: null,
      urgentCount: null,
    },
    {
      name: 'Selskaber',
      href: '/companies',
      icon: Building2,
      count: data.companiesCount,
      urgentCount: null,
    },
    {
      name: 'Kontrakter',
      href: '/contracts',
      icon: FileText,
      count: data.contractsCount,
      urgentCount: null,
    },
    {
      name: 'Sager',
      href: '/cases',
      icon: Briefcase,
      count: data.casesCount,
      urgentCount: null,
    },
    {
      name: 'Opgaver',
      href: '/tasks',
      icon: CheckSquare,
      count: data.tasksCount,
      urgentCount: data.overdueTasksCount > 0 ? data.overdueTasksCount : null,
    },
    {
      name: 'Personer',
      href: '/persons',
      icon: Users,
      count: data.personsCount,
      urgentCount: null,
    },
    {
      name: 'Dokumenter',
      href: '/documents',
      icon: FolderOpen,
      count: data.documentsCount,
      urgentCount: null,
    },
    {
      name: 'Besøg',
      href: '/visits',
      icon: MapPin,
      count: data.visitsCount,
      urgentCount: null,
    },
  ]

  const initials = userName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  return (
    <div className="flex h-full w-64 flex-col bg-gray-900">
      {/* Logo + organisation */}
      <div className="flex h-16 items-center px-6 border-b border-gray-800">
        <Link href="/dashboard" className="text-xl font-bold text-white">
          ChainHub
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-0.5 px-3 py-4 overflow-y-auto">
        {navigation.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link
              key={item.name}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                'flex items-center justify-between rounded-md px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-gray-800 text-white'
                  : 'text-gray-300 hover:bg-gray-800 hover:text-white'
              )}
            >
              <span className="flex items-center gap-3">
                <item.icon className="h-5 w-5 shrink-0" />
                {item.name}
              </span>
              <span className="flex items-center gap-1.5">
                {item.urgentCount !== null && item.urgentCount > 0 && (
                  <span className="inline-flex items-center justify-center rounded-full bg-red-500 px-1.5 py-0.5 text-xs font-bold text-white min-w-[1.25rem]">
                    {item.urgentCount}
                  </span>
                )}
                {item.count !== null && item.count > 0 && (
                  <span className="inline-flex items-center justify-center rounded-full bg-gray-700 px-1.5 py-0.5 text-xs text-gray-300 min-w-[1.25rem]">
                    {item.count}
                  </span>
                )}
              </span>
            </Link>
          )
        })}

        {/* Senest besøgte selskaber */}
        {data.recentCompanies.length > 0 && (
          <div className="mt-6 px-3">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="h-3.5 w-3.5 text-gray-500" />
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                Senest
              </span>
            </div>
            <div className="space-y-0.5">
              {data.recentCompanies.map((company) => (
                <Link
                  key={company.id}
                  href={`/companies/${company.id}`}
                  onClick={onNavigate}
                  className="block rounded-md px-2 py-1.5 text-xs text-gray-400 hover:bg-gray-800 hover:text-gray-200 truncate transition-colors"
                  title={company.name}
                >
                  {company.name}
                </Link>
              ))}
            </div>
          </div>
        )}
      </nav>

      {/* Bund: indstillinger + bruger */}
      <div className="border-t border-gray-700 px-3 py-3 space-y-1">
        <Link
          href="/settings"
          onClick={onNavigate}
          className={cn(
            'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
            pathname.startsWith('/settings')
              ? 'bg-gray-800 text-white'
              : 'text-gray-300 hover:bg-gray-800 hover:text-white'
          )}
        >
          <Settings className="h-5 w-5 shrink-0" />
          Indstillinger
        </Link>

        {/* Bruger-info */}
        <div className="mt-2 flex items-center gap-3 rounded-md px-3 py-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="truncate text-xs font-medium text-white">{userName}</p>
            <span
              className={cn(
                'inline-flex items-center rounded-full px-1.5 py-0.5 text-xs font-medium mt-0.5',
                data.userRoleStyle
              )}
            >
              {data.userRoleLabel}
            </span>
          </div>
        </div>

        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-gray-300 transition-colors hover:bg-gray-800 hover:text-white"
        >
          <LogOut className="h-5 w-5 shrink-0" />
          Log ud
        </button>
      </div>
    </div>
  )
}
