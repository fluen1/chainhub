'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Search } from 'lucide-react'
import { usePrototype } from '@/components/prototype/PrototypeProvider'
import { InsightCard } from '@/components/prototype/InsightCard'
import { CollapsibleSection } from '@/components/ui/CollapsibleSection'
import { CoverageBar } from '@/components/ui/CoverageBar'
import { getContracts, getContractCoverage } from '@/mock/contracts'
import { getInsights } from '@/mock/insights'
import { cn } from '@/lib/utils'
import type { MockContract } from '@/mock/types'

type FilterTab = 'alle' | 'udloeber' | 'manglende' | 'aendret'
type GroupBy = 'type' | 'selskab' | 'status'

function urgencyBorder(urgency: MockContract['urgency']): string {
  switch (urgency) {
    case 'critical': return 'border-l-red-500'
    case 'warning': return 'border-l-amber-500'
    default: return 'border-l-gray-200'
  }
}

function statusBadgeClass(status: MockContract['status']): string {
  switch (status) {
    case 'AKTIV': return 'bg-green-100 text-green-700'
    case 'UDLOEBET': return 'bg-red-100 text-red-700'
    case 'OPSAGT': return 'bg-gray-100 text-gray-600'
    case 'UDKAST': return 'bg-blue-100 text-blue-700'
    case 'FORNYET': return 'bg-green-100 text-green-700'
    default: return 'bg-gray-100 text-gray-600'
  }
}

function expiryLabel(days: number | null): string {
  if (days === null) return 'Ingen udløbsdato'
  if (days < 0) return `Udløbet for ${Math.abs(days)} dage siden`
  if (days === 0) return 'Udløber i dag'
  if (days <= 30) return `Udløber om ${days} dage`
  return `Udløber om ${days} dage`
}

function expiryColor(urgency: MockContract['urgency']): string {
  switch (urgency) {
    case 'critical': return 'text-red-600'
    case 'warning': return 'text-amber-600'
    default: return 'text-gray-500'
  }
}

interface ContractItemProps {
  contract: MockContract
}

function ContractItem({ contract }: ContractItemProps) {
  const router = useRouter()

  // "missing"-kontrakter har ingen detaljeside
  const isNavigable = !contract.id.startsWith('missing-')

  return (
    <div
      role={isNavigable ? 'link' : undefined}
      tabIndex={isNavigable ? 0 : undefined}
      onClick={() => isNavigable && router.push(`/proto/contracts/${contract.id}`)}
      onKeyDown={(e) => { if (isNavigable && e.key === 'Enter') router.push(`/proto/contracts/${contract.id}`) }}
      className={cn(
        'flex items-start gap-4 px-5 py-3 border-l-4 border-b last:border-b-0 transition-colors',
        isNavigable ? 'hover:bg-gray-50 cursor-pointer' : 'cursor-default',
        urgencyBorder(contract.urgency),
      )}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-gray-900 truncate">{contract.displayName}</span>
          <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
            {contract.categoryLabel}
          </span>
        </div>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          <span
            role="link"
            tabIndex={0}
            onClick={(e) => { e.stopPropagation(); router.push(`/proto/portfolio/${contract.companyId}`) }}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); router.push(`/proto/portfolio/${contract.companyId}`) } }}
            className="text-xs text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
          >
            {contract.companyName}
          </span>
          <span className="text-gray-300">·</span>
          <span className={cn('text-xs', expiryColor(contract.urgency))}>
            {expiryLabel(contract.daysUntilExpiry)}
          </span>
        </div>
      </div>
      <div className="shrink-0 flex items-center gap-2">
        <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', statusBadgeClass(contract.status))}>
          {contract.statusLabel}
        </span>
      </div>
    </div>
  )
}

function groupContracts(contracts: MockContract[], groupBy: GroupBy): { key: string; label: string; items: MockContract[] }[] {
  const map = new Map<string, MockContract[]>()

  for (const c of contracts) {
    let key: string
    if (groupBy === 'type') {
      key = c.categoryLabel
    } else if (groupBy === 'selskab') {
      key = c.companyId
    } else {
      key = c.status
    }

    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(c)
  }

  return Array.from(map.entries()).map(([key, items]) => ({
    key,
    label: groupBy === 'type' ? items[0].categoryLabel
      : groupBy === 'selskab' ? items[0].companyName
      : items[0].statusLabel,
    items,
  }))
}

