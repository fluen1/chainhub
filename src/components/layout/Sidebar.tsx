'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  Building2,
  FileText,
  Briefcase,
  CheckSquare,
  Users,
  FolderOpen,
  Wallet,
  Settings,
} from 'lucide-react'

const navigationItems = [
  {
    title: 'Overblik',
    href: '/dashboard',
    icon: LayoutDashboard,
  },
  {
    title: 'Selskaber',
    href: '/dashboard/companies',
    icon: Building2,
  },
  {
    title: 'Kontrakter',
    href: '/dashboard/contracts',
    icon: FileText,
  },
  {
    title: 'Sager',
    href: '/dashboard/cases',
    icon: Briefcase,
  },
  {
    title: 'Opgaver',
    href: '/dashboard/tasks',
    icon: CheckSquare,
  },
  {
    title: 'Personer',
    href: '/dashboard/persons',
    icon: Users,
  },
  {
    title: 'Dokumenter',
    href: '/dashboard/documents',
    icon: FolderOpen,
  },
  {
    title: 'Økonomi',
    href: '/dashboard/finance',
    icon: Wallet,
  },
]

const settingsItem = {
  title: 'Indstillinger',
  href: '/dashboard/settings',
  icon: Settings,
}

export function Sidebar() {
  const pathname = usePathname()

  const isActive = (href: string) => {
    if (href === '/dashboard') {
      return pathname === '/dashboard'
    }
    return pathname.startsWith(href)
  }

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 border-r border-gray-200 bg-white">
      <div className="flex h-full flex-col">
        {/* Logo */}
        <div className="flex h-16 items-center border-b border-gray-200 px-6">
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
              <span className="text-sm font-bold text-white">CH</span>
            </div>
            <span className="text-xl font-semibold text-gray-900">ChainHub</span>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {navigationItems.map((item) => {
            const Icon = item.icon
            const active = isActive(item.href)

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  active
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                )}
              >
                <Icon className={cn('h-5 w-5', active ? 'text-blue-700' : 'text-gray-400')} />
                {item.title}
              </Link>
            )
          })}

          {/* Separator */}
          <div className="my-4 border-t border-gray-200" />

          {/* Settings */}
          <Link
            href={settingsItem.href}
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              isActive(settingsItem.href)
                ? 'bg-blue-50 text-blue-700'
                : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
            )}
          >
            <settingsItem.icon
              className={cn(
                'h-5 w-5',
                isActive(settingsItem.href) ? 'text-blue-700' : 'text-gray-400'
              )}
            />
            {settingsItem.title}
          </Link>
        </nav>

        {/* Footer */}
        <div className="border-t border-gray-200 p-4">
          <p className="text-xs text-gray-500">© 2024 ChainHub</p>
        </div>
      </div>
    </aside>
  )
}