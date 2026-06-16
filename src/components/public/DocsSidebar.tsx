'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { DOCS_NAV } from '@/lib/docs-nav'
import { cn } from '@/lib/utils'

export function DocsSidebar() {
  const pathname = usePathname()
  return (
    <nav aria-label="Dokumentation" className="text-[13px]">
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-b-3">
        Dokumentation
      </p>
      <ul className="flex flex-col gap-0.5">
        {DOCS_NAV.map((item) => {
          const active = pathname === item.href
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'block rounded-[4px] px-2.5 py-1.5 no-underline',
                  active
                    ? 'bg-b-panel-h font-medium text-b-1'
                    : 'text-b-2 hover:bg-b-panel-h hover:text-b-1'
                )}
              >
                {item.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
