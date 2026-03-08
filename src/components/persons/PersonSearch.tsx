'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useTransition, useState, useCallback } from 'react'
import { Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { useDebouncedCallback } from 'use-debounce'

interface PersonSearchProps {
  initialQuery?: string
  initialRole?: string
}

const ROLE_OPTIONS = [
  { value: 'all', label: 'Alle roller' },
  { value: 'direktør', label: 'Direktør' },
  { value: 'bestyrelsesmedlem', label: 'Bestyrelsesmedlem' },
  { value: 'ansat', label: 'Ansat' },
  { value: 'revisor', label: 'Revisor' },
  { value: 'advokat', label: 'Advokat' },
  { value: 'anden', label: 'Anden' },
]

export function PersonSearch({ initialQuery, initialRole }: PersonSearchProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const [query, setQuery] = useState(initialQuery || '')

  const updateSearchParams = useCallback(
    (updates: Record<string, string | undefined>) => {
      const params = new URLSearchParams(searchParams.toString())
      
      Object.entries(updates).forEach(([key, value]) => {
        if (value && value !== 'all') {
          params.set(key, value)
        } else {
          params.delete(key)
        }
      })

      startTransition(() => {
        router.push(`/persons?${params.toString()}`)
      })
    },
    [router, searchParams]
  )

  const debouncedSearch = useDebouncedCallback((value: string) => {
    updateSearchParams({ query: value || undefined })
  }, 300)

  const handleQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setQuery(value)
    debouncedSearch(value)
  }

  const handleRoleChange = (value: string) => {
    updateSearchParams({ role: value === 'all' ? undefined : value })
  }

  const clearFilters = () => {
    setQuery('')
    startTransition(() => {
      router.push('/persons')
    })
  }

  const hasFilters = query || initialRole

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="relative flex-1 max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <Input
          placeholder="Søg efter navn, e-mail eller telefon..."
          value={query}
          onChange={handleQueryChange}
          className="pl-9"
        />
        {isPending && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600" />
          </div>
        )}
      </div>

      <Select
        value={initialRole || 'all'}
        onValueChange={handleRoleChange}
      >
        <SelectTrigger className="w-full sm:w-44">
          <SelectValue placeholder="Alle roller" />
        </SelectTrigger>
        <SelectContent>
          {ROLE_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {hasFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={clearFilters}
          className="text-gray-500"
        >
          <X className="mr-1 h-4 w-4" />
          Ryd filtre
        </Button>
      )}
    </div>
  )
}