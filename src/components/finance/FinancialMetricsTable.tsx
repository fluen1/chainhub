'use client'

import { useState } from 'react'
import { MetricType, PeriodType, MetricSource, type FinancialMetric } from '@prisma/client'
import { METRIC_TYPE_LABELS, PERIOD_TYPE_LABELS, METRIC_SOURCE_LABELS } from '@/types/finance'
import { cn } from '@/lib/utils'

interface FinancialMetricsTableProps {
  metrics: FinancialMetric[]
  onEdit?: (metric: FinancialMetric) => void
  onDelete?: (metric: FinancialMetric) => void
  className?: string
}

function formatCurrency(value: number | string, currency: string): string {
  const num = typeof value === 'string' ? parseFloat(value) : value
  return new Intl.NumberFormat('da-DK', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num)
}

export function FinancialMetricsTable({
  metrics,
  onEdit,
  onDelete,
  className,
}: FinancialMetricsTableProps) {
  const [selectedYear, setSelectedYear] = useState<number | 'alle'>('alle')

  const availableYears = [...new Set(metrics.map((m) => m.periodYear))].sort((a, b) => b - a)

  const filtered =
    selectedYear === 'alle' ? metrics : metrics.filter((m) => m.periodYear === selectedYear)

  if (metrics.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <p className="font-medium">Ingen nøgletal endnu</p>
        <p className="text-sm mt-1">Tilføj det første nøgletal for dette selskab</p>
      </div>
    )
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* Årsfilter */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm font-medium text-gray-600">Vis år:</span>
        <button
          onClick={() => setSelectedYear('alle')}
          className={cn(
            'px-3 py-1 rounded-full text-sm font-medium transition-colors',
            selectedYear === 'alle'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          )}
        >
          Alle
        </button>
        {availableYears.map((year) => (
          <button
            key={year}
            onClick={() => setSelectedYear(year)}
            className={cn(
              'px-3 py-1 rounded-full text-sm font-medium transition-colors',
              selectedYear === year
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            )}
          >
            {year}
          </button>
        ))}
      </div>

      {/* Tabel */}
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Nøgletal
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Periode
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Værdi
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Kilde
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Noter
              </th>
              {(onEdit || onDelete) && (
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Handlinger
                </th>
              )}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filtered.map((metric) => (
              <tr key={metric.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3">
                  <span className="font-medium text-gray-900">
                    {METRIC_TYPE_LABELS[metric.metricType]}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-700">
                  <span>{PERIOD_TYPE_LABELS[metric.periodType]}</span>
                  <span className="ml-1 text-gray-500">{metric.periodYear}</span>
                </td>
                <td className="px-4 py-3 text-right">
                  <span className="font-mono font-medium text-gray-900">
                    {formatCurrency(metric.value.toString(), metric.currency)}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <MetricSourceBadge source={metric.source} />
                </td>
                <td className="px-4 py-3 text-sm text-gray-500 max-w-xs truncate">
                  {metric.notes ?? '—'}
                </td>
                {(onEdit || onDelete) && (
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      {onEdit && (
                        <button
                          onClick={() => onEdit(metric)}
                          className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                        >
                          Rediger
                        </button>
                      )}
                      {onDelete && (
                        <button
                          onClick={() => onDelete(metric)}
                          className="text-sm text-red-600 hover:text-red-800 font-medium"
                        >
                          Slet
                        </button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-gray-400">
        Viser {filtered.length} af {metrics.length} nøgletal
      </p>
    </div>
  )
}

function MetricSourceBadge({ source }: { source: MetricSource }) {
  const colorMap: Record<MetricSource, string> = {
    REVIDERET: 'bg-green-100 text-green-800',
    UREVIDERET: 'bg-yellow-100 text-yellow-800',
    ESTIMAT: 'bg-gray-100 text-gray-700',
  }
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
        colorMap[source]
      )}
    >
      {METRIC_SOURCE_LABELS[source]}
    </span>
  )
}

// ==================== Skeleton ====================

export function FinancialMetricsTableSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="flex gap-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-7 w-16 bg-gray-200 rounded-full" />
        ))}
      </div>
      <div className="rounded-lg border border-gray-200 overflow-hidden">
        <div className="bg-gray-50 h-10" />
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-12 border-t border-gray-100 bg-white" />
        ))}
      </div>
    </div>
  )
}