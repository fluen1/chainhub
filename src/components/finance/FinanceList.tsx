'use client'

import { useState } from 'react'
import { BarChart3, ChevronDown, ChevronRight } from 'lucide-react'
import {
  getMetricTypeLabel,
  getPeriodTypeLabel,
  getMetricSourceLabel,
  getMetricSourceStyle,
} from '@/lib/labels'

interface MetricData {
  id: string
  metric_type: string
  period_type: string
  period_year: number
  value: number | string | { toNumber?: () => number }
  source: string
  notes: string | null
}

interface FinanceListProps {
  metrics: MetricData[]
  years: number[]
  addButton?: React.ReactNode
}

function formatCurrency(value: number | string | { toNumber?: () => number }): string {
  const num =
    typeof value === 'object' && value !== null && 'toNumber' in value
      ? (value as { toNumber: () => number }).toNumber()
      : Number(value)
  return num.toLocaleString('da-DK', {
    style: 'currency',
    currency: 'DKK',
    maximumFractionDigits: 0,
  })
}

function CollapsibleYear({
  year,
  metrics,
  defaultOpen,
}: {
  year: number
  metrics: MetricData[]
  defaultOpen: boolean
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <div>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center gap-2 py-2 border-b border-gray-200 hover:bg-gray-50/50 transition-colors"
      >
        {isOpen ? (
          <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-gray-400" />
        )}
        <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
          {year}
        </span>
        <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">
          {metrics.length}
        </span>
      </button>
      {isOpen && (
        <div className="border-l border-gray-200">
          {metrics.map((m) => (
            <div
              key={m.id}
              className="flex items-center justify-between px-3 py-2.5 border-b border-gray-100 hover:bg-gray-50/50 transition-colors"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-900">
                  {getMetricTypeLabel(m.metric_type)}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {getPeriodTypeLabel(m.period_type)}
                  {' · '}
                  <span className={getMetricSourceStyle(m.source)}>
                    {getMetricSourceLabel(m.source)}
                  </span>
                  {m.notes && <span> · {m.notes}</span>}
                </p>
              </div>
              <div className="text-sm font-semibold text-gray-900 tabular-nums shrink-0 ml-4">
                {formatCurrency(m.value)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function FinanceList({ metrics, years, addButton }: FinanceListProps) {
  const metricsByYear = years.reduce<Record<number, MetricData[]>>((acc, year) => {
    acc[year] = metrics.filter((m) => m.period_year === year)
    return acc
  }, {})

  return (
    <div className="space-y-4">
      {/* Summary + tilføj */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <span>{metrics.length} nøgletal</span>
          <span className="text-gray-300">·</span>
          <span>{years.length} år</span>
        </div>
        {addButton}
      </div>

      {years.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-200 py-16 text-center">
          <BarChart3 className="mx-auto h-10 w-10 text-gray-300" />
          <p className="mt-3 text-sm font-medium text-gray-900">Ingen nøgletal registreret endnu</p>
          <p className="mt-1 text-sm text-gray-400">
            Tilføj det første nøgletal for dette selskab.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {years.map((year, i) => (
            <CollapsibleYear
              key={year}
              year={year}
              metrics={metricsByYear[year]}
              defaultOpen={i === 0}
            />
          ))}
        </div>
      )}
    </div>
  )
}
