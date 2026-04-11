'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import {
  Search,
  Map as MapIcon,
  List as ListIcon,
  Plus,
  ArrowUp,
  ArrowDown,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { PortfolioCompany, PortfolioTotals } from './page'

// ---------------------------------------------------------------
// Geografiske positioner (% af kort-areal) — hardcoded for Danmark
// ---------------------------------------------------------------
const CITY_POSITIONS: Record<string, { top: string; left: string }> = {
  Aalborg:    { top: '10%', left: '40%' },
  Viborg:     { top: '22%', left: '28%' },
  Holstebro:  { top: '25%', left: '18%' },
  Randers:    { top: '23%', left: '38%' },
  Herning:    { top: '30%', left: '22%' },
  Aarhus:     { top: '28%', left: '42%' },
  Silkeborg:  { top: '30%', left: '32%' },
  Horsens:    { top: '36%', left: '38%' },
  Vejle:      { top: '40%', left: '34%' },
  Esbjerg:    { top: '46%', left: '14%' },
  Fredericia: { top: '42%', left: '40%' },
  Kolding:    { top: '45%', left: '32%' },
  Haderslev:  { top: '52%', left: '28%' },
  Odense:     { top: '44%', left: '48%' },
  Nyborg:     { top: '45%', left: '54%' },
  Svendborg:  { top: '55%', left: '50%' },
  Slagelse:   { top: '48%', left: '60%' },
  Roskilde:   { top: '44%', left: '66%' },
  Næstved:    { top: '56%', left: '64%' },
  Køge:       { top: '47%', left: '69%' },
  Hillerød:   { top: '38%', left: '70%' },
  Helsingør:  { top: '34%', left: '74%' },
  København:  { top: '42%', left: '72%' },
}

// Normaliser byer med postdistrikt-suffiks: "København Ø" → "København", "Aarhus C" → "Aarhus"
function normalizeCity(city: string): string {
  return city.replace(/\s+[NSØVKC]{1,2}$/, '').trim()
}

// ---------------------------------------------------------------
// By-clustering
// ---------------------------------------------------------------
type HealthStatus = PortfolioCompany['healthStatus']

interface CityCluster {
  city: string
  companies: PortfolioCompany[]
  worstStatus: HealthStatus
  position: { top: string; left: string }
}

function groupByCities(companies: PortfolioCompany[]): CityCluster[] {
  const map = new Map<string, PortfolioCompany[]>()
  for (const c of companies) {
    const city = normalizeCity(c.city ?? 'Ukendt')
    if (!map.has(city)) map.set(city, [])
    map.get(city)!.push(c)
  }

  const rank = { critical: 0, warning: 1, healthy: 2 }

  return Array.from(map.entries())
    .map(([city, list]) => {
      const worstStatus = list.reduce<HealthStatus>((worst, c) => {
        return rank[c.healthStatus] < rank[worst] ? c.healthStatus : worst
      }, 'healthy')
      return {
        city,
        companies: list,
        worstStatus,
        position: CITY_POSITIONS[city] ?? { top: '50%', left: '50%' },
      }
    })
    .filter((cluster) => CITY_POSITIONS[cluster.city] !== undefined)
}

// ---------------------------------------------------------------
// Farver og labels
// ---------------------------------------------------------------
function dotColor(status: HealthStatus): string {
  switch (status) {
    case 'critical':
      return 'bg-rose-500 ring-[3px] ring-rose-500/15'
    case 'warning':
      return 'bg-amber-400 ring-[3px] ring-amber-400/15'
    case 'healthy':
      return 'bg-emerald-400 ring-[3px] ring-emerald-400/10'
  }
}

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

function formatMio(val: number): string {
  return (val / 1_000_000).toFixed(1)
}

