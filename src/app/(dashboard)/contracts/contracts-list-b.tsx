'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
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
  AIBadge,
  Badge,
  type BadgeTone,
  Pager,
  BottomBar,
  Panel,
} from '@/components/ui/b'

// ────────────────────────────────────────────────────────────────────────────
// /contracts — klient-komponent.
//
// Tre view-modes: Flat (sortable table) · Grupperet (per selskab) · Kanban
// (4 status-kolonner). Filter-row med søg + 3 dropdowns + nulstil + view-toggle.
// ────────────────────────────────────────────────────────────────────────────

export interface ContractRow {
  id: string
  displayName: string
  type: string
  systemType: string
  ai: boolean
  companyId: string
  selskab: string
  parter: string
  vaerdi: string
  unit: string
  effektiv: string
  effektivSort: number
  udlob: string
  udlobDays: number // 9999 = ingen udløb; -1 = udløbet
  status: string
  rawStatus: string
  sensitivity: string
}

type ViewMode = 'flat' | 'grouped' | 'kanban'
type SortKey =
  | 'type'
  | 'selskab'
  | 'parter'
  | 'vaerdi'
  | 'effektivSort'
  | 'udlobDays'
  | 'status'
  | 'sensitivity'

const STATUS_OPTS = ['Alle', 'Aktiv', 'Udløber 30d', 'Udløbet', 'Opsagt']

// Map enum → display-label (case-insensitive) for URL-param normalisering.
// Fx ?status=AKTIV og ?status=Aktiv → begge matches til 'Aktiv'.
const STATUS_ENUM_MAP: Record<string, string> = {
  aktiv: 'Aktiv',
  'udlober 30d': 'Udløber 30d',
  udloebet: 'Udløbet',
  opsagt: 'Opsagt',
}

/**
 * Normalisér ?status URL-param til en af STATUS_OPTS-værdier.
 * Accepterer både enum (AKTIV) og display-label (Aktiv).
 * ?status=AKTIV&expiresWithin=30d → 'Udløber 30d' (combined case).
 */
function normalizeStatusParam(status: string | null, expiresWithin: string | null): string {
  if (!status && !expiresWithin) return 'Alle'
  // ?expiresWithin=30d overskriver status-værdien → 'Udløber 30d'
  if (expiresWithin === '30d') return 'Udløber 30d'
  if (!status) return 'Alle'
  const lower = status.toLowerCase()
  return STATUS_ENUM_MAP[lower] ?? STATUS_OPTS.find((o) => o.toLowerCase() === lower) ?? 'Alle'
}

function udlobTone(days: number): BadgeTone {
  if (days < 0) return 'red'
  if (days <= 30) return 'red'
  if (days <= 60) return 'amber'
  return 'gray'
}

function statusTone(status: string): BadgeTone {
  if (status === 'Aktiv') return 'green'
  if (status === 'Udløbet') return 'red'
  return 'gray'
}

function sensitivityTone(sens: string): BadgeTone {
  if (sens === 'INTERN') return 'blue'
  if (sens === 'FORTROLIG' || sens === 'STRENGT FORTROLIG') return 'amber'
  return 'gray'
}

// Forkort sensitivity-label så den passer i badge uden overflow.
// STRENGT FORTROLIG → STRENGT (samme tone, samme mening).
function shortSens(sens: string): string {
  if (sens === 'STRENGT FORTROLIG') return 'STRENGT'
  return sens
}

interface ContractsListBProps {
  contracts: ContractRow[]
  totalContracts: number
  /** Aktuel side (server-side) */
  page: number
  /** Sidestørrelse (server-side) */
  pageSize: number
}

export function ContractsListB(props: ContractsListBProps) {
  // 0-totalt empty-state. Vi tjekker mod totalContracts (utiltret server-tal)
  // så sensitivity/scope-filtre ikke triggers den. Splitter ud i content-
  // component så hooks ikke kaldes betinget (Rules of Hooks).
  if (props.totalContracts === 0) {
    return <EmptyContractsView />
  }
  return <ContractsListBContent {...props} />
}

function EmptyContractsView() {
  return (
    <>
      <Breadcrumb trail={[]} current="Kontrakter" />
      <PageHeader
        title="Kontrakter"
        meta="Ingen kontrakter oprettet endnu"
        actions={
          <BButton primary href="/contracts/new">
            + Opret kontrakt
          </BButton>
        }
      />
      <Panel>
        <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
          <div className="text-[14px] font-medium text-b-1">Ingen kontrakter endnu</div>
          <p className="max-w-md text-[13px] text-b-2">
            Opret den første kontrakt — lejekontrakt, ejeraftale, ansættelseskontrakt eller en af de
            øvrige 34 typer. Du kan uploade et PDF-dokument undervejs så AI ekstraherer vilkår
            automatisk.
          </p>
          <BButton primary href="/contracts/new">
            + Opret kontrakt
          </BButton>
        </div>
      </Panel>
    </>
  )
}

