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
  SegmentedToggle,
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
} from '@/components/ui/b'

// ────────────────────────────────────────────────────────────────────────────
// /cases — klient-komponent. Følger samme arketype som /contracts.
// ────────────────────────────────────────────────────────────────────────────

export interface CaseRow {
  id: string
  nr: string
  type: string
  rawType: string
  title: string
  desc: string
  companyId: string | null
  selskab: string
  status: string
  rawStatus: string
  frist: string
  fristDays: number // 9999 = ingen frist
  ansvarlig: string
  updatedAt: number
}

type ViewMode = 'flat' | 'grouped' | 'kanban'
type SortKey = 'nr' | 'type' | 'selskab' | 'status' | 'fristDays' | 'ansvarlig'

const STATUS_OPTS = [
  'Alle',
  'Ny',
  'Aktiv',
  'Afventer ekstern',
  'Afventer klient',
  'Lukket',
  'Arkiveret',
]

function fristTone(days: number): BadgeTone {
  if (days < 0) return 'red'
  if (days <= 3) return 'red'
  if (days <= 14) return 'amber'
  return 'gray'
}

function statusTone(status: string): BadgeTone {
  switch (status) {
    case 'Ny':
      return 'blue'
    case 'Aktiv':
      return 'blue'
    case 'Afventer ekstern':
    case 'Afventer klient':
      return 'amber'
    case 'Lukket':
      return 'green'
    case 'Arkiveret':
      return 'gray'
    default:
      return 'gray'
  }
}