// ---------------------------------------------------------------
// City cluster dot (kortet)
// ---------------------------------------------------------------
function CityClusterDot({ cluster }: { cluster: CityCluster }) {
  const size = 26 + Math.min(cluster.companies.length, 6) * 3
  const dotCls = dotColor(cluster.worstStatus)

  return (
    <div
      className="absolute flex flex-col items-center cursor-pointer group/cluster"
      style={{
        top: cluster.position.top,
        left: cluster.position.left,
        transform: 'translate(-50%, -50%)',
      }}
    >
      <div className="relative transition-transform duration-200 ease-out group-hover/cluster:scale-[1.08]">
        <div
          className={cn(
            'relative rounded-full flex items-center justify-center text-[10px] font-semibold text-white tabular-nums',
            dotCls
          )}
          style={{ width: size, height: size }}
        >
          {cluster.companies.length}
        </div>
      </div>
      <div className="text-[9px] font-medium text-slate-500 mt-2 tracking-wide whitespace-nowrap">
        {cluster.city}
      </div>

      {/* Tooltip — hover preview */}
      <div className="absolute bottom-[calc(100%+10px)] left-1/2 -translate-x-1/2 bg-white rounded-lg p-2.5 min-w-[240px] ring-1 ring-slate-900/5 shadow-[0_12px_32px_-12px_rgba(15,23,42,0.25)] opacity-0 translate-y-1 pointer-events-none group-hover/cluster:opacity-100 group-hover/cluster:translate-y-0 group-hover/cluster:pointer-events-auto transition-all duration-150 z-20">
        <div className="text-[9px] font-medium text-slate-400 uppercase tracking-[0.08em] mb-1.5 px-1">
          {cluster.city} · {cluster.companies.length}{' '}
          {cluster.companies.length === 1 ? 'lokation' : 'lokationer'}
        </div>
        {cluster.companies.map((c) => (
          <Link
            key={c.id}
            href={`/companies/${c.id}`}
            className="flex items-center justify-between gap-3 py-1.5 px-1 no-underline rounded-md hover:bg-slate-50 transition-colors"
          >
            <div className="min-w-0 flex-1">
              <div className="text-[12px] font-medium text-slate-900 truncate">
                {c.name}
              </div>
              <div className="text-[10px] text-slate-500 truncate">
                {c.partnerName ?? 'Ingen partner'} ·{' '}
                {c.partnerOwnershipPct != null
                  ? `${c.partnerOwnershipPct}%`
                  : '—'}
              </div>
            </div>
            <span
              className={cn(
                'text-[9px] font-medium px-1.5 py-0.5 rounded shrink-0',
                badgeColor(c.healthStatus)
              )}
            >
              {badgeLabel(c.healthStatus)}
            </span>
          </Link>
        ))}
        {/* Caret */}
        <div className="absolute top-full left-1/2 -translate-x-1/2 border-[5px] border-transparent border-t-white" />
      </div>
    </div>
  )
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
    status === 'critical'
      ? 'bg-rose-500'
      : status === 'warning'
        ? 'bg-amber-400'
        : 'bg-emerald-400'

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
        className={cn(
          'inline-flex items-center gap-1',
          align === 'right' && 'flex-row-reverse'
        )}
      >
        <span className={cn(active && 'text-slate-900')}>{label}</span>
        {active &&
          (dir === 'asc' ? (
            <ArrowUp className="w-3 h-3" />
          ) : (
            <ArrowDown className="w-3 h-3" />
          ))}
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
                <td className="px-4 py-3 text-slate-600">
                  {c.partnerName ?? '—'}
                </td>
                <td className="px-4 py-3 text-slate-600 text-right tabular-nums">
                  {c.groupOwnershipPct != null
                    ? `${c.groupOwnershipPct}%`
                    : '—'}
                </td>
                <td className="px-4 py-3 text-slate-900 font-medium text-right tabular-nums">
                  {c.revenue != null && c.revenue > 0
                    ? `${formatMio(c.revenue)}M`
                    : '—'}
                </td>
                <td className="px-4 py-3 text-slate-600 text-right tabular-nums">
                  {c.ebitdaMargin != null
                    ? `${(c.ebitdaMargin * 100).toFixed(1)}%`
                    : '—'}
                </td>
                <td className="px-4 py-3 text-slate-600 text-right tabular-nums">
                  {c.contractCount}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  <span
                    className={cn(
                      c.openCaseCount > 0
                        ? 'text-rose-600 font-medium'
                        : 'text-slate-400'
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
          <p className="text-[13px] text-slate-500 font-medium">
            Ingen lokationer fundet
          </p>
          <p className="text-[11px] text-slate-400 mt-1">
            Prøv et andet søgeord eller filter
          </p>
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
  const [healthFilter, setHealthFilter] = useState<
    'all' | 'critical' | 'warning' | 'healthy'
  >('all')
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

  const clusters = useMemo(() => groupByCities(filtered), [filtered])
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
            <h1 className="text-[20px] font-semibold tracking-tight text-slate-900">
              Selskaber
            </h1>
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

        <div className="grid grid-cols-[1fr_340px] gap-4">
          {/* Filter bar */}
          <div className="col-span-2 flex items-center gap-2 mb-0">
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
              onClick={() =>
                setHealthFilter(
                  healthFilter === 'critical' ? 'all' : 'critical'
                )
              }
            />
            <HealthPill
              status="warning"
              label={`${counts.warning} Advarsel`}
              active={healthFilter === 'warning'}
              onClick={() =>
                setHealthFilter(
                  healthFilter === 'warning' ? 'all' : 'warning'
                )
              }
            />
            <HealthPill
              status="healthy"
              label={`${counts.healthy} Sunde`}
              active={healthFilter === 'healthy'}
              onClick={() =>
                setHealthFilter(
                  healthFilter === 'healthy' ? 'all' : 'healthy'
                )
              }
            />

            {/* View toggle */}
            <div className="flex items-center bg-white ring-1 ring-slate-900/[0.06] rounded-lg p-0.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
              <button
                type="button"
                onClick={() => setView('map')}
                className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[12px] font-medium transition-colors',
                  view === 'map'
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:text-slate-900'
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
            <div
              className="relative rounded-xl p-6 min-h-[560px] overflow-hidden ring-1 ring-slate-900/10 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
              style={{
                background:
                  'linear-gradient(180deg, #0b1220 0%, #0f172a 100%)',
              }}
            >
              {/* Subtil vignette */}
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  background:
                    'radial-gradient(ellipse at 50% 40%, rgba(148,163,184,0.04) 0%, transparent 60%)',
                }}
              />
              {/* Grid pattern */}
              <div
                className="absolute inset-0 opacity-[0.025] pointer-events-none"
                style={{
                  backgroundImage:
                    'linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)',
                  backgroundSize: '48px 48px',
                }}
              />

              {/* Danmark-outline (dekorativ) */}
              <svg
                viewBox="0 0 400 600"
                className="absolute inset-5 opacity-[0.08] pointer-events-none"
                fill="none"
                stroke="#94a3b8"
                strokeWidth="1"
              >
                {/* Jylland */}
                <path d="M140,40 C155,30 180,35 190,45 L200,65 C210,80 215,95 210,115 L205,140 C200,160 195,170 200,185 L210,210 C215,225 220,240 215,260 L205,285 C200,300 195,320 185,340 L170,365 C165,380 155,395 145,405 L135,415 C125,425 120,440 118,460 L115,480 C112,500 115,520 125,540 L135,555 C140,560 130,570 120,565 L105,545 C95,530 85,510 80,490 L75,460 C70,440 72,420 80,400 L95,370 C100,355 108,340 105,320 L100,295 C95,275 90,255 95,235 L105,210 C110,190 118,170 115,150 L110,125 C105,105 110,85 120,65 Z" />
                {/* Fyn */}
                <path d="M195,425 C210,415 228,420 235,435 C242,450 238,470 228,482 C215,494 200,490 193,478 C186,465 186,440 195,425 Z" />
                {/* Sjælland */}
                <path d="M260,390 C285,380 315,388 325,405 L338,430 C345,448 342,470 330,485 L310,505 C298,515 280,518 262,510 L245,500 C232,488 228,470 232,452 L240,425 C244,408 250,396 260,390 Z" />
              </svg>

              {/* Label */}
              <div className="relative flex items-center gap-2 text-[10px] font-medium text-slate-500 uppercase tracking-[0.12em]">
                <span className="w-1 h-1 rounded-full bg-emerald-400" />
                Danmark · Live
              </div>

              {/* City clusters */}
              <div className="absolute inset-5">
                {clusters.map((cluster) => (
                  <CityClusterDot key={cluster.city} cluster={cluster} />
                ))}
              </div>

              {/* Empty state på kort */}
              {clusters.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center">
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
                <KpiBox
                  label="Lokationer"
                  value={String(totals.locationCount)}
                />
                <KpiBox
                  label="Kræver handling"
                  value={String(totals.attentionCount)}
                  danger
                />
                <KpiBox
                  label="Omsætning"
                  value={
                    totals.totalRevenue != null
                      ? `${formatMio(totals.totalRevenue)}M`
                      : '—'
                  }
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
                          item.status === 'critical'
                            ? 'bg-rose-500'
                            : 'bg-amber-400'
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
                      <div className="text-[10px] text-slate-500 truncate">
                        {item.sub}
                      </div>
                    </div>
                    <div className="text-[10px] text-slate-400 font-medium whitespace-nowrap tabular-nums">
                      {item.time}
                    </div>
                  </Link>
                ))}
                {urgencyItems.length === 0 && (
                  <p className="text-[12px] text-slate-400 py-2">
                    Alt under kontrol
                  </p>
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