function ContractsListBContent({ contracts, totalContracts, page, pageSize }: ContractsListBProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [, startTransition] = useTransition()

  // Læs filter-state fra URL-params (server-side pagination: URL er kilden til sandhed)
  const viewMode = (searchParams.get('view') as ViewMode) || 'flat'
  const search = searchParams.get('search') ?? ''
  const statusFil = normalizeStatusParam(
    searchParams.get('status'),
    searchParams.get('expiresWithin')
  )
  const selskabFil = searchParams.get('company') ?? 'Alle'
  const typeFil = searchParams.get('type') ?? 'Alle'

  // Sorterings-state er stadig klient-side (inden for den aktuelle side)
  const [sortCol, setSortCol] = useState<SortKey>('udlobDays')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  // Synkronisér filter-state → URL (trigger server re-fetch via Next.js navigation)
  function pushUrl(overrides: Record<string, string>) {
    const sp = new URLSearchParams(searchParams.toString())
    for (const [k, v] of Object.entries(overrides)) {
      if (v === '' || v === 'Alle' || (v === '1' && k === 'page')) sp.delete(k)
      else sp.set(k, v)
    }
    // view=flat er default — udelad fra URL
    if (sp.get('view') === 'flat') sp.delete('view')
    startTransition(() => {
      router.push(`${pathname}?${sp.toString()}`, { scroll: false })
    })
  }

  // Klient-side sortering inden for den aktuelle side
  const sorted = useMemo(() => {
    const arr = [...contracts]
    arr.sort((a, b) => {
      const av = a[sortCol] as string | number
      const bv = b[sortCol] as string | number
      if (av < bv) return sortDir === 'asc' ? -1 : 1
      if (av > bv) return sortDir === 'asc' ? 1 : -1
      return 0
    })
    return arr
  }, [contracts, sortCol, sortDir])

  const aiCount = useMemo(() => contracts.filter((c) => c.ai).length, [contracts])
  const expiring30d = useMemo(
    () =>
      contracts.filter((c) => c.rawStatus === 'AKTIV' && c.udlobDays >= 0 && c.udlobDays <= 30)
        .length,
    [contracts]
  )

  const hasFilter =
    statusFil !== 'Alle' || selskabFil !== 'Alle' || typeFil !== 'Alle' || search.length > 0

  function handleSort(col: SortKey) {
    if (sortCol === col) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else {
      setSortCol(col)
      setSortDir('asc')
    }
  }

  function resetFilters() {
    pushUrl({ search: '', status: 'Alle', company: 'Alle', type: 'Alle', page: '1' })
  }

  function goTo(id: string) {
    router.push(`/contracts/${id}`)
  }

  const maxPage = Math.max(1, Math.ceil(totalContracts / pageSize))
  const firstItem = Math.min((page - 1) * pageSize + 1, totalContracts)
  const lastItem = Math.min(page * pageSize, totalContracts)

  return (
    <>
      <Breadcrumb trail={[]} current="Kontrakter" />

      <PageHeader
        title="Kontrakter"
        meta={
          <>
            {totalContracts} {totalContracts === 1 ? 'kontrakt' : 'aktive'}
            {expiring30d > 0 && (
              <>
                {' · '}
                <span className="font-medium text-b-amber-fg">
                  {expiring30d} udløber inden for 30 dage
                </span>
              </>
            )}
          </>
        }
        actions={
          <BButton primary href="/contracts/new">
            + Opret kontrakt
          </BButton>
        }
      />

      <FilterRow>
        <FilterSearch
          value={search}
          onChange={(v) => {
            pushUrl({ search: v, page: '1' })
          }}
          placeholder="Søg kontrakter..."
        />
        <FilterDropdown
          label="Status"
          options={STATUS_OPTS}
          value={statusFil}
          onChange={(v) => {
            pushUrl({ status: v, page: '1' })
          }}
        />
        {hasFilter && <FilterReset onClick={resetFilters} />}
        <FilterSep />
        <SegmentedToggle<ViewMode>
          value={viewMode}
          onChange={(v) => {
            pushUrl({ view: v })
          }}
          options={[
            { value: 'flat', label: 'Flat' },
            { value: 'grouped', label: 'Grupperet' },
            { value: 'kanban', label: 'Kanban' },
          ]}
        />
        <FilterSpacer />
        <ExportButton entity="contracts" label="Eksportér ▾" />
      </FilterRow>

      {hasFilter && (
        <div className="text-[11px] text-b-2">
          {totalContracts} {totalContracts === 1 ? 'resultat' : 'resultater'} — filtreret
        </div>
      )}

      {viewMode === 'flat' && (
        <FlatTable
          contracts={sorted}
          sortCol={sortCol}
          sortDir={sortDir}
          onSort={handleSort}
          onRowClick={goTo}
        />
      )}
      {viewMode === 'grouped' && <GroupedView contracts={sorted} onRowClick={goTo} />}
      {viewMode === 'kanban' && <KanbanView contracts={contracts} onRowClick={goTo} />}

      {viewMode !== 'kanban' && totalContracts > 0 && (
        <Pager
          info={
            viewMode === 'flat'
              ? `${firstItem}–${lastItem} af ${totalContracts}`
              : `${contracts.length} kontrakter på denne side · ${new Set(contracts.map((c) => c.selskab)).size} selskaber`
          }
          page={viewMode === 'flat' ? page : undefined}
          maxPage={viewMode === 'flat' ? maxPage : undefined}
          onPage={
            viewMode === 'flat'
              ? (n) => {
                  pushUrl({ page: String(n) })
                }
              : undefined
          }
          pageSize={viewMode === 'flat' ? pageSize : undefined}
          onPageSize={
            viewMode === 'flat'
              ? (n) => {
                  pushUrl({ pageSize: String(n), page: '1' })
                }
              : undefined
          }
        />
      )}

      <BottomBar
        left={
          <>
            {contracts.length} {contracts.length === 1 ? 'kontrakt' : 'kontrakter'} vist · {aiCount}{' '}
            AI-extracted
            {hasFilter && ` · ${totalContracts} totalt`}
          </>
        }
      />
    </>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// FlatTable — dense sortable.
// ────────────────────────────────────────────────────────────────────────────

function FlatTable({
  contracts,
  sortCol,
  sortDir,
  onSort,
  onRowClick,
}: {
  contracts: ContractRow[]
  sortCol: SortKey
  sortDir: 'asc' | 'desc'
  onSort: (col: SortKey) => void
  onRowClick: (id: string) => void
}) {
  if (contracts.length === 0) {
    return (
      <TableWrap>
        <TableEmpty>Ingen kontrakter matcher de aktive filtre.</TableEmpty>
      </TableWrap>
    )
  }

  return (
    <TableWrap>
      <table className="w-full table-fixed border-collapse">
        <thead>
          <tr>
            <Th col="type" sortCol={sortCol} sortDir={sortDir} onSort={onSort} width={148}>
              Type
            </Th>
            <Th col="selskab" sortCol={sortCol} sortDir={sortDir} onSort={onSort} width={175}>
              Selskab
            </Th>
            <Th col="parter" sortCol={sortCol} sortDir={sortDir} onSort={onSort} width={160}>
              Parter
            </Th>
            <Th
              col="vaerdi"
              sortCol={sortCol}
              sortDir={sortDir}
              onSort={onSort}
              width={110}
              alignRight
            >
              Værdi
            </Th>
            <Th col="effektivSort" sortCol={sortCol} sortDir={sortDir} onSort={onSort} width={82}>
              Effektiv
            </Th>
            <Th col="udlobDays" sortCol={sortCol} sortDir={sortDir} onSort={onSort} width={70}>
              Udløb
            </Th>
            <Th col="status" sortCol={sortCol} sortDir={sortDir} onSort={onSort} width={72}>
              Status
            </Th>
            <Th col="sensitivity" sortCol={sortCol} sortDir={sortDir} onSort={onSort} width={104}>
              Sens.
            </Th>
            <Th width={20}>{''}</Th>
          </tr>
        </thead>
        <tbody>
          {contracts.map((c) => (
            <ContractTr key={c.id} c={c} onClick={() => onRowClick(c.id)} />
          ))}
        </tbody>
      </table>
    </TableWrap>
  )
}

function ContractTr({
  c,
  onClick,
  hideSelskab,
}: {
  c: ContractRow
  onClick: () => void
  hideSelskab?: boolean
}) {
  return (
    <Tr onClick={onClick}>
      <Td width={148}>
        <div className="flex items-center gap-1.5">
          <span className="truncate">{c.type}</span>
          {c.ai && <AIBadge />}
        </div>
      </Td>
      {!hideSelskab && (
        <Td width={175} secondary>
          {c.selskab}
        </Td>
      )}
      <Td width={160} secondary>
        {c.parter}
      </Td>
      <Td width={110} alignRight>
        {c.vaerdi === '—' ? (
          <span className="text-b-border-strong">—</span>
        ) : (
          <>
            {c.vaerdi} {c.unit && <span className="text-[11px] text-b-3">{c.unit}</span>}
          </>
        )}
      </Td>
      <Td width={82} secondary>
        {c.effektiv}
      </Td>
      <Td width={70}>
        {c.udlob === '—' ? (
          <span className="text-b-border-strong">—</span>
        ) : (
          <Badge tone={udlobTone(c.udlobDays)}>{c.udlob}</Badge>
        )}
      </Td>
      <Td width={72}>
        <Badge tone={statusTone(c.status)}>{c.status}</Badge>
      </Td>
      <Td width={104}>
        <Badge tone={sensitivityTone(c.sensitivity)} className="text-[10px]">
          {shortSens(c.sensitivity)}
        </Badge>
      </Td>
      <Td width={20}>
        <span className="text-b-3">›</span>
      </Td>
    </Tr>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Grouped view — collapsible sektioner per selskab.
// ────────────────────────────────────────────────────────────────────────────

function GroupedView({
  contracts,
  onRowClick,
}: {
  contracts: ContractRow[]
  onRowClick: (id: string) => void
}) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  const groups = useMemo(() => {
    const map = new Map<string, ContractRow[]>()
    for (const c of contracts) {
      const arr = map.get(c.selskab) ?? []
      arr.push(c)
      map.set(c.selskab, arr)
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b, 'da-DK'))
  }, [contracts])

  if (contracts.length === 0) {
    return (
      <TableWrap>
        <TableEmpty>Ingen kontrakter matcher de aktive filtre.</TableEmpty>
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
        const hasAlert = rows.some((r) => r.udlobDays >= 0 && r.udlobDays <= 30)
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
                  hasAlert ? 'bg-b-red-bg text-b-red-fg' : 'bg-b-border text-b-gray-fg'
                }`}
              >
                {rows.length}
              </span>
              {hasAlert && (
                <Badge tone="red" className="text-[10px]">
                  ⚠ udløber
                </Badge>
              )}
            </button>
            {isOpen && (
              <table className="w-full table-fixed border-collapse">
                <tbody>
                  {rows.map((c) => (
                    <ContractTr key={c.id} c={c} hideSelskab onClick={() => onRowClick(c.id)} />
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
// Kanban view — 4 status-kolonner.
// ────────────────────────────────────────────────────────────────────────────

function KanbanView({
  contracts,
  onRowClick,
}: {
  contracts: ContractRow[]
  onRowClick: (id: string) => void
}) {
  const aktiv = contracts.filter((c) => c.rawStatus === 'AKTIV' && c.udlobDays > 30)
  const udlober = contracts.filter(
    (c) => c.rawStatus === 'AKTIV' && c.udlobDays >= 0 && c.udlobDays <= 30
  )
  const udloebet = contracts.filter(
    (c) => c.rawStatus === 'UDLOEBET' || (c.rawStatus === 'AKTIV' && c.udlobDays < 0)
  )
  const opsagt = contracts.filter((c) => c.rawStatus === 'OPSAGT')

  return (
    <div className="grid gap-2.5 lg:grid-cols-4 lg:items-start">
      <KanbanCol title="Aktiv" tone="default" items={aktiv} onRowClick={onRowClick} />
      <KanbanCol title="Udløber 30d" tone="amber" items={udlober} onRowClick={onRowClick} />
      <KanbanCol title="Udløbet" tone="red" items={udloebet} onRowClick={onRowClick} />
      <KanbanCol title="Opsagt" tone="gray" items={opsagt} onRowClick={onRowClick} />
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
  items: ContractRow[]
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
            <div className="flex items-center gap-1 text-[12px] font-medium text-b-1">
              <span className="truncate">{c.type}</span>
              {c.ai && <AIBadge />}
            </div>
            <div className="truncate text-[11px] text-b-2">{c.selskab}</div>
            <div className="flex flex-wrap gap-1">
              {c.udlob !== '—' && (
                <Badge tone={udlobTone(c.udlobDays)} className="text-[10px]">
                  {c.udlob}
                </Badge>
              )}
              <Badge tone={sensitivityTone(c.sensitivity)} className="text-[10px]">
                {c.sensitivity}
              </Badge>
            </div>
          </button>
        ))
      )}
    </Panel>
  )
}