export function CasesListB({ cases, totalCount }: { cases: CaseRow[]; totalCount: number }) {
  const router = useRouter()

  const [viewMode, setViewMode] = useState<ViewMode>('flat')
  const [search, setSearch] = useState('')
  const [selskabFil, setSelskabFil] = useState('Alle')
  const [typeFil, setTypeFil] = useState('Alle')
  const [statusFil, setStatusFil] = useState('Alle')
  const [sortCol, setSortCol] = useState<SortKey>('fristDays')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const uniqueSelskaber = useMemo(
    () =>
      Array.from(new Set(cases.map((c) => c.selskab))).sort((a, b) => a.localeCompare(b, 'da-DK')),
    [cases]
  )
  const uniqueTypes = useMemo(() => Array.from(new Set(cases.map((c) => c.type))).sort(), [cases])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return cases.filter((c) => {
      if (
        q &&
        !c.title.toLowerCase().includes(q) &&
        !c.nr.toLowerCase().includes(q) &&
        !c.selskab.toLowerCase().includes(q) &&
        !c.type.toLowerCase().includes(q) &&
        !c.desc.toLowerCase().includes(q)
      ) {
        return false
      }
      if (selskabFil !== 'Alle' && c.selskab !== selskabFil) return false
      if (typeFil !== 'Alle' && c.type !== typeFil) return false
      if (statusFil !== 'Alle' && c.status !== statusFil) return false
      return true
    })
  }, [cases, search, selskabFil, typeFil, statusFil])

  const sorted = useMemo(() => {
    const arr = [...filtered]
    arr.sort((a, b) => {
      const av = a[sortCol] as string | number
      const bv = b[sortCol] as string | number
      if (av < bv) return sortDir === 'asc' ? -1 : 1
      if (av > bv) return sortDir === 'asc' ? 1 : -1
      return 0
    })
    return arr
  }, [filtered, sortCol, sortDir])

  const openCount = useMemo(
    () =>
      cases.filter(
        (c) =>
          c.rawStatus === 'NY' ||
          c.rawStatus === 'AKTIV' ||
          c.rawStatus === 'AFVENTER_EKSTERN' ||
          c.rawStatus === 'AFVENTER_KLIENT'
      ).length,
    [cases]
  )
  const closedCount = useMemo(
    () => cases.filter((c) => c.rawStatus === 'LUKKET' || c.rawStatus === 'ARKIVERET').length,
    [cases]
  )

  const hasFilter =
    selskabFil !== 'Alle' || typeFil !== 'Alle' || statusFil !== 'Alle' || search.length > 0

  function handleSort(col: SortKey) {
    if (sortCol === col) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else {
      setSortCol(col)
      setSortDir('asc')
    }
  }

  function resetFilters() {
    setSearch('')
    setSelskabFil('Alle')
    setTypeFil('Alle')
    setStatusFil('Alle')
    setPage(1)
  }

  function goTo(id: string) {
    router.push(`/cases/${id}`)
  }

  const maxPage = Math.max(1, Math.ceil(sorted.length / pageSize))
  const safePage = Math.min(page, maxPage)
  const paged = sorted.slice((safePage - 1) * pageSize, safePage * pageSize)

  return (
    <>
      <Breadcrumb trail={[]} current="Sager" />

      <PageHeader
        title="Sager"
        meta={
          <>
            {openCount} {openCount === 1 ? 'åben' : 'åbne'}
            {' · '}
            {closedCount} {closedCount === 1 ? 'afsluttet' : 'afsluttede'}
            {' · '}
            {totalCount} i alt
          </>
        }
        actions={
          <BButton primary href="/cases/new">
            + Opret sag
          </BButton>
        }
      />

      <FilterRow>
        <FilterSearch
          value={search}
          onChange={(v) => {
            setSearch(v)
            setPage(1)
          }}
          placeholder="Søg sager..."
        />
        <FilterDropdown
          label="Selskab"
          options={['Alle', ...uniqueSelskaber]}
          value={selskabFil}
          onChange={(v) => {
            setSelskabFil(v)
            setPage(1)
          }}
        />
        <FilterDropdown
          label="Type"
          divider="Sagstyper"
          options={['Alle', ...uniqueTypes]}
          value={typeFil}
          onChange={(v) => {
            setTypeFil(v)
            setPage(1)
          }}
        />
        <FilterDropdown
          label="Status"
          options={STATUS_OPTS}
          value={statusFil}
          onChange={(v) => {
            setStatusFil(v)
            setPage(1)
          }}
        />
        {hasFilter && <FilterReset onClick={resetFilters} />}
        <FilterSep />
        <SegmentedToggle<ViewMode>
          value={viewMode}
          onChange={setViewMode}
          options={[
            { value: 'flat', label: 'Flat' },
            { value: 'grouped', label: 'Grupperet' },
            { value: 'kanban', label: 'Kanban' },
          ]}
        />
        <FilterSpacer />
        <ExportButton entity="cases" label="Eksportér ▾" />
      </FilterRow>

      {hasFilter && (
        <div className="text-[11px] text-b-2">
          {sorted.length} {sorted.length === 1 ? 'resultat' : 'resultater'} — filtreret fra{' '}
          {totalCount} sager
        </div>
      )}

      {viewMode === 'flat' && (
        <FlatTable
          cases={paged}
          sortCol={sortCol}
          sortDir={sortDir}
          onSort={handleSort}
          onRowClick={goTo}
        />
      )}
      {viewMode === 'grouped' && <GroupedView cases={sorted} onRowClick={goTo} />}
      {viewMode === 'kanban' && <KanbanView cases={filtered} onRowClick={goTo} />}

      {viewMode !== 'kanban' && sorted.length > 0 && (
        <Pager
          info={
            viewMode === 'flat'
              ? `${Math.min((safePage - 1) * pageSize + 1, sorted.length)}–${Math.min(safePage * pageSize, sorted.length)} af ${sorted.length}`
              : `${sorted.length} sager · ${new Set(sorted.map((c) => c.selskab)).size} selskaber`
          }
          page={viewMode === 'flat' ? safePage : undefined}
          maxPage={viewMode === 'flat' ? maxPage : undefined}
          onPage={viewMode === 'flat' ? setPage : undefined}
          pageSize={viewMode === 'flat' ? pageSize : undefined}
          onPageSize={
            viewMode === 'flat'
              ? (n) => {
                  setPageSize(n)
                  setPage(1)
                }
              : undefined
          }
        />
      )}

      <BottomBar
        left={
          <>
            {sorted.length} {sorted.length === 1 ? 'sag' : 'sager'} vist · {closedCount} afsluttet
            {hasFilter && ` · filtreret fra ${totalCount}`}
          </>
        }
        right={
          <>
            <KbdHint k="⌘K" label="handling" />
            <span>·</span>
            <KbdHint k="N" label="ny sag" />
            <span>·</span>
            <KbdHint k="F" label="filter" />
          </>
        }
      />
    </>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// FlatTable
// ────────────────────────────────────────────────────────────────────────────

function FlatTable({
  cases,
  sortCol,
  sortDir,
  onSort,
  onRowClick,
}: {
  cases: CaseRow[]
  sortCol: SortKey
  sortDir: 'asc' | 'desc'
  onSort: (col: SortKey) => void
  onRowClick: (id: string) => void
}) {
  if (cases.length === 0) {
    return (
      <TableWrap>
        <TableEmpty>Ingen sager matcher de aktive filtre.</TableEmpty>
      </TableWrap>
    )
  }

  return (
    <TableWrap>
      <table className="w-full table-fixed border-collapse">
        <thead>
          <tr>
            <Th col="nr" sortCol={sortCol} sortDir={sortDir} onSort={onSort} width={104}>
              Nr.
            </Th>
            <Th col="type" sortCol={sortCol} sortDir={sortDir} onSort={onSort} width={130}>
              Type
            </Th>
            <Th col="selskab" sortCol={sortCol} sortDir={sortDir} onSort={onSort} width={200}>
              Selskab
            </Th>
            <Th>Beskrivelse</Th>
            <Th col="status" sortCol={sortCol} sortDir={sortDir} onSort={onSort} width={108}>
              Status
            </Th>
            <Th col="fristDays" sortCol={sortCol} sortDir={sortDir} onSort={onSort} width={84}>
              Frist
            </Th>
            <Th col="ansvarlig" sortCol={sortCol} sortDir={sortDir} onSort={onSort} width={110}>
              Ansv.
            </Th>
            <Th width={20}>{''}</Th>
          </tr>
        </thead>
        <tbody>
          {cases.map((c) => (
            <CaseTr key={c.id} c={c} onClick={() => onRowClick(c.id)} />
          ))}
        </tbody>
      </table>
    </TableWrap>
  )
}

function CaseTr({
  c,
  onClick,
  hideSelskab,
}: {
  c: CaseRow
  onClick: () => void
  hideSelskab?: boolean
}) {
  return (
    <Tr onClick={onClick}>
      <Td width={104} secondary>
        {c.nr}
      </Td>
      <Td width={130}>
        <span className="font-medium">{c.type}</span>
      </Td>
      {!hideSelskab && (
        <Td width={200} secondary>
          {c.selskab}
        </Td>
      )}
      <Td secondary>{c.title}</Td>
      <Td width={108}>
        <Badge tone={statusTone(c.status)}>{c.status}</Badge>
      </Td>
      <Td width={84}>
        {c.frist === '—' ? (
          <span className="text-b-border-strong">—</span>
        ) : (
          <Badge tone={fristTone(c.fristDays)}>{c.frist}</Badge>
        )}
      </Td>
      <Td width={110} secondary>
        {c.ansvarlig}
      </Td>
      <Td width={20}>
        <span className="text-b-3">›</span>
      </Td>
    </Tr>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// GroupedView — per selskab
// ────────────────────────────────────────────────────────────────────────────

function GroupedView({
  cases,
  onRowClick,
}: {
  cases: CaseRow[]
  onRowClick: (id: string) => void
}) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  const groups = useMemo(() => {
    const map = new Map<string, CaseRow[]>()
    for (const c of cases) {
      const arr = map.get(c.selskab) ?? []
      arr.push(c)
      map.set(c.selskab, arr)
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b, 'da-DK'))
  }, [cases])

  if (cases.length === 0) {
    return (
      <TableWrap>
        <TableEmpty>Ingen sager matcher de aktive filtre.</TableEmpty>
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
      {groups.map(([name, rows]) => {
        const isOpen = !collapsed.has(name)
        const hasUrgent = rows.some((r) => r.fristDays <= 3 && r.fristDays >= -365)
        return (
          <div key={name}>
            <button
              type="button"
              onClick={() => toggle(name)}
              className="flex w-full items-center gap-2 border-b border-b-border bg-b-row-hover px-3 py-1.5 text-left hover:bg-[#ecedf0]"
            >
              <span className="w-3 shrink-0 text-[10px] text-b-2">{isOpen ? '▾' : '▸'}</span>
              <span className="flex-1 text-[12px] font-semibold text-b-1">{name}</span>
              <span
                className={`b-tnum rounded-[10px] px-1.5 py-px text-[10px] font-semibold ${
                  hasUrgent ? 'bg-b-red-bg text-b-red-fg' : 'bg-b-border text-b-gray-fg'
                }`}
              >
                {rows.length}
              </span>
              {hasUrgent && (
                <Badge tone="red" className="text-[10px]">
                  ⚠
                </Badge>
              )}
            </button>
            {isOpen && (
              <table className="w-full table-fixed border-collapse">
                <tbody>
                  {rows.map((c) => (
                    <CaseTr key={c.id} c={c} hideSelskab onClick={() => onRowClick(c.id)} />
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
// KanbanView — 4 status-grupper
// ────────────────────────────────────────────────────────────────────────────

function KanbanView({ cases, onRowClick }: { cases: CaseRow[]; onRowClick: (id: string) => void }) {
  const aaben = cases.filter((c) => c.rawStatus === 'NY' || c.rawStatus === 'AKTIV')
  const afventer = cases.filter(
    (c) => c.rawStatus === 'AFVENTER_EKSTERN' || c.rawStatus === 'AFVENTER_KLIENT'
  )
  const lukket = cases.filter((c) => c.rawStatus === 'LUKKET')
  const arkiv = cases.filter((c) => c.rawStatus === 'ARKIVERET')

  return (
    <div className="grid gap-2.5 lg:grid-cols-4 lg:items-start">
      <KanbanCol title="Åben / Aktiv" tone="default" items={aaben} onRowClick={onRowClick} />
      <KanbanCol title="Afventer" tone="amber" items={afventer} onRowClick={onRowClick} />
      <KanbanCol title="Lukket" tone="default" items={lukket} onRowClick={onRowClick} />
      <KanbanCol title="Arkiveret" tone="gray" items={arkiv} onRowClick={onRowClick} />
    </div>
  )
}

function KanbanCol({
  title,
  tone,
  items,
  onRowClick,
}: {
  title: string
  tone: 'default' | 'amber' | 'red' | 'gray'
  items: CaseRow[]
  onRowClick: (id: string) => void
}) {
  const headerCls =
    tone === 'amber'
      ? 'bg-b-amber-bg text-b-amber-fg'
      : tone === 'red'
        ? 'bg-b-red-bg text-b-red-fg'
        : tone === 'gray'
          ? 'bg-b-gray-bg text-b-gray-fg'
          : 'bg-b-panel-h text-b-1'
  const countCls =
    tone === 'amber'
      ? 'bg-[#f5d673] text-b-amber-fg'
      : tone === 'red'
        ? 'bg-[#ffc1ba] text-b-red-fg'
        : 'bg-b-border text-b-gray-fg'

  return (
    <Panel>
      <div
        className={`flex items-center justify-between border-b border-b-border px-2.5 py-1.5 ${headerCls}`}
      >
        <span className="text-[11px] font-semibold uppercase" style={{ letterSpacing: '0.5px' }}>
          {title}
        </span>
        <span
          className={`b-tnum rounded-[10px] px-1.5 py-px text-[10px] font-semibold ${countCls}`}
        >
          {items.length}
        </span>
      </div>
      {items.length === 0 ? (
        <div className="px-3 py-2 text-[12px] text-b-3">Ingen</div>
      ) : (
        items.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => onRowClick(c.id)}
            className="flex w-full flex-col gap-1 border-b border-b-divider px-2.5 py-1.5 text-left last:border-b-0 hover:bg-b-row-hover"
          >
            <div className="flex items-center justify-between gap-2 text-[12px]">
              <span className="b-tnum text-b-2">{c.nr}</span>
              <Badge tone={statusTone(c.status)} className="text-[10px]">
                {c.status}
              </Badge>
            </div>
            <div className="truncate text-[12px] font-medium text-b-1">{c.title}</div>
            <div className="truncate text-[11px] text-b-2">{c.selskab}</div>
            <div className="flex flex-wrap gap-1">
              {c.frist !== '—' && (
                <Badge tone={fristTone(c.fristDays)} className="text-[10px]">
                  {c.frist}
                </Badge>
              )}
              <Badge tone="gray" className="text-[10px]">
                {c.ansvarlig}
              </Badge>
            </div>
          </button>
        ))
      )}
    </Panel>
  )
}
