'use client'

import { Fragment, useState, useMemo, useRef, useEffect } from 'react'
import Link from 'next/link'
import {
  Search,
  List as ListIcon,
  Grid3x3,
  Plus,
  ArrowUp,
  ArrowDown,
  AlertCircle,
  X,
  ChevronUp,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------
// Serializable types (passed from server component)
// ---------------------------------------------------------------
export interface ContractItem {
  id: string
  displayName: string
  companyId: string
  companyName: string
  systemType: string
  categoryLabel: string
  status: string
  expiryDate: string | null
  daysUntilExpiry: number | null
}

export interface CompanyItem {
  id: string
  name: string
  city: string | null
}

// ---------------------------------------------------------------
// Kanoniske kontrakt-typer (hvad hvert selskab SKAL have)
// Tilpasset til de reelle ContractSystemType enum-værdier
// ---------------------------------------------------------------
const REQUIRED_TYPES = [
  { key: 'EJERAFTALE',              label: 'Ejeraftale' },
  { key: 'LEJEKONTRAKT_ERHVERV',    label: 'Lejekontrakt' },
  { key: 'FORSIKRING',              label: 'Forsikring' },
  { key: 'VEDTAEGTER',              label: 'Vedtægter' },
  { key: 'ANSAETTELSE_FUNKTIONAER', label: 'Ansættelse' },
  { key: 'INTERN_SERVICEAFTALE',    label: 'Drift' },
] as const

// Farve per kategori (til kategori-chip)
const CATEGORY_COLORS: Record<string, string> = {
  Ejerskab:        'bg-violet-500',
  Lokaler:         'bg-sky-500',
  Forsikring:      'bg-emerald-500',
  Ansaettelse:     'bg-amber-500',
  Ansættelse:      'bg-amber-500',
  Kommercielle:    'bg-rose-500',
  Strukturaftaler: 'bg-slate-500',
}

// ---------------------------------------------------------------
// Udledt status (3 niveauer) — encoder urgency
// ---------------------------------------------------------------
type DerivedStatus = 'expired' | 'expiring' | 'active'

function deriveStatus(c: ContractItem): DerivedStatus {
  if (c.status === 'UDLOEBET') return 'expired'
  if (c.daysUntilExpiry != null && c.daysUntilExpiry < 0) return 'expired'
  if (c.status === 'AKTIV' && c.daysUntilExpiry != null && c.daysUntilExpiry <= 90)
    return 'expiring'
  return 'active'
}

function statusLabel(s: DerivedStatus): string {
  if (s === 'expired') return 'Udløbet'
  if (s === 'expiring') return 'Udløber'
  return 'Aktiv'
}

function statusStyle(s: DerivedStatus): string {
  if (s === 'expired')  return 'bg-rose-50 text-rose-700'
  if (s === 'expiring') return 'bg-amber-50 text-amber-700'
  return 'bg-emerald-50 text-emerald-700'
}

function statusDot(s: DerivedStatus): string {
  if (s === 'expired')  return 'bg-rose-500'
  if (s === 'expiring') return 'bg-amber-500'
  return 'bg-emerald-500'
}

// ---------------------------------------------------------------
// Relativ-tid helper
// ---------------------------------------------------------------
function relativeDate(daysUntilExpiry: number | null): string {
  if (daysUntilExpiry == null) return '\u2014'
  if (daysUntilExpiry < 0) return `${Math.abs(daysUntilExpiry)} dage siden`
  if (daysUntilExpiry === 0) return 'I dag'
  if (daysUntilExpiry === 1) return 'I morgen'
  return `om ${daysUntilExpiry} dage`
}

// ---------------------------------------------------------------
// Sort types
// ---------------------------------------------------------------
type SortKey = 'name' | 'company' | 'category' | 'expiry' | 'status'

function sortContracts(items: ContractItem[], key: SortKey, dir: 'asc' | 'desc'): ContractItem[] {
  const mult = dir === 'asc' ? 1 : -1
  const statusRank = { expired: 0, expiring: 1, active: 2 }
  return [...items].sort((a, b) => {
    let cmp = 0
    switch (key) {
      case 'name':     cmp = a.displayName.localeCompare(b.displayName, 'da'); break
      case 'company':  cmp = a.companyName.localeCompare(b.companyName, 'da'); break
      case 'category': cmp = a.categoryLabel.localeCompare(b.categoryLabel, 'da'); break
      case 'expiry':
        cmp = (a.daysUntilExpiry ?? 99999) - (b.daysUntilExpiry ?? 99999); break
      case 'status':
        cmp = statusRank[deriveStatus(a)] - statusRank[deriveStatus(b)]; break
    }
    return cmp * mult
  })
}

// ---------------------------------------------------------------
// Hovedkomponent
// ---------------------------------------------------------------
export default function ContractsClient({
  contracts,
  companies,
}: {
  contracts: ContractItem[]
  companies: CompanyItem[]
}) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | DerivedStatus | 'missing'>('all')
  const [showUrgency, setShowUrgency] = useState(true)
  const [showAllUrgency, setShowAllUrgency] = useState(false)
  const [view, setView] = useState<'list' | 'matrix'>('list')
  const [sortKey, setSortKey] = useState<SortKey>('status')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [highlightId, setHighlightId] = useState<string | null>(null)
  const [showScrollTop, setShowScrollTop] = useState(false)

  const tableRef = useRef<HTMLTableElement>(null)

  // Scroll-to-top visibility
  useEffect(() => {
    const handler = () => setShowScrollTop(window.scrollY > 400)
    handler()
    window.addEventListener('scroll', handler, { passive: true })
    return () => window.removeEventListener('scroll', handler)
  }, [])

  // Udled manglende kontrakter (virtuelle rows for pinned-panel)
  const missingRows = useMemo(() => {
    const rows: { companyId: string; companyName: string; missingType: string; missingLabel: string }[] = []
    for (const company of companies) {
      const companyTypes = new Set(contracts.filter((c) => c.companyId === company.id).map((c) => c.systemType))
      for (const req of REQUIRED_TYPES) {
        if (!companyTypes.has(req.key)) {
          rows.push({
            companyId: company.id,
            companyName: company.name,
            missingType: req.key,
            missingLabel: req.label,
          })
        }
      }
    }
    return rows
  }, [contracts, companies])

  // Filter
  const filtered = useMemo(() => {
    return contracts.filter((c) => {
      const derived = deriveStatus(c)
      if (statusFilter === 'expired' && derived !== 'expired') return false
      if (statusFilter === 'expiring' && derived !== 'expiring') return false
      if (statusFilter === 'active' && derived !== 'active') return false
      if (statusFilter === 'missing') return false
      if (search.trim()) {
        const q = search.toLowerCase()
        return (
          c.displayName.toLowerCase().includes(q) ||
          c.companyName.toLowerCase().includes(q) ||
          c.categoryLabel.toLowerCase().includes(q) ||
          c.systemType.toLowerCase().includes(q)
        )
      }
      return true
    })
  }, [contracts, search, statusFilter])

  const sorted = useMemo(() => sortContracts(filtered, sortKey, sortDir), [filtered, sortKey, sortDir])

  // Counts
  const counts = useMemo(() => {
    return {
      expired:  contracts.filter((c) => deriveStatus(c) === 'expired').length,
      expiring: contracts.filter((c) => deriveStatus(c) === 'expiring').length,
      active:   contracts.filter((c) => deriveStatus(c) === 'active').length,
      missing:  missingRows.length,
    }
  }, [contracts, missingRows.length])

  // Urgency items til pinned panel (max 5)
  const urgencyItems = useMemo(() => {
    const expired = contracts
      .filter((c) => deriveStatus(c) === 'expired')
      .sort((a, b) => (a.daysUntilExpiry ?? 0) - (b.daysUntilExpiry ?? 0))
    const expiring = contracts
      .filter((c) => deriveStatus(c) === 'expiring')
      .sort((a, b) => (a.daysUntilExpiry ?? 0) - (b.daysUntilExpiry ?? 0))

    const items: Array<
      | { kind: 'contract'; contract: ContractItem; status: DerivedStatus }
      | { kind: 'missing'; row: (typeof missingRows)[number] }
    > = []

    for (const c of expired) items.push({ kind: 'contract', contract: c, status: 'expired' })
    for (const m of missingRows) items.push({ kind: 'missing', row: m })
    for (const c of expiring) items.push({ kind: 'contract', contract: c, status: 'expiring' })

    return items
  }, [contracts, missingRows])

  const visibleUrgencyItems = showAllUrgency ? urgencyItems : urgencyItems.slice(0, 5)

  const totalAttention = counts.expired + counts.expiring + counts.missing

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  function jumpToContract(id: string) {
    setHighlightId(id)
    if (view !== 'list') setView('list')
    if (statusFilter !== 'all') setStatusFilter('all')
    requestAnimationFrame(() => {
      const el = document.getElementById(`row-${id}`)
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
    setTimeout(() => setHighlightId(null), 2000)
  }

  return (
    <div className="min-h-full bg-slate-50/60 p-8">
      <div className="max-w-[1280px] mx-auto">
        {/* Header */}
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-[20px] font-semibold tracking-tight text-slate-900">Kontrakter</h1>
            <p className="text-[13px] text-slate-500 mt-1">
              {contracts.length} kontrakter i porteføljen
              {(counts.expired + counts.expiring) > 0 && <> &middot; <span className="text-slate-700 font-medium">{counts.expired + counts.expiring} kræver handling</span></>}
              {counts.missing > 0 && <> &middot; <span className="text-violet-600 font-medium">{counts.missing} mangler</span></>}
            </p>
          </div>
          <Link
            href="/contracts/new"
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-900 text-white text-[12px] font-medium hover:bg-slate-800 transition-colors shadow-[0_1px_2px_rgba(15,23,42,0.1)] no-underline"
          >
            <Plus className="w-3.5 h-3.5" />
            Opret kontrakt
          </Link>
        </div>

        {/* Filter bar */}
        <div className="flex items-center gap-2 mb-4">
          <div className="flex-1 bg-white ring-1 ring-slate-900/[0.06] rounded-lg px-3.5 py-2.5 flex items-center gap-2.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            <Search className="w-4 h-4 text-slate-400 shrink-0" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Søg kontrakt, selskab, type..."
              className="flex-1 text-[13px] text-slate-700 placeholder:text-slate-400 bg-transparent outline-none"
            />
            <kbd className="bg-slate-100 ring-1 ring-slate-200 rounded px-1.5 py-0.5 text-[10px] text-slate-500 font-mono">⌘K</kbd>
          </div>

          {counts.expired > 0 && (
            <StatusPill
              dot="bg-rose-500"
              label={`${counts.expired} Udløbet`}
              active={statusFilter === 'expired'}
              onClick={() => {
                setStatusFilter(statusFilter === 'expired' ? 'all' : 'expired')
                setView('list')
              }}
            />
          )}
          <StatusPill
            dot="bg-amber-500"
            label={`${counts.expiring} Udløber`}
            active={statusFilter === 'expiring'}
            onClick={() => {
              setStatusFilter(statusFilter === 'expiring' ? 'all' : 'expiring')
              setView('list')
            }}
          />
          <StatusPill
            dot="bg-violet-500"
            label={`${counts.missing} Mangler`}
            active={statusFilter === 'missing'}
            onClick={() => {
              setStatusFilter(statusFilter === 'missing' ? 'all' : 'missing')
              setView('matrix')
            }}
          />
          <StatusPill
            dot="bg-emerald-500"
            label={`${counts.active} Aktive`}
            active={statusFilter === 'active'}
            onClick={() => {
              setStatusFilter(statusFilter === 'active' ? 'all' : 'active')
              setView('list')
            }}
          />

          {/* View toggle */}
          <div className="flex items-center bg-white ring-1 ring-slate-900/[0.06] rounded-lg p-0.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            <button
              type="button"
              onClick={() => setView('list')}
              className={cn(
                'flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[12px] font-medium transition-colors',
                view === 'list' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900',
              )}
            >
              <ListIcon className="w-3.5 h-3.5" />
              Liste
            </button>
            <button
              type="button"
              onClick={() => setView('matrix')}
              className={cn(
                'flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[12px] font-medium transition-colors',
                view === 'matrix' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900',
              )}
            >
              <Grid3x3 className="w-3.5 h-3.5" />
              Matrix
            </button>
          </div>
        </div>

        {/* Pinned "Kræver handling" panel */}
        {view === 'list' && urgencyItems.length > 0 && (
          <div className="bg-white rounded-xl ring-1 ring-slate-900/[0.06] shadow-[0_1px_2px_rgba(15,23,42,0.04)] mb-4 overflow-hidden">
            <button
              type="button"
              onClick={() => setShowUrgency(!showUrgency)}
              className="w-full flex items-center justify-between px-5 py-3 border-b border-slate-100 hover:bg-slate-50/40 transition-colors"
            >
              <div className="flex items-center gap-2">
                <AlertCircle className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-[12px] font-semibold text-slate-900">Kræver handling</span>
                <span className="text-[11px] text-slate-400">({totalAttention})</span>
              </div>
              <ChevronUp className={cn('w-3.5 h-3.5 text-slate-400 transition-transform', !showUrgency && 'rotate-180')} />
            </button>
            {showUrgency && <div className="divide-y divide-slate-50">
              {visibleUrgencyItems.map((item, idx) => {
                if (item.kind === 'contract') {
                  const derived = item.status
                  return (
                    <button
                      key={`urgent-${item.contract.id}-${idx}`}
                      type="button"
                      onClick={() => jumpToContract(item.contract.id)}
                      className="w-full flex items-center gap-3 px-5 py-2.5 hover:bg-slate-50/60 transition-colors text-left"
                    >
                      <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', statusDot(derived))} />
                      <div className="flex-1 min-w-0">
                        <div className="text-[12px] font-medium text-slate-900 truncate">{item.contract.displayName}</div>
                        <div className="text-[11px] text-slate-400 truncate">
                          {item.contract.companyName} &middot; {item.contract.categoryLabel}
                        </div>
                      </div>
                      <span className="text-[11px] text-slate-500 tabular-nums shrink-0">
                        {relativeDate(item.contract.daysUntilExpiry)}
                      </span>
                    </button>
                  )
                }
                return (
                  <Link
                    key={`missing-${item.row.companyId}-${item.row.missingType}-${idx}`}
                    href={`/companies/${item.row.companyId}`}
                    className="flex items-center gap-3 px-5 py-2.5 hover:bg-slate-50/60 transition-colors no-underline"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-violet-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-[12px] font-medium text-slate-900 truncate">
                        Mangler {item.row.missingLabel}
                      </div>
                      <div className="text-[11px] text-slate-400 truncate">{item.row.companyName}</div>
                    </div>
                    <span className="text-[11px] text-slate-500 shrink-0">Ingen</span>
                  </Link>
                )
              })}
              {totalAttention > 5 && (
                <div className="px-5 py-2 border-t border-slate-100">
                  <button
                    type="button"
                    className="text-[11px] font-medium text-slate-500 hover:text-slate-900"
                    onClick={() => setShowAllUrgency(!showAllUrgency)}
                  >
                    {showAllUrgency ? 'Vis færre' : `Vis alle ${totalAttention}`} →
                  </button>
                </div>
              )}
            </div>}
          </div>
        )}

        {/* LIST VIEW */}
        {view === 'list' && (
          <div className="bg-white rounded-xl ring-1 ring-slate-900/[0.06] shadow-[0_1px_2px_rgba(15,23,42,0.04)] [overflow:clip]">
            <table ref={tableRef} className="w-full text-[12px] border-collapse">
              <thead className="sticky top-0 z-10">
                <tr className="border-b border-slate-200 bg-white">
                  <Th label="Kontrakt"  active={sortKey === 'name'}     dir={sortDir} onClick={() => toggleSort('name')} />
                  <Th label="Selskab"   active={sortKey === 'company'}  dir={sortDir} onClick={() => toggleSort('company')} />
                  <Th label="Kategori"  active={sortKey === 'category'} dir={sortDir} onClick={() => toggleSort('category')} />
                  <Th label="Udløber"   active={sortKey === 'expiry'}   dir={sortDir} onClick={() => toggleSort('expiry')} />
                  <Th label="Status"    active={sortKey === 'status'}   dir={sortDir} onClick={() => toggleSort('status')} />
                </tr>
              </thead>
              <tbody>
                {sorted.map((c, idx) => {
                  const derived = deriveStatus(c)
                  const prevDerived = idx > 0 ? deriveStatus(sorted[idx - 1]) : null
                  const showSeparator = sortKey === 'status' && prevDerived !== null && prevDerived !== derived
                  const isHighlighted = highlightId === c.id
                  return (
                    <Fragment key={c.id}>
                      {showSeparator && (
                        <tr>
                          <td colSpan={5} className="px-4 py-2 bg-slate-50/60">
                            <div className="flex items-center gap-2 text-[10px] font-medium text-slate-400 uppercase tracking-[0.1em]">
                              <span className={cn('w-1 h-1 rounded-full', statusDot(derived))} />
                              {statusLabel(derived)}
                            </div>
                          </td>
                        </tr>
                      )}
                      <tr
                        id={`row-${c.id}`}
                        className={cn(
                          'border-b border-slate-100 transition-colors group/row [content-visibility:auto] [contain-intrinsic-size:auto_44px]',
                          isHighlighted ? 'bg-amber-50' : 'hover:bg-slate-50/60',
                        )}
                      >
                        <td className="px-4 py-3">
                          <Link
                            href={`/contracts/${c.id}`}
                            className="font-medium text-slate-900 group-hover/row:text-slate-950 no-underline"
                          >
                            {c.displayName}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          <Link href={`/companies/${c.companyId}`} className="text-slate-600 hover:text-slate-900 no-underline">
                            {c.companyName}
                          </Link>
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1.5 text-slate-600">
                            <span className={cn('w-1.5 h-1.5 rounded-full', CATEGORY_COLORS[c.categoryLabel] ?? 'bg-slate-400')} />
                            {c.categoryLabel}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-600 tabular-nums" title={c.expiryDate ?? ''}>
                          {relativeDate(c.daysUntilExpiry)}
                        </td>
                        <td className="px-4 py-3">
                          <span className={cn('inline-flex items-center gap-1.5 text-[10px] font-medium px-2 py-0.5 rounded', statusStyle(derived))}>
                            <span className={cn('w-1 h-1 rounded-full', statusDot(derived))} />
                            {statusLabel(derived)}
                          </span>
                        </td>
                      </tr>
                    </Fragment>
                  )
                })}
              </tbody>
            </table>

            {sorted.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <p className="text-[13px] text-slate-500 font-medium">Ingen kontrakter fundet</p>
                <p className="text-[11px] text-slate-400 mt-1">Prøv et andet søgeord eller filter</p>
              </div>
            )}

            {/* End-of-list footer */}
            {sorted.length > 0 && (
              <div className="px-5 py-3.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                <span>
                  {sorted.length === contracts.length
                    ? `${sorted.length} kontrakter \u00b7 Slut p\u00e5 listen`
                    : `Viser ${sorted.length} af ${contracts.length} kontrakter`}
                </span>
                <span className="text-[10px] text-slate-300">● ● ●</span>
              </div>
            )}
          </div>
        )}

        {/* MATRIX VIEW */}
        {view === 'matrix' && <MatrixView companies={companies} contracts={contracts} />}
      </div>

      {/* Scroll-to-top floating button */}
      <button
        type="button"
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        className={cn(
          'fixed bottom-6 right-6 w-10 h-10 rounded-full bg-slate-900 text-white flex items-center justify-center shadow-[0_4px_16px_-4px_rgba(15,23,42,0.3)] ring-1 ring-slate-900/10 transition-all duration-200',
          showScrollTop
            ? 'opacity-100 translate-y-0 pointer-events-auto'
            : 'opacity-0 translate-y-2 pointer-events-none',
        )}
        aria-label="Scroll til toppen"
      >
        <ChevronUp className="w-4 h-4" />
      </button>
    </div>
  )
}

// ---------------------------------------------------------------
// Matrix view
// ---------------------------------------------------------------
type CellStatus = 'active' | 'expiring' | 'expired' | 'missing'

function cellFor(companyId: string, typeKey: string, contracts: ContractItem[]): { status: CellStatus; contract?: ContractItem } {
  const matches = contracts.filter((c) => c.companyId === companyId && c.systemType === typeKey)
  if (matches.length === 0) return { status: 'missing' }
  const sorted = [...matches].sort((a, b) => {
    const rank = (c: ContractItem) => {
      if (c.status === 'UDLOEBET') return 0
      if (c.daysUntilExpiry != null && c.daysUntilExpiry <= 90) return 1
      return 2
    }
    return rank(a) - rank(b)
  })
  const top = sorted[0]
  if (top.status === 'UDLOEBET') return { status: 'expired', contract: top }
  if (top.daysUntilExpiry != null && top.daysUntilExpiry <= 90) return { status: 'expiring', contract: top }
  return { status: 'active', contract: top }
}

function MatrixView({
  companies,
  contracts,
}: {
  companies: CompanyItem[]
  contracts: ContractItem[]
}) {
  const [showAll, setShowAll] = useState(false)
  const [popover, setPopover] = useState<{ companyId: string; typeKey: string } | null>(null)

  const problemCompanies = useMemo(() => {
    return companies.filter((co) =>
      REQUIRED_TYPES.some((req) => cellFor(co.id, req.key, contracts).status !== 'active'),
    )
  }, [companies, contracts])

  const shownCompanies = showAll ? companies : problemCompanies

  return (
    <div className="bg-white rounded-xl ring-1 ring-slate-900/[0.06] shadow-[0_1px_2px_rgba(15,23,42,0.04)] overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
        <div>
          <div className="text-[12px] font-semibold text-slate-900">Dækningsmatrix</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Obligatoriske kontrakter pr. selskab</div>
        </div>
        <div className="flex items-center bg-slate-50 rounded-lg p-0.5 ring-1 ring-slate-900/[0.06]">
          <button
            type="button"
            onClick={() => setShowAll(false)}
            className={cn(
              'px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors',
              !showAll ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900',
            )}
          >
            Kun huller ({problemCompanies.length})
          </button>
          <button
            type="button"
            onClick={() => setShowAll(true)}
            className={cn(
              'px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors',
              showAll ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900',
            )}
          >
            Alle ({companies.length})
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="bg-slate-50/50 border-b border-slate-100">
              <th className="sticky left-0 bg-slate-50/95 backdrop-blur-sm px-4 py-2.5 text-left text-[10px] font-medium text-slate-500 uppercase tracking-[0.08em] min-w-[200px]">
                Selskab
              </th>
              {REQUIRED_TYPES.map((t) => (
                <th key={t.key} className="px-3 py-2.5 text-center text-[10px] font-medium text-slate-500 uppercase tracking-[0.08em] min-w-[100px]">
                  {t.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shownCompanies.map((co) => (
              <tr key={co.id} className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50/40">
                <td className="sticky left-0 bg-white/95 backdrop-blur-sm px-4 py-2.5 whitespace-nowrap">
                  <Link href={`/companies/${co.id}`} className="text-slate-900 font-medium no-underline hover:text-slate-950">
                    {co.name}
                  </Link>
                  {co.city && <div className="text-[10px] text-slate-400 mt-0.5">{co.city}</div>}
                </td>
                {REQUIRED_TYPES.map((t) => {
                  const cell = cellFor(co.id, t.key, contracts)
                  const isOpen = popover?.companyId === co.id && popover?.typeKey === t.key
                  return (
                    <td key={t.key} className="px-3 py-2.5 relative">
                      <button
                        type="button"
                        onClick={() => setPopover(isOpen ? null : { companyId: co.id, typeKey: t.key })}
                        className={cn(
                          'w-full h-8 rounded-md flex items-center justify-center transition-all',
                          cell.status === 'active' && 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700',
                          cell.status === 'expiring' && 'bg-amber-50 hover:bg-amber-100 text-amber-700',
                          cell.status === 'expired' && 'bg-rose-50 hover:bg-rose-100 text-rose-700',
                          cell.status === 'missing' && 'bg-violet-50 hover:bg-violet-100 text-violet-700 ring-1 ring-violet-200',
                        )}
                      >
                        {cell.status === 'active' && <span className="text-[13px]">✓</span>}
                        {cell.status === 'expiring' && (
                          <span className="text-[10px] font-semibold tabular-nums">{cell.contract?.daysUntilExpiry}d</span>
                        )}
                        {cell.status === 'expired' && <span className="text-[13px]">✕</span>}
                        {cell.status === 'missing' && <span className="text-[13px]">⊘</span>}
                      </button>

                      {/* Popover */}
                      {isOpen && (
                        <div className="absolute z-20 top-[calc(100%+6px)] left-1/2 -translate-x-1/2 bg-white rounded-lg p-3 min-w-[220px] ring-1 ring-slate-900/10 shadow-[0_12px_32px_-12px_rgba(15,23,42,0.3)] text-left">
                          <div className="flex items-center justify-between mb-2">
                            <div className="text-[10px] font-medium text-slate-400 uppercase tracking-[0.08em]">
                              {co.name} &middot; {t.label}
                            </div>
                            <button type="button" onClick={() => setPopover(null)} className="text-slate-400 hover:text-slate-900">
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                          {cell.contract ? (
                            <>
                              <div className="text-[12px] font-medium text-slate-900">{cell.contract.displayName}</div>
                              <div className="text-[11px] text-slate-500 mt-0.5">
                                {cell.status === 'expired'
                                  ? `Udløbet ${relativeDate(cell.contract.daysUntilExpiry)}`
                                  : cell.status === 'expiring'
                                  ? `Udløber ${relativeDate(cell.contract.daysUntilExpiry)}`
                                  : 'Aktiv'}
                              </div>
                              <Link
                                href={`/contracts/${cell.contract.id}`}
                                className="block mt-3 text-[11px] font-medium text-slate-900 hover:text-slate-700 no-underline"
                              >
                                Åbn kontrakt →
                              </Link>
                            </>
                          ) : (
                            <>
                              <div className="text-[12px] font-medium text-slate-900">Ingen aktiv kontrakt</div>
                              <div className="text-[11px] text-slate-500 mt-0.5">
                                Denne kontrakttype skal findes for alle selskaber.
                              </div>
                              <Link
                                href="/contracts/new"
                                className="mt-3 inline-block px-2.5 py-1.5 rounded-md bg-slate-900 text-white text-[11px] font-medium hover:bg-slate-800 no-underline"
                              >
                                + Opret {t.label.toLowerCase()}
                              </Link>
                            </>
                          )}
                        </div>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {shownCompanies.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <p className="text-[13px] text-emerald-600 font-medium">Alt under kontrol ✓</p>
          <p className="text-[11px] text-slate-400 mt-1">Ingen selskaber mangler obligatoriske kontrakter</p>
        </div>
      )}

      {/* Legend */}
      <div className="px-5 py-3 border-t border-slate-100 flex items-center gap-5 text-[11px] text-slate-500">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded bg-emerald-100 text-emerald-700 flex items-center justify-center text-[9px]">✓</span>
          Aktiv
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded bg-amber-100" /> Udløber snart
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded bg-rose-100" /> Udløbet
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded bg-violet-100 ring-1 ring-violet-200" /> Mangler
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------
// Small components
// ---------------------------------------------------------------
function StatusPill({
  dot,
  label,
  active,
  onClick,
}: {
  dot: string
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 px-3 py-2 rounded-lg text-[12px] font-medium transition-colors bg-white ring-1 shadow-[0_1px_2px_rgba(15,23,42,0.04)] shrink-0',
        active ? 'ring-slate-900/20 text-slate-900' : 'ring-slate-900/[0.06] text-slate-600 hover:text-slate-900',
      )}
    >
      <span className={cn('w-1.5 h-1.5 rounded-full', dot)} />
      {label}
    </button>
  )
}

function Th({
  label,
  active,
  dir,
  onClick,
}: {
  label: string
  active: boolean
  dir: 'asc' | 'desc'
  onClick: () => void
}) {
  return (
    <th
      className="px-4 py-2.5 text-[10px] font-medium text-slate-500 uppercase tracking-[0.08em] cursor-pointer select-none hover:text-slate-900 transition-colors text-left"
      onClick={onClick}
    >
      <span className="inline-flex items-center gap-1">
        <span className={cn(active && 'text-slate-900')}>{label}</span>
        {active && (dir === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}
      </span>
    </th>
  )
}
