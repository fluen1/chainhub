'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Building2 } from 'lucide-react'
import { usePrototype } from '@/components/prototype/PrototypeProvider'
import { InsightCard } from '@/components/prototype/InsightCard'
import { CollapsibleSection } from '@/components/ui/CollapsibleSection'
import { getInsights } from '@/mock/insights'
import { getCompanies } from '@/mock/companies'
import { filterCompaniesByRole, getCompanySubtitle } from '@/mock/helpers'
import type { MockCompany } from '@/mock/types'

type HealthStatus = MockCompany['healthStatus']

function statusBadge(status: HealthStatus): { label: string; className: string } {
  switch (status) {
    case 'critical':
      return { label: 'Kritisk', className: 'bg-red-100 text-red-700' }
    case 'warning':
      return { label: 'Advarsel', className: 'bg-amber-100 text-amber-700' }
    case 'healthy':
      return { label: 'Sund', className: 'bg-green-100 text-green-700' }
  }
}

function leftBorder(status: HealthStatus): string {
  switch (status) {
    case 'critical':
      return 'border-l-4 border-l-red-500'
    case 'warning':
      return 'border-l-4 border-l-amber-400'
    case 'healthy':
      return 'border-l-4 border-l-green-500'
  }
}

function CompanyRow({ company, subtitle }: { company: MockCompany; subtitle: string }) {
  const badge = statusBadge(company.healthStatus)

  return (
    <Link
      href={`/proto/portfolio/${company.id}`}
      className={`block px-5 py-3 hover:bg-gray-50 transition-colors ${leftBorder(company.healthStatus)}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-gray-900">{company.name}</span>
            <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${badge.className}`}>
              {badge.label}
            </span>
          </div>
          <p className="text-xs text-gray-600 mt-0.5 truncate">{subtitle}</p>
          <p className="text-xs text-gray-400 mt-0.5">{company.city} · CVR {company.cvr}</p>
        </div>
      </div>
    </Link>
  )
}

export default function PortfolioPage() {
  const { activeUser, dataScenario } = usePrototype()
  const role = activeUser.role

  const [search, setSearch] = useState('')

  const insights = getInsights('portfolio', role, dataScenario)
  const allCompanies = filterCompaniesByRole(getCompanies(dataScenario), role, activeUser.companyIds)

  // Klientsidefiltrering paa navn, CVR og by
  const filtered = allCompanies.filter((c) => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (
      c.name.toLowerCase().includes(q) ||
      c.cvr.includes(q) ||
      c.city.toLowerCase().includes(q)
    )
  })

  const needsAttention = filtered.filter((c) => c.healthStatus === 'critical' || c.healthStatus === 'warning')
  const healthy = filtered.filter((c) => c.healthStatus === 'healthy')

  const totalAttention = allCompanies.filter((c) => c.healthStatus !== 'healthy').length

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-5">
      {/* Titel + summarylinje */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Portefolje</h1>
        <p className="text-sm text-gray-500 mt-1">
          {allCompanies.length} selskaber
          {totalAttention > 0 && (
            <> &middot; <span className="text-amber-600 font-medium">{totalAttention} kraever opmaerksomhed</span></>
          )}
        </p>
      </div>

      {/* InsightCards (maks 2) */}
      {insights.length > 0 && (
        <div className="space-y-2">
          {insights.map((ins) => (
            <InsightCard key={ins.id} insight={ins} />
          ))}
        </div>
      )}

      {/* Soegefelt */}
      <div>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Soeg paa navn, CVR eller by..."
          className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent"
        />
      </div>

      {/* Tom state */}
      {filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-gray-400">
          <Building2 className="h-10 w-10 mb-3 text-gray-300" />
          <p className="text-sm">Ingen selskaber fundet</p>
        </div>
      )}

      {/* Gruppe: Kraever opmaerksomhed */}
      {needsAttention.length > 0 && (
        <CollapsibleSection
          title="Kraever opmaerksomhed"
          count={needsAttention.length}
          defaultOpen={true}
        >
          <div className="divide-y divide-gray-100">
            {needsAttention.map((company) => (
              <CompanyRow
                key={company.id}
                company={company}
                subtitle={getCompanySubtitle(company, role)}
              />
            ))}
          </div>
        </CollapsibleSection>
      )}

      {/* Gruppe: Sunde lokationer */}
      {healthy.length > 0 && (
        <CollapsibleSection
          title="Sunde lokationer"
          count={healthy.length}
          defaultOpen={true}
        >
          <div className="divide-y divide-gray-100">
            {healthy.map((company) => (
              <CompanyRow
                key={company.id}
                company={company}
                subtitle={getCompanySubtitle(company, role)}
              />
            ))}
          </div>
        </CollapsibleSection>
      )}
    </div>
  )
}
