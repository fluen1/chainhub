'use client'

interface PortfolioPaginationProps {
  currentPage: number
  totalPages: number
  total: number
  pageSize: number
  onPageChange: (page: number) => void
}

export function PortfolioPagination({
  currentPage,
  totalPages,
  total,
  pageSize,
  onPageChange,
}: PortfolioPaginationProps) {
  const from = (currentPage - 1) * pageSize + 1
  const to = Math.min(currentPage * pageSize, total)

  return (
    <div className="flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3 sm:px-6 rounded-b-xl">
      <div className="hidden sm:block">
        <p className="text-sm text-gray-700">
          Viser <span className="font-medium">{from}</span>–
          <span className="font-medium">{to}</span> af{' '}
          <span className="font-medium">{total}</span> selskaber
        </p>
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          className="relative inline-flex items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Forrige
        </button>
        <span className="flex items-center px-3 text-sm text-gray-700">
          Side {currentPage} af {totalPages}
        </span>
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
          className="relative inline-flex items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Næste
        </button>
      </div>
    </div>
  )
}