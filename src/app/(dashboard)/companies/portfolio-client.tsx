'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { Search, Map as MapIcon, List as ListIcon, Plus, ArrowUp, ArrowDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatMio } from '@/lib/labels'
import { ExportButton } from '@/components/ui/export-button'
import type { PortfolioCompany, PortfolioTotals } from './page'
import type { MapCompany } from '@/components/companies/leaflet-map'

const LeafletMap = dynamic(() => import('@/components/companies/leaflet-map'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center min-h-[560px] rounded-xl bg-[#0f172a]">
      <div className="text-sm text-slate-500">Indlæser kort...</div>
    </div>
  ),
})

// ---------------------------------------------------------------
// Farver og labels
// ---------------------------------------------------------------
type HealthStatus = PortfolioCompany['healthStatus']

function badgeColor(status: HealthStatus): string {
  switch (status) {
    case 'critical':
      return 'bg-rose-50 text-rose-700'
    case 'warning':
      return 'bg-amber-50 text-amber-700'
    case 'healthy':
      return 'bg-emerald-50 text-emerald-700'
  }
}

function badgeLabel(status: HealthStatus): string {
  switch (status) {
    case 'critical':
      return 'Kritisk'
    case 'warning':
      return 'Advarsel'
    case 'healthy':
      return 'Sund'
  }
}

// ---------------------------------------------------------------
// Højre-panel komponenter
// ---------------------------------------------------------------
function PanelCard({
  title,
  children,
  className,
}: {
  title: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'bg-white rounded-xl p-4 ring-1 ring-slate-900/[0.06] shadow-[0_1px_2px_rgba(15,23,42,0.04)]',
        className
      )}
    >
      <div className="text-[10px] font-medium text-slate-400 uppercase tracking-[0.1em] mb-3">
        {title}
      </div>
      {children}
    </div>
  )
}

