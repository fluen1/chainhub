import Link from 'next/link'
import type { PortfolioCompanyRow } from '@/types/portfolio'
import { StatusBadge } from '@/components/portfolio/StatusBadge'
import { EjerandelBadge } from '@/components/portfolio/EjerandelBadge'

interface PortfolioTableProps {
  companies: PortfolioCompanyRow[]
}

export function PortfolioTable({ companies }: PortfolioTableProps) {
  if (companies.length === 0) return null

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th
              scope="col"
              className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500"
            >
              Selskab
            </th>
            <th
              scope="col"
              className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500"
            >
              Status
            </th>
            <th
              scope="col"
              className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500"
            >
              Ejerandel
            </th>
            <th
              scope="col"
              className="px-6 py-3 text-center text-xs font-medium uppercase tracking-wide text-gray-500"
            >
              Aktive sager
            </th>
            <th
              scope="col"
              className="px-6 py-3 text-center text-xs font-medium uppercase tracking-wide text-gray-500"
            >
              Udløbende kontrakter
            </th>
            <th
              scope="col"
              className="px-6 py-3 text-center text-xs font-medium uppercase tracking-wide text-gray-500"
            >
              Kontrakter i alt
            </th>
            <th scope="col" className="relative px-6 py-3">
              <span className="sr-only">Åbn</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 bg-white">
          {companies.map((company) => (
            <PortfolioTableRow key={company.id} company={company} />
          ))}
        </tbody>
      </table>
    </div>
  )
}

function PortfolioTableRow({ company }: { company: PortfolioCompanyRow }) {
  return (
    <tr className="hover:bg-gray-50 transition-colors">
      {/* Selskabsnavn + CVR */}
      <td className="px-6 py-4">
        <div className="flex flex-col">
          <span className="text-sm font-medium text-gray-900">{company.name}</span>
          <span className="text-xs text-gray-400">
            {company.cvr ? `CVR ${company.cvr}` : company.companyType ?? ''}
            {company.city ? ` · ${company.city}` : ''}
          </span>
        </div>
      </td>

      {/* Status */}
      <td className="px-6 py-4">
        <StatusBadge status={company.status} />
      </td>

      {/* Ejerandel */}
      <td className="px-6 py-4">
        <EjerandelBadge value={company.maxEjerandel} />
      </td>

      {/* Aktive sager */}
      <td className="px-6 py-4 text-center">
        {company.activeCases > 0 ? (
          <span className="inline-flex items-center justify-center rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-semibold text-violet-800">
            {company.activeCases}
          </span>
        ) : (
          <span className="text-sm text-gray-400">—</span>
        )}
      </td>

      {/* Udløbende kontrakter */}
      <td className="px-6 py-4 text-center">
        {company.expiringContracts > 0 ? (
          <span className="inline-flex items-center justify-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
            {company.expiringContracts}
          </span>
        ) : (
          <span className="text-sm text-gray-400">—</span>
        )}
      </td>

      {/* Kontrakter i alt */}
      <td className="px-6 py-4 text-center">
        <span className="text-sm text-gray-600">{company.totalContracts}</span>
      </td>

      {/* Link */}
      <td className="px-6 py-4 text-right">
        <Link
          href={`/companies/${company.id}`}
          className="text-sm font-medium text-blue-600 hover:text-blue-700"
        >
          Åbn
        </Link>
      </td>
    </tr>
  )
}