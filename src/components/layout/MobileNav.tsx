'use client'

import { useState } from 'react'
import { Menu, X } from 'lucide-react'
import { Sidebar } from './sidebar'
import type { SidebarData } from '@/lib/sidebar-data'

interface MobileNavProps {
  data: SidebarData
  userName: string
}

export function MobileNav({ data, userName }: MobileNavProps) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      {/* Hamburger-knap — kun synlig på mobil/tablet */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed top-4 left-4 z-50 lg:hidden rounded-md bg-gray-900 p-2 text-white shadow-lg"
        aria-label="Åbn menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Overlay */}
      {isOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setIsOpen(false)}
          />
          {/* Sidebar med luk-knap */}
          <div className="relative z-50 h-full w-64">
            <button
              onClick={() => setIsOpen(false)}
              className="absolute top-4 right-3 z-50 rounded-md p-1 text-gray-400 hover:text-white"
              aria-label="Luk menu"
            >
              <X className="h-5 w-5" />
            </button>
            <Sidebar
              data={data}
              userName={userName}
              onNavigate={() => setIsOpen(false)}
            />
          </div>
        </div>
      )}
    </>
  )
}
