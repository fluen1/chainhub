'use client'

import { useState, useTransition } from 'react'
import type { DividendWithCompany } from '@/types/finance'
import { deleteDividend } from '@/actions/finance'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface DividendListProps {
  dividends: DividendWithCompany[]
  onAddNew?: () => void
  onEdit?: (dividend: DividendWithCompany) => void
  className?: string
}

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat('da-DK', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('da-DK', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(date))
}

export function DividendList({ dividends, onAddNew, onEdit, className }: DividendListProps) {
  const [isPending, startTransition] = useTransition()
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const totalDividends = dividends.reduce((sum, d) => sum + d.amount, 0)

  function handleDelete(dividend: DividendWithCompany) {
    if (
      !confirm(
        `Vil du slette udbytteotering på ${formatCurrency(dividend.amount, dividend.currency)} fra ${formatDate(dividend.dividendDate)}?`
      )
    ) {
      return
    }
    setDeletingId(dividend.id)
    startTransition(async () => {
      const result = await deleteDividend({
        dividendId: dividend.id,
        companyId: dividend.companyId,
      })
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('Udbytteotering slettet')
      }
      setDeletingId(null)
    })
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* Total */}
      {dividends.length > 0 && (
        <div className="bg-amber-50 rounded-lg p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-amber-600 uppercase tracking-wide">
              Samlet udbytte
            </p>
            <p className="text-2xl font-bold text-amber-900 mt-0.5">
              {formatCurrency(totalDividends, 'DKK')}
            </p>
          </div>
          <p className="text-sm text-amber-700">{dividends.length} otering(er)</p>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-gray-900">Udbytteoteringer</h3>
        {onAddNew && (
          <button
            onClick={onAddNew}
            className="text-sm font-medium text-blue-600 hover:text-blue-800"
          >
            + Tilføj udbytte
          </button>
        )}
      </div>

      {/* Liste */}
      {dividends.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p className="font-medium">Ingen udbytteoteringer endnu</p>
          <p className="text-sm mt-1">Tilføj den første udbytteotering for dette selskab</p>
        </div>
      ) : (
        <div className="space-y-2">
          {dividends.map((dividend) => (
            <div
              key={dividend.id}
              className={cn(
                'flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3 transition-opacity',
                deletingId === dividend.id ? 'opacity-50' : ''
              )}
            >
              <div>
                <div className="flex items-center gap-3">
                  <span className="text-xl font-bold text-gray-900">
                    {formatCurrency(dividend.amount, dividend.currency)}
                  </span>
                  <span className="text-sm text-gray-500">{dividend.company.name}</span>
                </div>
                <p className="text-sm text-gray-500 mt-0.5">
                  Udloddet {formatDate(dividend.dividendDate)}
                </p>
                {dividend.notes && (
                  <p className="text-xs text-gray-400 mt-0.5">{dividend.notes}</p>
                )}
              </div>

              <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                {onEdit && (
                  <button
                    onClick={() => onEdit(dividend)}
                    disabled={isPending}
                    className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                  >
                    Rediger
                  </button>
                )}
                <button
                  onClick={() => handleDelete(dividend)}
                  disabled={isPending}
                  className="text-sm text-red-600 hover:text-red-800 font-medium"
                >
                  Slet
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function DividendListSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-20 rounded-lg bg-amber-50" />
      <div className="space-y-2">
        {[1, 2].map((i) => (
          <div key={i} className="h-16 rounded-lg border border-gray-200 bg-white" />
        ))}
      </div>
    </div>
  )
}