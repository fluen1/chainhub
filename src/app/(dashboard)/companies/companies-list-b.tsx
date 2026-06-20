'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import { CompaniesCardView } from '@/components/companies/CompaniesCardView'
import { CompaniesRightRail } from '@/components/companies/CompaniesRightRail'
import { CompaniesFlatTable } from '@/components/companies/CompaniesTableViews'
import { CompaniesRegionsView } from '@/components/companies/CompaniesTableViews'
import {
  Breadcrumb,
  PageHeader,
  BButton,
  FilterRow,
  FilterSearch,
  FilterDropdown,
  FilterReset,
  FilterSep,
  FilterSpacer,
  FilterButton,
  SegmentedToggle,
  Strip,
  type StripCellData,
  Pager,
  BottomBar,
  Panel,
} from '@/components/ui/b'
import { ExportButton } from '@/components/ui/export-button'

// ────────────────────────────────────────────────────────────────────────────
// /companies — klient-komponent. Mest komplekse list-side.
// Layout:
//   1. Breadcrumb + PageHeader + 6-cell Strip
//   2. FilterRow (m. "⚠ Kritiske"-toggle + view-mode switcher)
//   3. Indhold = 2-col grid (tabel+rail) ved tabel/regioner-view, full-width ved kort
// ────────────────────────────────────────────────────────────────────────────

type Region = 'Kbh' | 'Sjælland' | 'Syd' | 'Midt' | 'Nord' | 'Ukendt'

export interface CompanyRow {
  id: string
  navn: string
  cvr: string
  type: string
  region: Region
  city: string | null
  kaedePct: number
  kontrakter: number
  kontrakterUdlob: number
  kontrakterExpired: number
  sager: number
  ebitda: number | null
  ebitdaShort: string
  revenue: number | null
  health: 'critical' | 'warning' | 'healthy'
  sortScore: number
}

type ViewMode = 'tabel' | 'regioner' | 'kort'
type SortKey =
  | 'navn'
  | 'cvr'
  | 'type'
  | 'kaedePct'
  | 'kontrakter'
  | 'sager'
  | 'ebitda'
  | 'sortScore'

const EJER_OPTS = ['Alle', '100% ejet', 'Co-ejet (>50%)', 'Co-ejet (=50%)']
const REGION_OPTS = ['Alle', 'København', 'Sjælland', 'Syd', 'Midt', 'Nord']
const REGION_LABEL: Record<Region, string> = {
  Kbh: 'København',
  Sjælland: 'Sjælland',
  Syd: 'Syd- og Sønderjylland',
  Midt: 'Midtjylland',
  Nord: 'Nordjylland',
  Ukendt: 'Ukendt region',
}

interface CompaniesListBProps {
  companies: CompanyRow[]
  canCreate: boolean
  totalsExtra: { persons: number }
  totalCount: number
  page: number
  pageSize: number
}

export function CompaniesListB(props: CompaniesListBProps) {
  if (props.companies.length === 0 && props.totalCount === 0) {
    return <EmptyCompaniesView canCreate={props.canCreate} />
  }
  return <CompaniesListBContent {...props} />
}

function EmptyCompaniesView({ canCreate }: { canCreate: boolean }) {
  return (
    <>
      <Breadcrumb trail={[]} current="Selskaber" />
      <PageHeader
        title="Selskaber"
        meta="Ingen selskaber i porteføljen endnu"
        actions={
          canCreate ? (
            <BButton primary href="/companies/new">
              + Opret selskab
            </BButton>
          ) : null
        }
      />
      <Panel>
        <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
          <div className="text-[14px] font-medium text-b-1">Velkommen til ChainHub</div>
          <p className="max-w-md text-[13px] text-b-2">
            Opret dit første selskab for at komme i gang. ChainHub samler kontrakter, sager, opgaver
            og dokumenter ét sted — på tværs af alle dine lokationer.
          </p>
          {canCreate ? (
            <BButton primary href="/companies/new">
              + Opret dit første selskab
            </BButton>
          ) : (
            <p className="text-[12px] text-b-3">
              Bed en kædeejer eller administrator om at oprette det første selskab.
            </p>
          )}
        </div>
      </Panel>
    </>
  )
}

