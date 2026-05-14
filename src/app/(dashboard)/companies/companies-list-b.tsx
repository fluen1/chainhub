'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ExportButton } from '@/components/ui/export-button'
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
  TableWrap,
  Th,
  Tr,
  Td,
  TableEmpty,
  Badge,
  type BadgeTone,
  Pager,
  BottomBar,
  KbdHint,
  Panel,
  PanelHeader,
} from '@/components/ui/b'

// ────────────────────────────────────────────────────────────────────────────
// /companies — klient-komponent. Mest komplekse list-side.
// Layout:
//   1. Breadcrumb + PageHeader + 6-cell Strip
//   2. FilterRow (m. "⚠ Kritiske"-toggle + view-mode switcher)
//   3. Indhold = 2-col grid (tabel+rail) ved tabel/regioner-view, full-width ved kort
//      - venstre: Tabel / Regioner (grouped) / Kort (card-grid)
//      - højre rail (kun tabel/regioner): Health heatmap · Kritiske · Fordeling
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

function healthLabel(h: CompanyRow['health']): { label: string; tone: BadgeTone } {
  if (h === 'critical') return { label: 'Kritisk', tone: 'red' }
  if (h === 'warning') return { label: 'Opmærks.', tone: 'amber' }
  return { label: 'OK', tone: 'green' }
}

function healthDot(h: CompanyRow['health']): string {
  if (h === 'critical') return 'bg-b-red-fg'
  if (h === 'warning') return 'bg-b-amber-fg'
  return 'bg-b-green-fg'
}

function healthCellBg(h: CompanyRow['health']): string {
  if (h === 'critical') return 'bg-[#b91c1c]'
  if (h === 'warning') return 'bg-[#fdb8b1]'
  return 'bg-[#239a3b]'
}

interface CompaniesListBProps {
  companies: CompanyRow[]
  canCreate: boolean
  totalsExtra: { persons: number }
}

export function CompaniesListB(props: CompaniesListBProps) {
  // 0-totalt empty-state: ny kunde uden selskaber. Vi splitter ud i en
  // separat content-component så hooks ikke kaldes betinget (Rules of Hooks).
  if (props.companies.length === 0) {
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
              Bed en GROUP_OWNER eller GROUP_ADMIN om at oprette det første selskab.
            </p>
          )}
        </div>
      </Panel>
    </>
  )
}

