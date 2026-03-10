'use client'

import { useSession } from 'next-auth/react'
import { Bell } from 'lucide-react'

export function Header() {
  const { data: session } = useSession()

  return (
    <header className="flex h-16 items-center justify-between border-b bg-white px-6">
      <div />
      <div className="flex items-center gap-4">
        <button className="relative rounded-md p-2 text-gray-400 hover:text-gray-600">
          <Bell className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-medium">
            {session?.user?.name?.charAt(0)?.toUpperCase() || '?'}
          </div>
          <span className="text-sm font-medium text-gray-700">
            {session?.user?.name || 'Bruger'}
          </span>
        </div>
      </div>
    </header>
  )
}
