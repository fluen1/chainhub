'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

interface Tab {
  label: string
  href: string
  exact?: boolean
}

interface CompanyTabsProps {
  companyId: string
}

export function CompanyTabs({ companyId }: CompanyTabsProps) {
  const pathname = usePathname()

  // Ny tab-rækkefølge — Overblik som default (DEC-F0 spec §0.5)
  const tabs: Tab[] = [
    { label: 'Overblik', href: `/companies/${companyId}/overview`, exact: true },
    { label: 'Stamdata', href: `/companies/${companyId}/stamdata`, exact: true },
    { label: 'Kontrakter', href: `/companies/${companyId}/contracts` },
    { label: 'Sager', href: `/companies/${companyId}/cases` },
    { label: 'Ansatte', href: `/companies/${companyId}/employees` },
    { label: 'Ejerskab', href: `/companies/${companyId}/ownership` },
    { label: 'Governance', href: `/companies/${companyId}/governance` },
    { label: 'Økonomi', href: `/companies/${companyId}/finance` },
    { label: 'Dokumenter', href: `/companies/${companyId}/documents` },
    { label: 'Aktivitetslog', href: `/companies/${companyId}/log` },
  ]

  return (
    <div className="border-b border-gray-200">
      <nav className="-mb-px flex space-x-1 overflow-x-auto" aria-label="Faner">
        {tabs.map((tab) => {
          const isActive = tab.exact
            ? pathname === tab.href
            : pathname.startsWith(tab.href)

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                'whitespace-nowrap border-b-2 px-3 py-4 text-sm font-medium transition-colors',
                isActive
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
              )}
            >
              {tab.label}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
