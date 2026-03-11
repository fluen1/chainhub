'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface PaginationProps {
  currentPage: number
  totalCount: number
  pageSize?: number
  className?: string
}

export function Pagination({
  currentPage,
  totalCount,
  pageSize = 20,
  className,
}: PaginationProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const totalPages = Math.ceil(totalCount / pageSize)
  const from = (currentPage - 1) * pageSize + 1
  const to = Math.min(currentPage * pageSize, totalCount)

  function goToPage(page: number) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('page', String(page))
    router.push(`${pathname}?${params.toString()}`)
  }

  if (totalPages <= 1) {
    return (
      <div className={cn('flex items-center text-xs text-gray-500', className)}>
        Viser {totalCount} {totalCount === 1 ? 'resultat' : 'resultater'}
      </div>
    )
  }

  // Generer sidetal med ellipsis
  function getPageNumbers(): (number | 'ellipsis')[] {
    const pages: (number | 'ellipsis')[] = []
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i)
    } else {
      pages.push(1)
      if (currentPage > 3) pages.push('ellipsis')
      const start = Math.max(2, currentPage - 1)
      const end = Math.min(totalPages - 1, currentPage + 1)
      for (let i = start; i <= end; i++) pages.push(i)
      if (currentPage < totalPages - 2) pages.push('ellipsis')
      pages.push(totalPages)
    }
    return pages
  }

  return (
    <div className={cn('flex items-center justify-between', className)}>
      <p className="text-xs text-gray-500">
        Viser {from}–{to} af {totalCount}
      </p>
      <nav className="flex items-center gap-1">
        <button
          onClick={() => goToPage(currentPage - 1)}
          disabled={currentPage === 1}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
          aria-label="Forrige side"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        {getPageNumbers().map((page, i) =>
          page === 'ellipsis' ? (
            <span key={`ellipsis-${i}`} className="px-1 text-gray-400 text-sm">
              …
            </span>
          ) : (
            <button
              key={page}
              onClick={() => goToPage(page)}
              className={cn(
                'inline-flex h-8 min-w-8 items-center justify-center rounded-md border px-2 text-sm',
                page === currentPage
                  ? 'border-blue-600 bg-blue-600 text-white font-medium'
                  : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
              )}
            >
              {page}
            </button>
          )
        )}

        <button
          onClick={() => goToPage(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
          aria-label="Næste side"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </nav>
    </div>
  )
}

/**
 * Server-side pagination utility
 * Brug i Server Components til at parse page-param og returnere slice-args
 */
export function parsePaginationParams(
  searchParamsPage: string | undefined,
  pageSize = 20
): { page: number; skip: number; take: number } {
  const page = Math.max(1, parseInt(searchParamsPage ?? '1', 10) || 1)
  return {
    page,
    skip: (page - 1) * pageSize,
    take: pageSize,
  }
}
