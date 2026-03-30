'use client'
import { useState } from 'react'
import { AlertTriangle, TrendingDown, FileWarning, BarChart3, CheckCircle2, ArrowRight, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { MockInsight } from '@/mock/types'

interface InsightCardProps {
  insight: MockInsight
}

const colorMap: Record<MockInsight['type'], string> = {
  critical: 'border-red-500',
  warning: 'border-amber-500',
  info: 'border-blue-500',
  coverage: 'border-amber-500',
}

const iconBgMap: Record<MockInsight['type'], string> = {
  critical: 'text-red-500',
  warning: 'text-amber-500',
  info: 'text-blue-500',
  coverage: 'text-amber-500',
}

const iconMap: Record<string, React.ElementType> = {
  AlertTriangle,
  TrendingDown,
  FileWarning,
  BarChart3,
  CheckCircle2,
}

export function InsightCard({ insight }: InsightCardProps) {
  const [dismissed, setDismissed] = useState(false)

  if (dismissed) return null

  const IconComponent = iconMap[insight.icon] ?? AlertTriangle

  return (
    <div
      className={cn(
        'border-l-4 rounded-r-xl px-4 py-3 bg-white shadow-sm',
        colorMap[insight.type],
      )}
    >
      <div className="flex items-start gap-3">
        {/* Ikon */}
        <div className={cn('mt-0.5 shrink-0', iconBgMap[insight.type])}>
          <IconComponent className="h-4 w-4" />
        </div>

        {/* Indhold */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900">{insight.title}</p>
          <p className="text-xs text-gray-500 mt-0.5">{insight.description}</p>
          <a
            href={insight.actionHref}
            className="inline-flex items-center gap-1 mt-2 text-xs font-medium text-gray-700 hover:text-gray-900 transition-colors"
          >
            {insight.actionLabel}
            <ArrowRight className="h-3 w-3" />
          </a>
        </div>

        {/* Luk-knap */}
        <button
          onClick={() => setDismissed(true)}
          className="shrink-0 p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          aria-label="Afvis"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}