export default function ContractsPage() {
  const { activeUser, dataScenario } = usePrototype()
  const [activeTab, setActiveTab] = useState<FilterTab>('alle')
  const [search, setSearch] = useState('')
  const [groupBy, setGroupBy] = useState<GroupBy>('type')

  const allContracts = getContracts(dataScenario)
  const insights = getInsights('contracts', activeUser.role, dataScenario)
  const coverage = getContractCoverage()

  // Beregn dækning pr. kontrakttype
  const coverageTypes = [
    { label: 'Ejeraftale', type: 'EJERAFTALE' },
    { label: 'Lejekontrakt', type: 'LEJEKONTRAKT' },
    { label: 'Forsikring', type: 'FORSIKRING' },
    { label: 'Ansættelseskontrakt', type: 'ANSAETTELSESKONTRAKT' },
  ]

  const uniqueCompanyIds = Array.from(new Set(allContracts.map((c) => c.companyId)))
  const totalCompanies = uniqueCompanyIds.length

  const coverageByType = coverageTypes.map(({ label, type }) => {
    const covered = uniqueCompanyIds.filter((id) =>
      allContracts.some((c) => c.companyId === id && c.systemType === type && c.status !== 'UDLOEBET' && c.status !== 'OPSAGT')
    ).length
    return { label, covered, total: totalCompanies }
  })

  // Tab-filtrering
  const tabFiltered = useMemo<MockContract[]>(() => {
    switch (activeTab) {
      case 'udloeber':
        return allContracts.filter(
          (c) => c.daysUntilExpiry !== null && c.daysUntilExpiry <= 90
        )
      case 'manglende':
        return coverage.flatMap(({ companyId, companyName, missingTypes }) =>
          missingTypes.map((mt) => ({
            id: `missing-${companyId}-${mt}`,
            companyId,
            companyName,
            displayName: `${mt} mangler`,
            systemType: mt,
            category: 'Manglende',
            categoryLabel: 'Manglende',
            status: 'UDKAST' as const,
            statusLabel: 'Mangler',
            expiryDate: null,
            daysUntilExpiry: null,
            urgency: 'critical' as const,
            sensitivity: '',
          }))
        )
      case 'aendret':
        // Simulerer "nyligt ændrede" — returnerer aktive med nylig udløbsdato
        return allContracts.filter((c) => c.daysUntilExpiry !== null && c.daysUntilExpiry <= 365).slice(0, 15)
      default:
        return allContracts
    }
  }, [allContracts, activeTab, coverage])

  // Søgning
  const filtered = useMemo<MockContract[]>(() => {
    if (!search.trim()) return tabFiltered
    const q = search.toLowerCase()
    return tabFiltered.filter(
      (c) =>
        c.displayName.toLowerCase().includes(q) ||
        c.companyName.toLowerCase().includes(q)
    )
  }, [tabFiltered, search])

  // Kræver handling — kritiske + advarsel
  const actionRequired = filtered.filter(
    (c) => c.urgency === 'critical' || c.urgency === 'warning'
  )

  // Resterende til grupper
  const remaining = filtered.filter(
    (c) => c.urgency !== 'critical' && c.urgency !== 'warning'
  )

  const groups = groupContracts(remaining, groupBy)

  // Summér
  const companyCount = new Set(filtered.map((c) => c.companyId)).size
  const actionCount = actionRequired.length

  const tabs: { key: FilterTab; label: string }[] = [
    { key: 'alle', label: 'Alle' },
    { key: 'udloeber', label: 'Udløber snart' },
    { key: 'manglende', label: 'Manglende' },
    { key: 'aendret', label: 'Nyligt ændrede' },
  ]

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Overskrift */}
      <div className="border-b border-gray-200/60 pb-6">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Kontrakter</h1>
        <p className="mt-1 text-sm text-gray-500">
          {filtered.length} kontrakter · {companyCount} selskaber · {actionCount} kræver handling
        </p>
      </div>

      {/* Insights */}
      {insights.length > 0 && (
        <div className="space-y-2">
          {insights.map((ins) => (
            <InsightCard key={ins.id} insight={ins} />
          ))}
        </div>
      )}

      {/* Dækningsoversigt */}
      <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-6">
        <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-gray-400 mb-4">Kontraktdækning pr. type</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {coverageByType.map(({ label, covered, total }) => (
            <CoverageBar key={label} label={label} covered={covered} total={total} />
          ))}
        </div>
      </div>

      {/* Filter + søgning + gruppering */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        {/* Faner */}
        <div className="flex gap-1 flex-wrap">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'px-3 py-1.5 text-sm rounded-md font-medium transition-colors',
                activeTab === tab.key
                  ? 'bg-gray-900 text-white'
                  : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex gap-2 flex-1 w-full sm:w-auto">
          {/* Søgning */}
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Søg på navn eller selskab..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-sm border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-gray-400"
            />
          </div>

          {/* Gruppering */}
          <select
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value as GroupBy)}
            className="text-sm border border-gray-300 rounded-md px-2 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-400"
          >
            <option value="type">Grupér: Type</option>
            <option value="selskab">Grupér: Selskab</option>
            <option value="status">Grupér: Status</option>
          </select>
        </div>
      </div>

      {/* Kræver handling */}
      {actionRequired.length > 0 && (
        <CollapsibleSection title="Kræver handling" count={actionRequired.length} defaultOpen={true}>
          <div className="divide-y divide-gray-100">
            {actionRequired.map((c) => (
              <ContractItem key={c.id} contract={c} />
            ))}
          </div>
        </CollapsibleSection>
      )}

      {/* Grupperinger */}
      {filtered.length === 0 ? (
        <div className="text-sm text-gray-500 text-center py-12 bg-white rounded-lg border">
          Ingen kontrakter fundet
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map((group) => (
            <CollapsibleSection
              key={group.key}
              title={group.label}
              count={group.items.length}
              defaultOpen={true}
            >
              <div className="divide-y divide-gray-100">
                {group.items.map((c) => (
                  <ContractItem key={c.id} contract={c} />
                ))}
              </div>
            </CollapsibleSection>
          ))}
        </div>
      )}
    </div>
  )
}
