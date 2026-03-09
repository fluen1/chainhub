'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useCallback, useTransition } from 'react'
import { cn } from '@/lib/utils'
import type { PortfolioData, PortfolioFilters } from '@/types/portfolio'
import { PortfolioSummaryCards } from './PortfolioSummaryCards'
import { PortfolioFiltersBar } from './PortfolioFiltersBar'
import { PortfolioTable } from './PortfolioTable'
import { PortfolioPagination } from './PortfolioPagination'

interface PortfolioDashboardProps {
  data: PortfolioData
  filters: PortfolioFilters
}

export function PortfolioDashboard({ data, filters }: PortfolioDashboardProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const updateFilter = useCallback(
    (key: string, value: string | undefined) => {
      const params = new URLSearchParams(searchParams.toString())
      if (value === undefined || value === '') {
        params.delete(key)
      } else {
        params.set(key, value)
      }
      // Nulstil side ved filterændring
      if (key !== 'page') {
        params.delete('page')
      }
      startTransition(() => {
        router.push(`${pathname}?${params.toString()}`)
      })
    },
    [router, pathname, searchParams]
  )

  const handlePageChange = useCallback(
    (page: number) => {
      updateFilter('page', String(page))
    },
    [updateFilter]
  )

  return (
    <div className={cn('flex flex-col gap-6', isPending && 'opacity-70 pointer-events-none')}>
      {/* Summary cards */}
      <PortfolioSummaryCards summary={data.summary} />

      {/* Filter bar */}
      <PortfolioFiltersBar filters={filters} onFilterChange={updateFilter} />

      {/* Tabel */}
      <PortfolioTable companies={data.companies} />

      {/* Pagination */}
      {data.totalPages > 1 && (
        <PortfolioPagination
          currentPage={data.page}
          totalPages={data.totalPages}
          total={data.total}
          pageSize={data.pageSize}
          onPageChange={handlePageChange}
        />
      )}

      {data.companies.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-gray-500">
          <p className="text-base font-medium">Ingen selskaber matcher filteret</p>
          <p className="mt-1 text-sm">Prøv at ændre eller nulstille filtrene</p>
        </div>
      )}
    </div>
  )
}