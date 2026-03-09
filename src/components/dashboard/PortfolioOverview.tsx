'use client'

import type { DashboardData } from '@/actions/dashboard'
import {
  Building2,
  FileText,
  AlertTriangle,
  Clock,
  TrendingUp,
} from 'lucide-react'

interface PortfolioOverviewProps {
  data: DashboardData
}

export function PortfolioOverview({ data }: PortfolioOverviewProps) {
  const { summary, companies } = data

  return (
    <div className="flex flex-col gap-6">
      {/* Summary-kort */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <SummaryCard
          icon={<Building2 className="h-5 w-5 text-blue-600" />}
          label="Selskaber"
          value={summary.totalCompanies}
          bg="bg-blue-50"
        />
        <SummaryCard
          icon={<FileText className="h-5 w-5 text-green-600" />}
          label="Aktive kontrakter"
          value={summary.activeContracts}
          bg="bg-green-50"
        />
        <SummaryCard
          icon={<Clock className="h-5 w-5 text-yellow-600" />}
          label="Udløber snart"
          value={summary.expiringContracts30Days}
          bg="bg-yellow-50"
        />
        <SummaryCard
          icon={<AlertTriangle className="h-5 w-5 text-orange-600" />}
          label="Åbne sager"
          value={summary.openCases}
          bg="bg-orange-50"
        />
        <SummaryCard
          icon={<TrendingUp className="h-5 w-5 text-red-600" />}
          label="Overskrene frister"
          value={summary.overdueDeadlines}
          bg="bg-red-50"
        />
      </div>

      {/* Selskabstabel */}
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <div className="border-b border-gray-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-gray-700">Selskaber</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Selskab</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">CVR</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Status</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">Kontrakter</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">Sager</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">Opgaver</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">Omsætning</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {companies.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                    Ingen selskaber fundet
                  </td>
                </tr>
              ) : (
                companies.map((company) => (
                  <tr key={company.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{company.name}</td>
                    <td className="px-4 py-3 text-gray-500">{company.cvr ?? '—'}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={company.status} />
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700">{company.contractCount}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{company.activeCaseCount}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{company.openTaskCount}</td>
                    <td className="px-4 py-3 text-right text-gray-500">
                      {company.latestRevenue != null
                        ? `${company.latestRevenue.toLocaleString('da-DK')} kr. (${company.latestRevenueYear})`
                        : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="border-t border-gray-200 px-4 py-2 text-xs text-gray-400">
          Opdateret: {new Date(summary.computedAt).toLocaleString('da-DK')}
        </div>
      </div>
    </div>
  )
}

// ==================== HJÆLPEKOMPONENTER ====================

function SummaryCard({
  icon,
  label,
  value,
  bg,
}: {
  icon: React.ReactNode
  label: string
  value: number
  bg: string
}) {
  return (
    <div className={`flex items-center gap-3 rounded-lg border border-gray-200 p-4 ${bg}`}>
      <div className="shrink-0">{icon}</div>
      <div>
        <p className="text-xs text-gray-500">{label}</p>
        <p className="text-xl font-semibold text-gray-900">{value}</p>
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    AKTIV: 'bg-green-100 text-green-700',
    INAKTIV: 'bg-gray-100 text-gray-600',
    UNDER_STIFTELSE: 'bg-blue-100 text-blue-700',
    OPLØST: 'bg-red-100 text-red-700',
  }
  const cls = map[status] ?? 'bg-gray-100 text-gray-600'
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
      {status}
    </span>
  )
}