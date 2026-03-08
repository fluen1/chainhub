'use client'

import { useState } from 'react'
import { signOut } from 'next-auth/react'
import { Bell, ChevronDown, LogOut, User, Search } from 'lucide-react'
import { cn } from '@/lib/utils'

interface HeaderProps {
  user?: {
    name?: string | null
    email?: string | null
    image?: string | null
  }
}

export function Header({ user }: HeaderProps) {
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false)

  const handleLogout = async () => {
    await signOut({ callbackUrl: '/login' })
  }

  const displayName = user?.name || user?.email || 'Bruger'
  const initials = displayName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-gray-200 bg-white px-6">
      {/* Search */}
      <div className="flex flex-1 items-center">
        <div className="relative w-full max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Søg efter selskaber, kontrakter, personer..."
            className="h-10 w-full rounded-lg border border-gray-300 bg-gray-50 pl-10 pr-4 text-sm text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-4">
        {/* Notifications */}
        <button
          type="button"
          className="relative rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
          aria-label="Notifikationer"
        >
          <Bell className="h-5 w-5" />
          <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-red-500" />
        </button>

        {/* User menu */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
            className="flex items-center gap-2 rounded-lg p-2 hover:bg-gray-100"
          >
            {user?.image ? (
              <img
                src={user.image}
                alt={displayName}
                className="h-8 w-8 rounded-full"
              />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-sm font-medium text-white">
                {initials}
              </div>
            )}
            <span className="hidden text-sm font-medium text-gray-700 md:block">
              {displayName}
            </span>
            <ChevronDown
              className={cn(
                'h-4 w-4 text-gray-500 transition-transform',
                isUserMenuOpen && 'rotate-180'
              )}
            />
          </button>

          {/* Dropdown */}
          {isUserMenuOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setIsUserMenuOpen(false)}
              />
              <div className="absolute right-0 z-50 mt-2 w-56 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                <div className="border-b border-gray-200 px-4 py-3">
                  <p className="text-sm font-medium text-gray-900">{displayName}</p>
                  {user?.email && (
                    <p className="text-sm text-gray-500">{user.email}</p>
                  )}
                </div>
                <div className="py-1">
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    onClick={() => {
                      setIsUserMenuOpen(false)
                      // Navigate to profile - could use router
                    }}
                  >
                    <User className="h-4 w-4" />
                    Min profil
                  </button>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="flex w-full items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                  >
                    <LogOut className="h-4 w-4" />
                    Log ud
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  )
}