function CompaniesListBContent({
  companies,
  canCreate,
  totalsExtra,
  totalCount: serverTotalCount,
  page: serverPage,
  pageSize: serverPageSize,
}: CompaniesListBProps) {
  const router = useRouter()

  const [viewMode, setViewMode] = useState<ViewMode>('tabel')
  const [search, setSearch] = useState('')
  const [typeFil, setTypeFil] = useState('Alle')
  const [regionFil, setRegionFil] = useState('Alle')
  const [ejerFil, setEjerFil] = useState('Alle')
  const [urgOnly, setUrgOnly] = useState(false)
  const [sortCol, setSortCol] = useState<SortKey>('sortScore')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(serverPageSize)

  const uniqueTypes = useMemo(
    () => Array.from(new Set(companies.map((c) => c.type))).sort(),
    [companies]
  )

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return companies.filter((c) => {
      if (
        q &&
        !c.navn.toLowerCase().includes(q) &&
        !c.cvr.includes(q) &&
        !(c.city ?? '').toLowerCase().includes(q) &&
        !REGION_LABEL[c.region].toLowerCase().includes(q)
      ) {
        return false
      }
      if (typeFil !== 'Alle' && c.type !== typeFil) return false
      if (regionFil !== 'Alle') {
        const wanted = (
          {
            København: 'Kbh',
            Sjælland: 'Sjælland',
            Syd: 'Syd',
            Midt: 'Midt',
            Nord: 'Nord',
          } as Record<string, Region>
        )[regionFil]
        if (wanted && c.region !== wanted) return false
      }
      if (ejerFil === '100% ejet' && c.kaedePct !== 100) return false
      if (ejerFil === 'Co-ejet (>50%)' && (c.kaedePct === 100 || c.kaedePct <= 50)) return false
      if (ejerFil === 'Co-ejet (=50%)' && c.kaedePct !== 50) return false
      if (urgOnly && c.health === 'healthy') return false
      return true
    })
  }, [companies, search, typeFil, regionFil, ejerFil, urgOnly])

  const sorted = useMemo(() => {
    const arr = [...filtered]
    arr.sort((a, b) => {
      const av = a[sortCol] as string | number
      const bv = b[sortCol] as string | number
      if (av == null && bv != null) return 1
      if (av != null && bv == null) return -1
      if (av < bv) return sortDir === 'asc' ? -1 : 1
      if (av > bv) return sortDir === 'asc' ? 1 : -1
      return 0
    })
    return arr
  }, [filtered, sortCol, sortDir])

  const coOwned = companies.filter((c) => c.kaedePct < 100).length
  const fullOwned = companies.filter((c) => c.kaedePct === 100).length
  const critical = companies.filter((c) => c.health === 'critical').length
  const totalRevenue = companies.reduce((sum, c) => sum + (c.revenue ?? 0), 0)
  const ytdShort =
    totalRevenue > 0 ? `${(totalRevenue / 1_000_000).toFixed(1).replace('.', ',')}m` : '—'

  const stripCells: StripCellData[] = [
    { num: serverTotalCount, label: 'I porteføljen' },
    { num: coOwned, label: 'Co-ejet' },
    { num: fullOwned, label: '100% ejet' },
    { num: critical, label: 'Kræver opmærks.', color: critical > 0 ? 'red' : 'default' },
    { num: totalsExtra.persons, label: 'Personer i alt' },
    { num: ytdShort, label: 'Omsætning YTD', color: 'green' },
  ]

  function handleSort(col: SortKey) {
    if (sortCol === col) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else {
      setSortCol(col)
      setSortDir('asc')
    }
  }

  function resetFilters() {
    setSearch('')
    setTypeFil('Alle')
    setRegionFil('Alle')
    setEjerFil('Alle')
    setUrgOnly(false)
    setPage(1)
  }

  function goTo(id: string) {
    router.push(`/companies/${id}`)
  }

  // Server-side pagination: navigate to ?page=N when no client filter is active
  const hasClientFilter =
    search.length > 0 || typeFil !== 'Alle' || regionFil !== 'Alle' || ejerFil !== 'Alle' || urgOnly

  const serverMaxPage = Math.max(1, Math.ceil(serverTotalCount / serverPageSize))

  function goToServerPage(n: number) {
    const sp = new URLSearchParams()
    if (n > 1) sp.set('page', String(n))
    router.push(`/companies${sp.toString() ? `?${sp.toString()}` : ''}`, { scroll: false })
  }

  // When no client filter is active, use server-side paging directly
  const maxPage = hasClientFilter ? Math.max(1, Math.ceil(sorted.length / pageSize)) : serverMaxPage
  const safePage = hasClientFilter ? Math.min(page, maxPage) : serverPage
  const paged = hasClientFilter
    ? sorted.slice((safePage - 1) * pageSize, safePage * pageSize)
    : sorted

  return (
    <>
      <Breadcrumb trail={[]} current="Selskaber" />

      <PageHeader
        title="Selskaber"
        meta={
          <>
            {serverTotalCount} i porteføljen
            {' · '}
            <span className="font-medium text-b-red-fg">{critical} kræver opmærksomhed</span>
            {' · '}
            Omsætning YTD <span className="font-medium text-b-green-fg">{ytdShort}</span>
          </>
        }
        actions={
          canCreate ? (
            <BButton primary href="/companies/new">
              + Opret selskab
            </BButton>
          ) : null
        }
      />

      <Strip cells={stripCells} />

      <FilterRow>
        <FilterSearch
          value={search}
          onChange={(v) => {
            setSearch(v)
            setPage(1)
          }}
          placeholder="Søg selskaber..."
        />
        <FilterDropdown
          label="Type"
          options={['Alle', ...uniqueTypes]}
          value={typeFil}
          onChange={(v) => {
            setTypeFil(v)
            setPage(1)
          }}
        />
        <FilterDropdown
          label="Region"
          options={REGION_OPTS}
          value={regionFil}
          onChange={(v) => {
            setRegionFil(v)
            setPage(1)
          }}
        />
        <FilterDropdown
          label="Ejerskab"
          options={EJER_OPTS}
          value={ejerFil}
          onChange={(v) => {
            setEjerFil(v)
            setPage(1)
          }}
        />
        <FilterButton
          active={urgOnly}
          onClick={() => {
            setUrgOnly((v) => !v)
            setPage(1)
          }}
        >
          {urgOnly ? '⚠ Kritiske ×' : '⚠ Kritiske'}
        </FilterButton>
        {hasClientFilter && <FilterReset onClick={resetFilters} />}
        <FilterSep />
        <SegmentedToggle<ViewMode>
          value={viewMode}
          onChange={setViewMode}
          options={[
            { value: 'tabel', label: 'Tabel' },
            { value: 'regioner', label: 'Regioner' },
            { value: 'kort', label: 'Kort' },
          ]}
        />
        <FilterSpacer />
        <ExportButton entity="companies" label="Eksportér CSV" />
      </FilterRow>

      {hasClientFilter && (
        <div className="text-[11px] text-b-2">
          {sorted.length} {sorted.length === 1 ? 'resultat' : 'resultater'} — filtreret fra{' '}
          {companies.length} selskaber på denne side
        </div>
      )}

      {viewMode === 'kort' ? (
        <CompaniesCardView companies={sorted} onRowClick={goTo} />
      ) : (
        <div className="grid gap-3 lg:grid-cols-[1fr_240px] lg:items-start">
          <div className="min-w-0">
            {viewMode === 'tabel' ? (
              <CompaniesFlatTable
                companies={paged}
                sortCol={sortCol}
                sortDir={sortDir}
                onSort={handleSort}
                onRowClick={goTo}
              />
            ) : (
              <CompaniesRegionsView companies={sorted} onRowClick={goTo} />
            )}
            {(sorted.length > 0 || !hasClientFilter) && (
              <div className="mt-2">
                <Pager
                  info={
                    viewMode === 'tabel'
                      ? hasClientFilter
                        ? `${Math.min((safePage - 1) * pageSize + 1, sorted.length)}–${Math.min(safePage * pageSize, sorted.length)} af ${sorted.length}`
                        : `${Math.min((serverPage - 1) * serverPageSize + 1, serverTotalCount)}–${Math.min(serverPage * serverPageSize, serverTotalCount)} af ${serverTotalCount}`
                      : `${serverTotalCount} ${serverTotalCount === 1 ? 'selskab' : 'selskaber'}`
                  }
                  page={viewMode === 'tabel' ? safePage : undefined}
                  maxPage={viewMode === 'tabel' ? maxPage : undefined}
                  onPage={
                    viewMode === 'tabel' ? (hasClientFilter ? setPage : goToServerPage) : undefined
                  }
                  pageSize={
                    viewMode === 'tabel' ? (hasClientFilter ? pageSize : serverPageSize) : undefined
                  }
                  onPageSize={
                    viewMode === 'tabel' && hasClientFilter
                      ? (n) => {
                          setPageSize(n)
                          setPage(1)
                        }
                      : undefined
                  }
                  sizes={[15, 25, 50]}
                />
              </div>
            )}
          </div>
          <CompaniesRightRail companies={companies} onRowClick={goTo} />
        </div>
      )}

      <BottomBar
        left={
          <>
            {hasClientFilter ? sorted.length : serverTotalCount}{' '}
            {(hasClientFilter ? sorted.length : serverTotalCount) === 1 ? 'selskab' : 'selskaber'} i
            alt · {companies.filter((c) => c.health === 'healthy').length} grønne på denne side
            {hasClientFilter && ` · filtreret fra ${companies.length} på siden`}
          </>
        }
      />
    </>
  )
}
