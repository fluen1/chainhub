'use client'

import { useRouter } from 'next/navigation'
import { Search } from 'lucide-react'
import { useState, useRef, useEffect, useTransition } from 'react'

export function PrototypeHeader() {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [, startTransition] = useTransition()
  const inputRef = useRef<HTMLInputElement>(null)

  // Ctrl+K fokuserer søgefeltet
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.ctrlKey && e.key === 'k') {
        e.preventDefault()
        inputRef.current?.focus()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    const q = query.trim()
    if (q.length >= 1) {
      startTransition(() => {
        router.push(`/proto/search?q=${encodeURIComponent(q)}`)
      })
    }
  }

  return (
    <header className="flex h-16 items-center border-b border-gray-200 bg-white px-6 gap-4">
      {/* Global søgning */}
      <form onSubmit={handleSearch} className="flex-1 max-w-lg">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Søg eller stil et spørgsmål..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-2 pl-9 text-sm placeholder:text-gray-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      </form>

      {/* Ctrl+K hint */}
      <div className="shrink-0">
        <kbd className="rounded border border-gray-200 px-1.5 py-0.5 font-mono text-xs text-gray-400">
          Ctrl+K
        </kbd>
      </div>
    </header>
  )
}
