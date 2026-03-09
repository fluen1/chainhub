import type { PortfolioSummary } from '@/types/portfolio'
import { BuildingOffice2Icon, BriefcaseIcon, DocumentTextIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline'

interface PortfolioSummaryCardsProps {
  summary: PortfolioSummary
}

export function PortfolioSummaryCards({ summary }: PortfolioSummaryCardsProps) {
  const cards = [
    {
      label: 'Selskaber i alt',
      value: summary.totalCompanies,
      sub: `${summary.activeCompanies} aktive`,
      icon: BuildingOffice2Icon,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
    },
    {
      label: 'Aktive sager',
      value: summary.totalActiveCases,
      sub: 'På tværs af portefølje',
      icon: BriefcaseIcon,
      color: 'text-violet-600',
      bg: 'bg-violet-50',
    },
    {
      label: 'Udløbende kontrakter',
      value: summary.totalExpiringContracts,
      sub: 'Inden for 90 dage',
      icon: ExclamationTriangleIcon,
      color: summary.totalExpiringContracts > 0 ? 'text-amber-600' : 'text-gray-500',
      bg: summary.totalExpiringContracts > 0 ? 'bg-amber-50' : 'bg-gray-50',
    },
  ]

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {cards.map((card) => {
        const Icon = card.icon
        return (
          <div
            key={card.label}
            className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
          >
            <div className={`rounded-lg p-2.5 ${card.bg}`}>
              <Icon className={`h-6 w-6 ${card.color}`} />
            </div>
            <div>
              <p className="text-2xl font-semibold text-gray-900">{card.value}</p>
              <p className="text-sm font-medium text-gray-700">{card.label}</p>
              <p className="text-xs text-gray-400">{card.sub}</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}