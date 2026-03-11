'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { Search, X, SlidersHorizontal } from 'lucide-react'
import { useCallback, useTransition } from 'react'
import { cn } from '@/lib/utils'

interface FilterOption {
  value: string
  label: string
}

interface FilterConfig {
  key: string
  label: string
  options: FilterOption[]
}

interface SearchAndFilterProps {
  placeholder?: string
  filters?: FilterConfig[]
  className?: string
}

export function SearchAndFilter({
  placeholder = 'Søg...',
  filters = [],
  className,
}: SearchAndFilterProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const currentSearch = searchParams.get('q') ?? ''

  function updateParam(key: string, value: string) {
    startTransition(() => {
      const params = new URLSearchParams(searchParams.toString())
      if (value) {
        params.set(key, value)
      } else {
        params.delete(key)
      }
      params.delete('page') // reset pagination ved søgning/filtrering
      router.push(`${pathname}?${params.toString()}`)
    })
  }

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value
      // Debounce via timeout
      const timer = setTimeout(() => updateParam('q', value), 300)
      return () => clearTimeout(timer)
    },
    [searchParams, pathname] // eslint-disable-line react-hooks/exhaustive-deps
  )

  function clearSearch() {
    updateParam('q', '')
  }

  return (
    <div className={cn('flex flex-col gap-3 sm:flex-row sm:items-center', className)}>
      {/* Søgefelt */}
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder={placeholder}
          defaultValue={currentSearch}
          onChange={handleSearchChange}
          className={cn(
            'w-full rounded-md border border-gray-200 bg-white py-2 pl-9 pr-8 text-sm',
            'placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500',
            isPending && 'opacity-60'
          )}
        />
        {currentSearch && (
          <button
            onClick={clearSearch}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Filtre */}
      {filters.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <SlidersHorizontal className="h-4 w-4 text-gray-400 shrink-0" />
          {filters.map((filter) => {
            const currentValue = searchParams.get(filter.key) ?? ''
            return (
              <select
                key={filter.key}
                value={currentValue}
                onChange={(e) => updateParam(filter.key, e.target.value)}
                className="rounded-md border border-gray-200 bg-white py-2 pl-3 pr-8 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                aria-label={filter.label}
              >
                <option value="">{filter.label}: Alle</option>
                {filter.options.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            )
          })}
        </div>
      )}
    </div>
  )
}

/**
 * Server-side: parse search/filter params fra URL
 */
export function parseSearchParams(params: Record<string, string | undefined>) {
  return {
    q: params.q ?? '',
    page: Math.max(1, parseInt(params.page ?? '1', 10) || 1),
  }
}
