'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { List, LayoutGrid } from 'lucide-react'
import { cn } from '@/lib/utils'

export function GroupToggle() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const view = searchParams.get('view') ?? 'grouped'

  function setView(v: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('view', v)
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <div className="flex items-center rounded-md border border-gray-200 bg-white">
      <button
        onClick={() => setView('flat')}
        className={cn(
          'flex items-center gap-1.5 px-4 py-2.5 md:px-3 md:py-1.5 text-xs font-medium rounded-l-md',
          view === 'flat' ? 'bg-blue-50 text-blue-700' : 'text-gray-500 hover:bg-gray-50'
        )}
      >
        <List className="h-3.5 w-3.5" />
        Flat
      </button>
      <button
        onClick={() => setView('grouped')}
        className={cn(
          'flex items-center gap-1.5 px-4 py-2.5 md:px-3 md:py-1.5 text-xs font-medium rounded-r-md border-l border-gray-200',
          view === 'grouped' ? 'bg-blue-50 text-blue-700' : 'text-gray-500 hover:bg-gray-50'
        )}
      >
        <LayoutGrid className="h-3.5 w-3.5" />
        Grupperet
      </button>
    </div>
  )
}
