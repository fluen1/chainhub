'use client'

import { useRouter } from 'next/navigation'
import { Search } from 'lucide-react'
import { useState, useRef, useTransition } from 'react'

export function Header() {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [, startTransition] = useTransition()
  const inputRef = useRef<HTMLInputElement>(null)

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    const q = query.trim()
    if (q.length >= 2) {
      startTransition(() => {
        router.push(`/search?q=${encodeURIComponent(q)}`)
      })
    }
  }

  return (
    <header className="flex h-16 items-center justify-between border-b bg-white px-6 gap-4">
      {/* Global søgning */}
      <form onSubmit={handleSearch} className="flex-1 max-w-md">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Søg selskaber, kontrakter, sager, personer..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded-md border border-gray-200 bg-gray-50 py-2 pl-9 pr-4 text-sm placeholder:text-gray-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      </form>

      {/* Højre side — kan udvides med notifikationer */}
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-xs text-gray-400">Tryk Enter for at søge</span>
      </div>
    </header>
  )
}
