'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Menu,
  X,
  LayoutDashboard,
  Building2,
  FileText,
  CheckSquare,
  FolderOpen,
  Settings,
  Calendar,
  Users,
  Briefcase,
  Search,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  { name: 'Søg', href: '/search', icon: Search },
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Kalender', href: '/calendar', icon: Calendar },
  { name: 'Selskaber', href: '/companies', icon: Building2 },
  { name: 'Kontrakter', href: '/contracts', icon: FileText },
  { name: 'Sager', href: '/cases', icon: Briefcase },
  { name: 'Opgaver', href: '/tasks', icon: CheckSquare },
  { name: 'Dokumenter', href: '/documents', icon: FolderOpen },
  { name: 'Personer', href: '/persons', icon: Users },
  { name: 'Indstillinger', href: '/settings', icon: Settings },
]

export function MobileNav() {
  const [open, setOpen] = useState(false)
  const pathname = usePathname() ?? ''

  return (
    <div className="lg:hidden">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 transition-colors"
        aria-label="Åbn menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div
            role="button"
            tabIndex={0}
            aria-label="Luk menu"
            className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
            onClick={() => setOpen(false)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') {
                e.preventDefault()
                setOpen(false)
              }
            }}
          />

          {/* Drawer */}
          <div className="fixed inset-y-0 left-0 z-50 w-64 bg-[#0f172a] shadow-xl">
            <div className="flex h-14 items-center justify-between px-5 border-b border-white/[0.07]">
              <span className="text-lg font-bold text-white">ChainHub</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-slate-400 hover:text-white transition-colors"
                aria-label="Luk menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <nav className="px-3 py-4 space-y-1">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon
                const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors no-underline',
                      isActive
                        ? 'bg-blue-500/[0.12] text-white'
                        : 'text-slate-400 hover:bg-white/[0.05] hover:text-slate-200'
                    )}
                  >
                    <Icon className={cn('h-[18px] w-[18px]', isActive && 'text-blue-400')} />
                    {item.name}
                  </Link>
                )
              })}
            </nav>
          </div>
        </>
      )}
    </div>
  )
}