function CompaniesListBContent({ companies, canCreate, totalsExtra }: CompaniesListBProps) {
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
  const [pageSize, setPageSize] = useState(15)

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

  // Strip-tal (over hele porteføljen — IKKE filteret)
  const totalCount = companies.length
  const coOwned = companies.filter((c) => c.kaedePct < 100).length
  const fullOwned = companies.filter((c) => c.kaedePct === 100).length
  const critical = companies.filter((c) => c.health === 'critical').length
  const totalRevenue = companies.reduce((sum, c) => sum + (c.revenue ?? 0), 0)
  const ytdShort =
    totalRevenue > 0 ? `${(totalRevenue / 1_000_000).toFixed(1).replace('.', ',')}m` : '—'

  const stripCells: StripCellData[] = [
    { num: totalCount, label: 'I porteføljen' },
    { num: coOwned, label: 'Co-ejet' },
    { num: fullOwned, label: '100% ejet' },
    { num: critical, label: 'Kræver opmærks.', color: critical > 0 ? 'red' : 'default' },
    { num: totalsExtra.persons, label: 'Personer i alt' },
    { num: ytdShort, label: 'Omsætning YTD', color: 'green' },
  ]

  const hasFilter =
    search.length > 0 || typeFil !== 'Alle' || regionFil !== 'Alle' || ejerFil !== 'Alle' || urgOnly

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

  const maxPage = Math.max(1, Math.ceil(sorted.length / pageSize))
  const safePage = Math.min(page, maxPage)
  const paged = sorted.slice((safePage - 1) * pageSize, safePage * pageSize)

  return (
    <>
      <Breadcrumb trail={[]} current="Selskaber" />

      <PageHeader
        title="Selskaber"
        meta={
          <>
            {totalCount} i porteføljen
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
        {hasFilter && <FilterReset onClick={resetFilters} />}
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
        <ExportButton entity="companies" label="Eksportér ▾" />
      </FilterRow>

      {hasFilter && (
        <div className="text-[11px] text-b-2">
          {sorted.length} {sorted.length === 1 ? 'resultat' : 'resultater'} — filtreret fra{' '}
          {totalCount} selskaber
        </div>
      )}

      {viewMode === 'kort' ? (
        <CardView companies={sorted} onRowClick={goTo} />
      ) : (
        <div className="grid gap-3 lg:grid-cols-[1fr_240px] lg:items-start">
          <div className="min-w-0">
            {viewMode === 'tabel' ? (
              <FlatTable
                companies={paged}
                sortCol={sortCol}
                sortDir={sortDir}
                onSort={handleSort}
                onRowClick={goTo}
              />
            ) : (
              <RegionsView companies={sorted} onRowClick={goTo} />
            )}
            {sorted.length > 0 && (
              <div className="mt-2">
                <Pager
                  info={
                    viewMode === 'tabel'
                      ? `${Math.min((safePage - 1) * pageSize + 1, sorted.length)}–${Math.min(safePage * pageSize, sorted.length)} af ${sorted.length}`
                      : `${sorted.length} ${sorted.length === 1 ? 'selskab' : 'selskaber'}`
                  }
                  page={viewMode === 'tabel' ? safePage : undefined}
                  maxPage={viewMode === 'tabel' ? maxPage : undefined}
                  onPage={viewMode === 'tabel' ? setPage : undefined}
                  pageSize={viewMode === 'tabel' ? pageSize : undefined}
                  onPageSize={
                    viewMode === 'tabel'
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
          <RightRail companies={companies} onRowClick={goTo} />
        </div>
      )}

      <BottomBar
        left={
          <>
            {sorted.length} {sorted.length === 1 ? 'selskab' : 'selskaber'} vist ·{' '}
            {companies.filter((c) => c.health === 'healthy').length} grønne
            {hasFilter && ` · filtreret fra ${totalCount}`}
          </>
        }
        right={
          <>
            <KbdHint k="⌘K" label="handling" />
            <span>·</span>
            <KbdHint k="N" label="nyt selskab" />
            <span>·</span>
            <KbdHint k="F" label="filter" />
          </>
        }
      />
    </>
  )
}

// ────────────────────────────────────────────────────────────────────────────

function FlatTable({
  companies,
  sortCol,
  sortDir,
  onSort,
  onRowClick,
}: {
  companies: CompanyRow[]
  sortCol: SortKey
  sortDir: 'asc' | 'desc'
  onSort: (col: SortKey) => void
  onRowClick: (id: string) => void
}) {
  if (companies.length === 0) {
    return (
      <TableWrap>
        <TableEmpty>Ingen selskaber matcher de aktive filtre.</TableEmpty>
      </TableWrap>
    )
  }
  return (
    <TableWrap>
      <table className="w-full table-fixed border-collapse">
        <thead>
          <tr>
            <Th col="navn" sortCol={sortCol} sortDir={sortDir} onSort={onSort}>
              Selskab
            </Th>
            <Th col="cvr" sortCol={sortCol} sortDir={sortDir} onSort={onSort} width={104}>
              CVR
            </Th>
            <Th col="type" sortCol={sortCol} sortDir={sortDir} onSort={onSort} width={92}>
              Type
            </Th>
            <Th
              col="kaedePct"
              sortCol={sortCol}
              sortDir={sortDir}
              onSort={onSort}
              width={74}
              alignRight
            >
              Kæde %
            </Th>
            <Th col="kontrakter" sortCol={sortCol} sortDir={sortDir} onSort={onSort} width={94}>
              Kontr.
            </Th>
            <Th col="sager" sortCol={sortCol} sortDir={sortDir} onSort={onSort} width={62}>
              Sager
            </Th>
            <Th
              col="ebitda"
              sortCol={sortCol}
              sortDir={sortDir}
              onSort={onSort}
              width={70}
              alignRight
            >
              EBITDA
            </Th>
            <Th col="sortScore" sortCol={sortCol} sortDir={sortDir} onSort={onSort} width={78}>
              Health
            </Th>
            <Th width={20}>{''}</Th>
          </tr>
        </thead>
        <tbody>
          {companies.map((c) => (
            <CompanyTr key={c.id} c={c} onClick={() => onRowClick(c.id)} />
          ))}
        </tbody>
      </table>
    </TableWrap>
  )
}

function CompanyTr({ c, onClick }: { c: CompanyRow; onClick: () => void }) {
  const hb = healthLabel(c.health)
  return (
    <Tr onClick={onClick}>
      <Td>
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 shrink-0 rounded-full ${healthDot(c.health)}`} />
          <span className="truncate font-medium text-b-1">{c.navn}</span>
        </div>
      </Td>
      <Td width={104} secondary>
        {c.cvr}
      </Td>
      <Td width={92} secondary>
        {c.type}
      </Td>
      <Td width={74} alignRight>
        <span className="font-medium">{c.kaedePct}%</span>
      </Td>
      <Td width={94}>
        {c.kontrakterUdlob > 0 || c.kontrakterExpired > 0 ? (
          <Badge tone={c.kontrakterExpired > 0 ? 'red' : 'amber'}>
            {c.kontrakter} ({c.kontrakterUdlob + c.kontrakterExpired}⚠)
          </Badge>
        ) : (
          <span className="text-b-2">{c.kontrakter}</span>
        )}
      </Td>
      <Td width={62}>
        {c.sager > 0 ? (
          <Badge tone={c.sager > 1 ? 'red' : 'amber'}>{c.sager}</Badge>
        ) : (
          <span className="text-b-border-strong">—</span>
        )}
      </Td>
      <Td width={70} alignRight>
        {c.ebitdaShort === '—' ? (
          <span className="text-b-border-strong">—</span>
        ) : (
          <span className="font-medium text-b-green-fg">{c.ebitdaShort}</span>
        )}
      </Td>
      <Td width={78}>
        <Badge tone={hb.tone}>{hb.label}</Badge>
      </Td>
      <Td width={20}>
        <span className="text-b-3">›</span>
      </Td>
    </Tr>
  )
}

// ────────────────────────────────────────────────────────────────────────────

function RegionsView({
  companies,
  onRowClick,
}: {
  companies: CompanyRow[]
  onRowClick: (id: string) => void
}) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  const groups = useMemo(() => {
    const map = new Map<Region, CompanyRow[]>()
    for (const c of companies) {
      const arr = map.get(c.region) ?? []
      arr.push(c)
      map.set(c.region, arr)
    }
    const order: Region[] = ['Kbh', 'Sjælland', 'Midt', 'Syd', 'Nord', 'Ukendt']
    return order.filter((r) => map.has(r)).map((r) => [r, map.get(r)!] as const)
  }, [companies])

  if (companies.length === 0) {
    return (
      <TableWrap>
        <TableEmpty>Ingen selskaber matcher de aktive filtre.</TableEmpty>
      </TableWrap>
    )
  }

  function toggle(name: string) {
    setCollapsed((prev) => {
      const n = new Set(prev)
      if (n.has(name)) n.delete(name)
      else n.add(name)
      return n
    })
  }

  return (
    <TableWrap>
      {groups.map(([region, rows]) => {
        const isOpen = !collapsed.has(region)
        const hasCritical = rows.some((r) => r.health === 'critical')
        return (
          <div key={region}>
            <button
              type="button"
              onClick={() => toggle(region)}
              className="flex w-full items-center gap-2 border-b border-b-border bg-b-row-hover px-3 py-1.5 text-left hover:bg-[#ecedf0]"
            >
              <span className="w-3 shrink-0 text-[10px] text-b-2">{isOpen ? '▾' : '▸'}</span>
              <span className="flex-1 text-[12px] font-semibold text-b-1">
                {REGION_LABEL[region]}
              </span>
              <span
                className={`b-tnum rounded-[10px] px-1.5 py-px text-[10px] font-semibold ${
                  hasCritical ? 'bg-b-red-bg text-b-red-fg' : 'bg-b-border text-b-gray-fg'
                }`}
              >
                {rows.length}
              </span>
              {hasCritical && (
                <Badge tone="red" className="text-[10px]">
                  ⚠
                </Badge>
              )}
            </button>
            {isOpen && (
              <table className="w-full table-fixed border-collapse">
                <tbody>
                  {rows.map((c) => (
                    <CompanyTr key={c.id} c={c} onClick={() => onRowClick(c.id)} />
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )
      })}
    </TableWrap>
  )
}

// ────────────────────────────────────────────────────────────────────────────

function CardView({
  companies,
  onRowClick,
}: {
  companies: CompanyRow[]
  onRowClick: (id: string) => void
}) {
  if (companies.length === 0) {
    return (
      <Panel>
        <div className="px-3 py-8 text-center text-[13px] text-b-3">
          Ingen selskaber matcher de aktive filtre.
        </div>
      </Panel>
    )
  }
  return (
    <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {companies.map((c) => {
        const hb = healthLabel(c.health)
        return (
          <button
            key={c.id}
            type="button"
            onClick={() => onRowClick(c.id)}
            className="flex flex-col gap-2 rounded-[4px] border border-b-border bg-b-panel p-2.5 text-left hover:border-b-border-strong hover:bg-b-row-hover"
          >
            <div className="flex items-start justify-between gap-2">
              <span className="min-w-0 truncate text-[13px] font-medium text-b-1">{c.navn}</span>
              <Badge tone={hb.tone} className="text-[10px]">
                {hb.label}
              </Badge>
            </div>
            <div className="truncate text-[11px] text-b-2">
              {c.type} · CVR {c.cvr}
              {c.city ? ` · ${c.city}` : ''}
            </div>
            <div className="flex flex-wrap gap-1">
              <Badge tone="gray" className="text-[10px]">
                {c.kaedePct}%
              </Badge>
              <Badge
                tone={c.kontrakterUdlob > 0 || c.kontrakterExpired > 0 ? 'amber' : 'gray'}
                className="text-[10px]"
              >
                {c.kontrakter} kontr.
              </Badge>
              {c.sager > 0 && (
                <Badge tone={c.sager > 1 ? 'red' : 'amber'} className="text-[10px]">
                  {c.sager} sager
                </Badge>
              )}
              {c.ebitda != null && (
                <Badge tone="green" className="text-[10px]">
                  {c.ebitdaShort}
                </Badge>
              )}
            </div>
          </button>
        )
      })}
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// RightRail — vises ved tabel/regioner. Mini-heatmap + kritiske + fordeling.
// ────────────────────────────────────────────────────────────────────────────

function RightRail({
  companies,
  onRowClick,
}: {
  companies: CompanyRow[]
  onRowClick: (id: string) => void
}) {
  // "Kræver opmærksomhed" inkluderer både critical (røde) og warning (amber)
  // — fælles begreb i UI'et. Heatmap-tæller skelner og viser kun "kritiske"
  // (røde) i counter-linjen så terminologi er konsistent med farve.
  const needsAttention = companies.filter((c) => c.health === 'critical' || c.health === 'warning')

  const byRegion = useMemo(() => {
    const m = new Map<Region, number>()
    for (const c of companies) m.set(c.region, (m.get(c.region) ?? 0) + 1)
    return m
  }, [companies])

  return (
    <aside className="flex flex-col gap-3">
      <Panel>
        <PanelHeader title="Health" meta={`${companies.length} sel.`} />
        <div className="grid grid-cols-6 gap-0.5 p-2">
          {companies.length === 0 ? (
            <div className="col-span-6 py-2 text-center text-[12px] text-b-3">Ingen selskaber</div>
          ) : (
            companies.map((c) => (
              <button
                key={c.id}
                type="button"
                title={`${c.navn} — ${healthLabel(c.health).label}`}
                onClick={() => onRowClick(c.id)}
                className={`aspect-square rounded-[2px] transition-transform hover:z-10 hover:scale-150 hover:shadow-md ${healthCellBg(c.health)}`}
              />
            ))
          )}
        </div>
        <div className="flex justify-between px-2 pb-2 text-[10px] text-b-2">
          <span>{companies.filter((c) => c.health === 'critical').length} kritiske</span>
          <span>{companies.filter((c) => c.health === 'healthy').length} OK</span>
        </div>
      </Panel>

      {needsAttention.length > 0 && (
        <Panel>
          <PanelHeader title="Kræver opmærksomhed" meta={`${needsAttention.length}`} />
          {needsAttention.slice(0, 8).map((c, i) => {
            const hb = healthLabel(c.health)
            const list = needsAttention.slice(0, 8)
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => onRowClick(c.id)}
                className={`flex w-full items-center justify-between gap-2 px-3 py-1 text-left hover:bg-b-row-hover ${
                  i < list.length - 1 ? 'border-b border-b-divider' : ''
                }`}
              >
                <span className="min-w-0 truncate text-[12px] text-b-1">{c.navn}</span>
                <Badge tone={hb.tone} className="shrink-0 text-[10px]">
                  {hb.label}
                </Badge>
              </button>
            )
          })}
        </Panel>
      )}

      <Panel>
        <PanelHeader title="Fordeling" />
        <div className="py-1">
          <RailRow label="100% ejet" value={companies.filter((c) => c.kaedePct === 100).length} />
          <RailRow label="Co-ejet" value={companies.filter((c) => c.kaedePct < 100).length} />
          <div className="my-1 border-t border-b-divider" />
          {(['Kbh', 'Sjælland', 'Midt', 'Syd', 'Nord'] as Region[]).map((r) => (
            <RailRow key={r} label={REGION_LABEL[r]} value={byRegion.get(r) ?? 0} />
          ))}
        </div>
      </Panel>
    </aside>
  )
}

function RailRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between px-3 py-1 text-[11px]">
      <span className="text-b-2">{label}</span>
      <span className="b-tnum font-medium text-b-1">{value}</span>
    </div>
  )
}