function KpiBox({
  label,
  value,
  trend,
  trendDir,
  danger,
}: {
  label: string
  value: string
  trend?: string
  trendDir?: 'up' | 'down'
  danger?: boolean
}) {
  return (
    <div className="rounded-lg p-3 bg-slate-50/70">
      <div className="text-[10px] text-slate-500 font-medium">{label}</div>
      <div
        className={cn(
          'text-[20px] font-semibold leading-tight tabular-nums mt-1',
          danger ? 'text-rose-600' : 'text-slate-900'
        )}
      >
        {value}
      </div>
      {trend && (
        <div
          className={cn(
            'text-[10px] font-medium mt-1',
            trendDir === 'up' && 'text-emerald-600',
            trendDir === 'down' && 'text-rose-600'
          )}
        >
          {trend}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------
// Sorterings-typer og helpers
// ---------------------------------------------------------------
type SortKey =
  | 'name'
  | 'city'
  | 'partner'
  | 'ownership'
  | 'revenue'
  | 'margin'
  | 'status'
  | 'contracts'
  | 'cases'

function sortCompanies(
  companies: PortfolioCompany[],
  key: SortKey,
  dir: 'asc' | 'desc'
): PortfolioCompany[] {
  const statusRank = { critical: 0, warning: 1, healthy: 2 }
  const mult = dir === 'asc' ? 1 : -1

  return [...companies].sort((a, b) => {
    let cmp = 0
    switch (key) {
      case 'name':
        cmp = a.name.localeCompare(b.name, 'da')
        break
      case 'city':
        cmp = (a.city ?? '').localeCompare(b.city ?? '', 'da')
        break
      case 'partner':
        cmp = (a.partnerName ?? '').localeCompare(b.partnerName ?? '', 'da')
        break
      case 'ownership':
        cmp = (a.groupOwnershipPct ?? 0) - (b.groupOwnershipPct ?? 0)
        break
      case 'revenue':
        cmp = (a.revenue ?? 0) - (b.revenue ?? 0)
        break
      case 'margin':
        cmp = (a.ebitdaMargin ?? 0) - (b.ebitdaMargin ?? 0)
        break
      case 'status':
        cmp = statusRank[a.healthStatus] - statusRank[b.healthStatus]
        break
      case 'contracts':
        cmp = a.contractCount - b.contractCount
        break
      case 'cases':
        cmp = a.openCaseCount - b.openCaseCount
        break
    }
    return cmp * mult
  })
}

// ---------------------------------------------------------------
// Filter pill
// ---------------------------------------------------------------
function HealthPill({
  status,
  label,
  active,
  onClick,
}: {
  status: 'critical' | 'warning' | 'healthy'
  label: string
  active: boolean
  onClick: () => void
}) {
  const dotCls =
    status === 'critical' ? 'bg-rose-500' : status === 'warning' ? 'bg-amber-400' : 'bg-emerald-400'

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 px-3 py-2 rounded-lg text-[12px] font-medium transition-colors bg-white ring-1 shadow-[0_1px_2px_rgba(15,23,42,0.04)]',
        active
          ? 'ring-slate-900/20 text-slate-900'
          : 'ring-slate-900/[0.06] text-slate-600 hover:text-slate-900'
      )}
    >
      <span className={cn('w-1.5 h-1.5 rounded-full', dotCls)} />
      {label}
    </button>
  )
}

// ---------------------------------------------------------------
// Tabel header
// ---------------------------------------------------------------
function Th({
  label,
  active,
  dir,
  onClick,
  align = 'left',
}: {
  label: string
  active: boolean
  dir: 'asc' | 'desc'
  onClick: () => void
  align?: 'left' | 'right'
}) {
  return (
    <th
      className={cn(
        'px-4 py-2.5 text-[10px] font-medium text-slate-500 uppercase tracking-[0.08em] cursor-pointer select-none hover:text-slate-900 transition-colors',
        align === 'right' ? 'text-right' : 'text-left'
      )}
      onClick={onClick}
    >
      <span
        className={cn('inline-flex items-center gap-1', align === 'right' && 'flex-row-reverse')}
      >
        <span className={cn(active && 'text-slate-900')}>{label}</span>
        {active &&
          (dir === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}
      </span>
    </th>
  )
}

// ---------------------------------------------------------------
// List view (sortérbar tabel)
// ---------------------------------------------------------------
function CompanyListView({
  companies,
  sortKey,
  sortDir,
  onSort,
}: {
  companies: PortfolioCompany[]
  sortKey: SortKey
  sortDir: 'asc' | 'desc'
  onSort: (key: SortKey) => void
}) {
  return (
    <div className="bg-white rounded-xl ring-1 ring-slate-900/[0.06] shadow-[0_1px_2px_rgba(15,23,42,0.04)] overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/50">
              <Th
                label="Selskab"
                active={sortKey === 'name'}
                dir={sortDir}
                onClick={() => onSort('name')}
              />
              <Th
                label="By"
                active={sortKey === 'city'}
                dir={sortDir}
                onClick={() => onSort('city')}
              />
              <Th
                label="Partner"
                active={sortKey === 'partner'}
                dir={sortDir}
                onClick={() => onSort('partner')}
              />
              <Th
                label="Ejerskab"
                active={sortKey === 'ownership'}
                dir={sortDir}
                onClick={() => onSort('ownership')}
                align="right"
              />
              <Th
                label="Omsætning"
                active={sortKey === 'revenue'}
                dir={sortDir}
                onClick={() => onSort('revenue')}
                align="right"
              />
              <Th
                label="EBITDA %"
                active={sortKey === 'margin'}
                dir={sortDir}
                onClick={() => onSort('margin')}
                align="right"
              />
              <Th
                label="Kontrakter"
                active={sortKey === 'contracts'}
                dir={sortDir}
                onClick={() => onSort('contracts')}
                align="right"
              />
              <Th
                label="Sager"
                active={sortKey === 'cases'}
                dir={sortDir}
                onClick={() => onSort('cases')}
                align="right"
              />
              <Th
                label="Status"
                active={sortKey === 'status'}
                dir={sortDir}
                onClick={() => onSort('status')}
              />
            </tr>
          </thead>
          <tbody>
            {companies.map((c) => (
              <tr
                key={c.id}
                className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50/60 transition-colors group/row"
              >
                <td className="px-4 py-3">
                  <Link
                    href={`/companies/${c.id}`}
                    className="font-medium text-slate-900 group-hover/row:text-slate-950 no-underline"
                  >
                    {c.name}
                  </Link>
                  {c.cvr && (
                    <div className="text-[10px] text-slate-400 mt-0.5 tabular-nums">
                      CVR {c.cvr}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 text-slate-600">{c.city ?? '—'}</td>
                <td className="px-4 py-3 text-slate-600">{c.partnerName ?? '—'}</td>
                <td className="px-4 py-3 text-slate-600 text-right tabular-nums">
                  {c.groupOwnershipPct != null ? `${c.groupOwnershipPct}%` : '—'}
                </td>
                <td className="px-4 py-3 text-slate-900 font-medium text-right tabular-nums">
                  {c.revenue != null && c.revenue > 0 ? `${formatMio(c.revenue)}M` : '—'}
                </td>
                <td className="px-4 py-3 text-slate-600 text-right tabular-nums">
                  {c.ebitdaMargin != null ? `${(c.ebitdaMargin * 100).toFixed(1)}%` : '—'}
                </td>
                <td className="px-4 py-3 text-slate-600 text-right tabular-nums">
                  {c.contractCount}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  <span
                    className={cn(
                      c.openCaseCount > 0 ? 'text-rose-600 font-medium' : 'text-slate-400'
                    )}
                  >
                    {c.openCaseCount}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={cn(
                      'inline-flex items-center gap-1.5 text-[10px] font-medium px-2 py-0.5 rounded',
                      badgeColor(c.healthStatus)
                    )}
                  >
                    <span
                      className={cn(
                        'w-1 h-1 rounded-full',
                        c.healthStatus === 'critical' && 'bg-rose-500',
                        c.healthStatus === 'warning' && 'bg-amber-500',
                        c.healthStatus === 'healthy' && 'bg-emerald-500'
                      )}
                    />
                    {badgeLabel(c.healthStatus)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {companies.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-[13px] text-slate-500 font-medium">Ingen lokationer fundet</p>
          <p className="text-[11px] text-slate-400 mt-1">Prøv et andet søgeord eller filter</p>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------
// Hovedkomponent
// ---------------------------------------------------------------
export function PortfolioClient({
  companies,
  totals,
  canCreate,
}: {
  companies: PortfolioCompany[]
  totals: PortfolioTotals
  canCreate: boolean
}) {
  const [search, setSearch] = useState('')
  const [healthFilter, setHealthFilter] = useState<'all' | 'critical' | 'warning' | 'healthy'>(
    'all'
  )
  const [view, setView] = useState<'map' | 'list'>('map')
  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  const filtered = useMemo(() => {
    return companies.filter((c) => {
      if (healthFilter !== 'all' && c.healthStatus !== healthFilter) return false
      if (search.trim()) {
        const q = search.toLowerCase()
        return (
          c.name.toLowerCase().includes(q) ||
          (c.cvr ?? '').includes(q) ||
          (c.city ?? '').toLowerCase().includes(q) ||
          (c.partnerName ?? '').toLowerCase().includes(q)
        )
      }
      return true
    })
  }, [companies, search, healthFilter])

  const mapCompanies: MapCompany[] = useMemo(() => {
    return filtered
      .filter(
        (c): c is PortfolioCompany & { latitude: number; longitude: number } =>
          c.latitude != null && c.longitude != null
      )
      .map((c) => ({
        id: c.id,
        name: c.name,
        city: c.city,
        latitude: c.latitude,
        longitude: c.longitude,
        healthStatus: c.healthStatus,
        openCaseCount: c.openCaseCount,
        partnerName: c.partnerName,
        partnerOwnershipPct: c.partnerOwnershipPct,
      }))
  }, [filtered])

  const sorted = useMemo(
    () => sortCompanies(filtered, sortKey, sortDir),
    [filtered, sortKey, sortDir]
  )

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const counts = useMemo(() => {
    return {
      critical: companies.filter((c) => c.healthStatus === 'critical').length,
      warning: companies.filter((c) => c.healthStatus === 'warning').length,
      healthy: companies.filter((c) => c.healthStatus === 'healthy').length,
    }
  }, [companies])

  // Urgency items — afledt fra critical + warning selskaber
  const urgencyItems = useMemo(() => {
    const attention = companies.filter((c) => c.healthStatus !== 'healthy')
    return attention.slice(0, 4).map((c) => ({
      id: c.id,
      letter: c.name.charAt(0),
      status: c.healthStatus,
      title: c.healthReasons[0] ?? 'Kræver opmærksomhed',
      sub: `${c.name.replace(' ApS', '')} · ${c.city ?? 'Ukendt'}`,
      time: c.healthStatus === 'critical' ? 'Akut' : 'Snart',
    }))
  }, [companies])

  return (
    <div className="min-h-full bg-slate-50/60 p-8">
      <div className="max-w-[1280px] mx-auto">
        {/* Header */}
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-[20px] font-semibold tracking-tight text-slate-900">Selskaber</h1>
            <p className="text-[13px] text-slate-500 mt-1">
              {totals.locationCount} lokationer i porteføljen
              {totals.attentionCount > 0 && (
                <>
                  {' · '}
                  <span className="text-slate-700 font-medium">
                    {totals.attentionCount} kræver handling
                  </span>
                </>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <ExportButton entity="companies" />
            {canCreate && (
              <Link
                href="/companies/new"
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-900 text-white text-[12px] font-medium hover:bg-slate-800 transition-colors shadow-[0_1px_2px_rgba(15,23,42,0.1)] no-underline"
              >
                <Plus className="w-3.5 h-3.5" />
                Opret lokation
              </Link>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_340px]">
          {/* Filter bar */}
          <div className="flex flex-col gap-2 mb-0 sm:flex-row sm:items-center sm:flex-wrap lg:col-span-2">
            <div className="flex-1 bg-white ring-1 ring-slate-900/[0.06] rounded-lg px-3.5 py-2.5 flex items-center gap-2.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
              <Search className="w-4 h-4 text-slate-400 shrink-0" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Søg selskab, CVR, by, partner..."
                className="flex-1 text-[13px] text-slate-700 placeholder:text-slate-400 bg-transparent outline-none"
              />
            </div>

            <HealthPill
              status="critical"
              label={`${counts.critical} Kritisk`}
              active={healthFilter === 'critical'}
              onClick={() => setHealthFilter(healthFilter === 'critical' ? 'all' : 'critical')}
            />
            <HealthPill
              status="warning"
              label={`${counts.warning} Advarsel`}
              active={healthFilter === 'warning'}
              onClick={() => setHealthFilter(healthFilter === 'warning' ? 'all' : 'warning')}
            />
            <HealthPill
              status="healthy"
              label={`${counts.healthy} Sunde`}
              active={healthFilter === 'healthy'}
              onClick={() => setHealthFilter(healthFilter === 'healthy' ? 'all' : 'healthy')}
            />

            {/* View toggle */}
            <div className="flex items-center bg-white ring-1 ring-slate-900/[0.06] rounded-lg p-0.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
              <button
                type="button"
                onClick={() => setView('map')}
                className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[12px] font-medium transition-colors',
                  view === 'map' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'
                )}
                aria-label="Vis som kort"
              >
                <MapIcon className="w-3.5 h-3.5" />
                Kort
              </button>
              <button
                type="button"
                onClick={() => setView('list')}
                className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[12px] font-medium transition-colors',
                  view === 'list'
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:text-slate-900'
                )}
                aria-label="Vis som liste"
              >
                <ListIcon className="w-3.5 h-3.5" />
                Liste
              </button>
            </div>
          </div>

          {/* MAP AREA */}
          {view === 'map' && (
            <div className="relative rounded-xl overflow-hidden ring-1 ring-slate-900/10 shadow-[0_1px_2px_rgba(15,23,42,0.04)] min-h-[560px]">
              {mapCompanies.length > 0 ? (
                <LeafletMap companies={mapCompanies} />
              ) : (
                <div className="flex items-center justify-center min-h-[560px] bg-[#0f172a] rounded-xl">
                  <div className="text-center">
                    <p className="text-[13px] text-slate-400 font-medium">
                      Ingen lokationer fundet
                    </p>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Prøv et andet søgeord eller filter
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* LIST VIEW */}
          {view === 'list' && (
            <CompanyListView
              companies={sorted}
              sortKey={sortKey}
              sortDir={sortDir}
              onSort={toggleSort}
            />
          )}

          {/* RIGHT PANEL */}
          <div className="flex flex-col gap-3">
            {/* KPIs */}
            <PanelCard title="Portefølje">
              <div className="grid grid-cols-2 gap-2.5">
                <KpiBox label="Lokationer" value={String(totals.locationCount)} />
                <KpiBox label="Kræver handling" value={String(totals.attentionCount)} danger />
                <KpiBox
                  label="Omsætning"
                  value={totals.totalRevenue != null ? `${formatMio(totals.totalRevenue)}M` : '—'}
                />
                <KpiBox
                  label="EBITDA margin"
                  value={
                    totals.avgEbitdaMargin != null
                      ? `${(totals.avgEbitdaMargin * 100).toFixed(1)}%`
                      : '—'
                  }
                />
              </div>
            </PanelCard>

            {/* Urgency feed */}
            <PanelCard title="Kræver handling" className="flex-1">
              <div className="space-y-1.5">
                {urgencyItems.map((item) => (
                  <Link
                    key={item.id}
                    href={`/companies/${item.id}`}
                    className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 -mx-1 hover:bg-slate-50 transition-colors no-underline"
                  >
                    <div className="relative shrink-0">
                      <span
                        className={cn(
                          'absolute -left-0.5 top-0 bottom-0 w-[3px] rounded-full',
                          item.status === 'critical' ? 'bg-rose-500' : 'bg-amber-400'
                        )}
                      />
                      <div
                        className={cn(
                          'w-8 h-8 ml-2 rounded-md flex items-center justify-center text-[12px] font-semibold',
                          item.status === 'critical'
                            ? 'bg-rose-50 text-rose-700'
                            : 'bg-amber-50 text-amber-700'
                        )}
                      >
                        {item.letter}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[12px] font-medium text-slate-900 truncate">
                        {item.title}
                      </div>
                      <div className="text-[10px] text-slate-500 truncate">{item.sub}</div>
                    </div>
                    <div className="text-[10px] text-slate-400 font-medium whitespace-nowrap tabular-nums">
                      {item.time}
                    </div>
                  </Link>
                ))}
                {urgencyItems.length === 0 && (
                  <p className="text-[12px] text-slate-400 py-2">Alt under kontrol</p>
                )}
              </div>
            </PanelCard>

            {/* Activity — vises når aktivitetslog er implementeret */}
            <PanelCard title="Seneste aktivitet">
              <p className="text-[12px] text-slate-400 py-2">Ingen aktivitet registreret endnu</p>
            </PanelCard>
          </div>
        </div>
      </div>
    </div>
  )
}
