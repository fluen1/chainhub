'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
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
// /tasks — klient-komponent.
// Følger samme arketype som /contracts og /cases. Ekstra: "Mine opgaver"-toggle.
// ────────────────────────────────────────────────────────────────────────────

export interface TaskRow {
  id: string
  nr: string
  titel: string
  selskab: string
  type: string
  prio: string
  rawPrio: string
  status: string
  rawStatus: string
  frist: string
  fristDays: number
  ansvarlig: string
  isMine: boolean
}

type ViewMode = 'flat' | 'grouped' | 'kanban'
type SortKey =
  | 'nr'
  | 'titel'
  | 'selskab'
  | 'type'
  | 'rawPrio'
  | 'rawStatus'
  | 'fristDays'
  | 'ansvarlig'

const PRIO_OPTS = ['Alle', 'Kritisk', 'Høj', 'Mellem', 'Lav']
const STATUS_OPTS = ['Alle', 'Ny', 'Afventer', 'Lukket']

function prioTone(rawPrio: string): BadgeTone {
  switch (rawPrio) {
    case 'KRITISK':
      return 'red'
    case 'HOEJ':
      return 'amber'
    case 'MELLEM':
      return 'blue'
    default:
      return 'gray'
  }
}

function statusTone(rawStatus: string): BadgeTone {
  switch (rawStatus) {
    case 'NY':
      return 'gray'
    case 'AKTIV_TASK':
      return 'blue'
    case 'AFVENTER':
      return 'amber'
    case 'LUKKET':
      return 'green'
    default:
      return 'gray'
  }
}

function fristTone(days: number): BadgeTone {
  if (days >= 9999) return 'gray'
  if (days < 0) return 'red'
  if (days <= 1) return 'red'
  if (days <= 7) return 'amber'
  return 'gray'
}

export function TasksListB({ tasks, totalCount }: { tasks: TaskRow[]; totalCount: number }) {
  const router = useRouter()

  const [viewMode, setViewMode] = useState<ViewMode>('flat')
  const [search, setSearch] = useState('')
  const [mineOnly, setMineOnly] = useState(false)
  const [selskabFil, setSelskabFil] = useState('Alle')
  const [typeFil, setTypeFil] = useState('Alle')
  const [prioFil, setPrioFil] = useState('Alle')
  const [statusFil, setStatusFil] = useState('Alle')
  const [sortCol, setSortCol] = useState<SortKey>('fristDays')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(15)

  const uniqueSelskaber = useMemo(
    () =>
      Array.from(new Set(tasks.map((t) => t.selskab).filter((s) => s !== '—'))).sort((a, b) =>
        a.localeCompare(b, 'da-DK')
      ),
    [tasks]
  )
  const uniqueTypes = useMemo(() => Array.from(new Set(tasks.map((t) => t.type))).sort(), [tasks])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return tasks.filter((t) => {
      if (
        q &&
        !t.titel.toLowerCase().includes(q) &&
        !t.selskab.toLowerCase().includes(q) &&
        !t.nr.toLowerCase().includes(q)
      ) {
        return false
      }
      if (mineOnly && !t.isMine) return false
      if (selskabFil !== 'Alle' && t.selskab !== selskabFil) return false
      if (typeFil !== 'Alle' && t.type !== typeFil) return false
      if (prioFil !== 'Alle' && t.prio !== prioFil) return false
      if (statusFil !== 'Alle' && t.status !== statusFil) return false
      return true
    })
  }, [tasks, search, mineOnly, selskabFil, typeFil, prioFil, statusFil])

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

  const openCount = useMemo(() => tasks.filter((t) => t.rawStatus !== 'LUKKET').length, [tasks])
  const critCount = useMemo(
    () => tasks.filter((t) => t.rawPrio === 'KRITISK' && t.rawStatus !== 'LUKKET').length,
    [tasks]
  )
  const overdueCount = useMemo(
    () =>
      tasks.filter((t) => t.fristDays <= 1 && t.fristDays < 9999 && t.rawStatus !== 'LUKKET')
        .length,
    [tasks]
  )

  const hasFilter =
    search.length > 0 ||
    mineOnly ||
    selskabFil !== 'Alle' ||
    typeFil !== 'Alle' ||
    prioFil !== 'Alle' ||
    statusFil !== 'Alle'

  function handleSort(col: SortKey) {
    if (sortCol === col) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else {
      setSortCol(col)
      setSortDir('asc')
    }
  }

  function resetFilters() {
    setSearch('')
    setMineOnly(false)
    setSelskabFil('Alle')
    setTypeFil('Alle')
    setPrioFil('Alle')
    setStatusFil('Alle')
    setPage(1)
  }

  function goTo(id: string) {
    router.push(`/tasks/${id}`)
  }

  const maxPage = Math.max(1, Math.ceil(sorted.length / pageSize))
  const safePage = Math.min(page, maxPage)
  const paged = sorted.slice((safePage - 1) * pageSize, safePage * pageSize)

  return (
    <>
      <Breadcrumb trail={[]} current="Opgaver" />

      <PageHeader
        title="Opgaver"
        meta={
          <>
            <span className="font-medium text-b-red-fg">{critCount} kritiske</span>
            {' · '}
            <span className="font-medium text-b-amber-fg">{overdueCount} frist i dag/morgen</span>
            {' · '}
            {openCount} åbne i alt
          </>
        }
        actions={
          <BButton primary href="/tasks/new">
            + Opret opgave
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
          placeholder="Søg opgaver..."
        />
        <FilterButton
          active={mineOnly}
          onClick={() => {
            setMineOnly((v) => !v)
            setPage(1)
          }}
        >
          {mineOnly ? '✓ Mine opgaver' : 'Mine opgaver'}
        </FilterButton>
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
          divider="Opgavetyper"
          options={['Alle', ...uniqueTypes]}
          value={typeFil}
          onChange={(v) => {
            setTypeFil(v)
            setPage(1)
          }}
        />
        <FilterDropdown
          label="Prioritet"
          options={PRIO_OPTS}
          value={prioFil}
          onChange={(v) => {
            setPrioFil(v)
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
        <FilterButton>Eksportér ▾</FilterButton>
      </FilterRow>

      {hasFilter && (
        <div className="text-[11px] text-b-2">
          {sorted.length} {sorted.length === 1 ? 'resultat' : 'resultater'} — filtreret fra{' '}
          {totalCount} opgaver
        </div>
      )}

      {viewMode === 'flat' && (
        <FlatTable
          tasks={paged}
          sortCol={sortCol}
          sortDir={sortDir}
          onSort={handleSort}
          onRowClick={goTo}
        />
      )}
      {viewMode === 'grouped' && <GroupedView tasks={sorted} onRowClick={goTo} />}
      {viewMode === 'kanban' && <KanbanView tasks={filtered} onRowClick={goTo} />}

      {viewMode !== 'kanban' && sorted.length > 0 && (
        <Pager
          info={
            viewMode === 'flat'
              ? `${Math.min((safePage - 1) * pageSize + 1, sorted.length)}–${Math.min(safePage * pageSize, sorted.length)} af ${sorted.length}`
              : `${sorted.length} opgaver · ${new Set(sorted.map((t) => t.selskab)).size} selskaber`
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
          sizes={[15, 25, 50]}
        />
      )}

      <BottomBar
        left={
          <>
            {sorted.length} {sorted.length === 1 ? 'opgave' : 'opgaver'} vist ·{' '}
            {tasks.filter((t) => t.rawStatus === 'LUKKET').length} fuldført
            {hasFilter && ` · filtreret fra ${totalCount}`}
          </>
        }
        right={
          <>
            <KbdHint k="⌘K" label="handling" />
            <span>·</span>
            <KbdHint k="N" label="ny opgave" />
            <span>·</span>
            <KbdHint k="F" label="filter" />
            <span>·</span>
            <KbdHint k="M" label="mine" />
          </>
        }
      />
    </>
  )
}

// ────────────────────────────────────────────────────────────────────────────

function FlatTable({
  tasks,
  sortCol,
  sortDir,
  onSort,
  onRowClick,
}: {
  tasks: TaskRow[]
  sortCol: SortKey
  sortDir: 'asc' | 'desc'
  onSort: (col: SortKey) => void
  onRowClick: (id: string) => void
}) {
  if (tasks.length === 0) {
    return (
      <TableWrap>
        <TableEmpty>Ingen opgaver matcher de aktive filtre.</TableEmpty>
      </TableWrap>
    )
  }

  return (
    <TableWrap>
      <table className="w-full table-fixed border-collapse">
        <thead>
          <tr>
            <Th col="nr" sortCol={sortCol} sortDir={sortDir} onSort={onSort} width={84}>
              Nr.
            </Th>
            <Th col="titel" sortCol={sortCol} sortDir={sortDir} onSort={onSort}>
              Titel
            </Th>
            <Th col="selskab" sortCol={sortCol} sortDir={sortDir} onSort={onSort} width={170}>
              Selskab
            </Th>
            <Th col="type" sortCol={sortCol} sortDir={sortDir} onSort={onSort} width={96}>
              Type
            </Th>
            <Th col="rawPrio" sortCol={sortCol} sortDir={sortDir} onSort={onSort} width={80}>
              Prioritet
            </Th>
            <Th col="rawStatus" sortCol={sortCol} sortDir={sortDir} onSort={onSort} width={88}>
              Status
            </Th>
            <Th col="fristDays" sortCol={sortCol} sortDir={sortDir} onSort={onSort} width={92}>
              Frist
            </Th>
            <Th col="ansvarlig" sortCol={sortCol} sortDir={sortDir} onSort={onSort} width={88}>
              Ansvarlig
            </Th>
            <Th width={20}>{''}</Th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((t) => (
            <TaskTr key={t.id} t={t} onClick={() => onRowClick(t.id)} />
          ))}
        </tbody>
      </table>
    </TableWrap>
  )
}

function TaskTr({
  t,
  onClick,
  hideSelskab,
}: {
  t: TaskRow
  onClick: () => void
  hideSelskab?: boolean
}) {
  const done = t.rawStatus === 'LUKKET'
  return (
    <Tr onClick={onClick}>
      <Td width={84} secondary>
        {t.nr}
      </Td>
      <Td>
        <span className={done ? 'text-b-3 line-through' : 'font-medium text-b-1'}>{t.titel}</span>
      </Td>
      {!hideSelskab && (
        <Td width={170} secondary>
          {t.selskab}
        </Td>
      )}
      <Td width={96} secondary>
        {t.type}
      </Td>
      <Td width={80}>
        <Badge tone={prioTone(t.rawPrio)}>{t.prio}</Badge>
      </Td>
      <Td width={88}>
        <Badge tone={statusTone(t.rawStatus)}>{t.status}</Badge>
      </Td>
      <Td width={92}>
        {t.frist === '—' ? (
          <span className="text-b-border-strong">—</span>
        ) : (
          <Badge tone={fristTone(t.fristDays)}>{t.frist}</Badge>
        )}
      </Td>
      <Td width={88} secondary>
        {t.ansvarlig}
      </Td>
      <Td width={20}>
        <span className="text-b-3">›</span>
      </Td>
    </Tr>
  )
}

// ────────────────────────────────────────────────────────────────────────────

function GroupedView({
  tasks,
  onRowClick,
}: {
  tasks: TaskRow[]
  onRowClick: (id: string) => void
}) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  const groups = useMemo(() => {
    const map = new Map<string, TaskRow[]>()
    for (const t of tasks) {
      const arr = map.get(t.selskab) ?? []
      arr.push(t)
      map.set(t.selskab, arr)
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b, 'da-DK'))
  }, [tasks])

  if (tasks.length === 0) {
    return (
      <TableWrap>
        <TableEmpty>Ingen opgaver matcher de aktive filtre.</TableEmpty>
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
        const hasUrgent = rows.some(
          (r) => r.fristDays <= 1 && r.fristDays < 9999 && r.rawStatus !== 'LUKKET'
        )
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
                  {rows.map((t) => (
                    <TaskTr key={t.id} t={t} hideSelskab onClick={() => onRowClick(t.id)} />
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

function KanbanView({ tasks, onRowClick }: { tasks: TaskRow[]; onRowClick: (id: string) => void }) {
  const aaben = tasks.filter((t) => t.rawStatus === 'NY')
  const igang = tasks.filter((t) => t.rawStatus === 'AKTIV_TASK')
  const afvent = tasks.filter((t) => t.rawStatus === 'AFVENTER')
  const fuldfort = tasks.filter((t) => t.rawStatus === 'LUKKET')

  return (
    <div className="grid gap-2.5 lg:grid-cols-4 lg:items-start">
      <KanbanCol title="Åben" tone="default" items={aaben} onRowClick={onRowClick} />
      <KanbanCol title="I gang" tone="blue" items={igang} onRowClick={onRowClick} />
      <KanbanCol title="Afventer" tone="amber" items={afvent} onRowClick={onRowClick} />
      <KanbanCol title="Fuldført" tone="green" items={fuldfort} onRowClick={onRowClick} />
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
  tone: 'default' | 'amber' | 'blue' | 'green'
  items: TaskRow[]
  onRowClick: (id: string) => void
}) {
  const headerCls =
    tone === 'amber'
      ? 'bg-b-amber-bg text-b-amber-fg'
      : tone === 'blue'
        ? 'bg-b-blue-bg text-b-blue-fg'
        : tone === 'green'
          ? 'bg-b-green-bg text-b-green-fg'
          : 'bg-b-panel-h text-b-1'
  const countCls =
    tone === 'amber'
      ? 'bg-[#f5d673] text-b-amber-fg'
      : tone === 'blue'
        ? 'bg-[#b6e3ff] text-b-blue-fg'
        : tone === 'green'
          ? 'bg-[#92dca7] text-b-green-fg'
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
        items.map((t) => {
          const done = t.rawStatus === 'LUKKET'
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onRowClick(t.id)}
              className={`flex w-full flex-col gap-1 border-b border-b-divider px-2.5 py-1.5 text-left last:border-b-0 hover:bg-b-row-hover ${
                done ? 'opacity-60' : ''
              }`}
            >
              <div className="b-tnum text-[11px] text-b-3">{t.nr}</div>
              <div
                className={`line-clamp-2 text-[12px] font-medium ${
                  done ? 'text-b-3 line-through' : 'text-b-1'
                }`}
              >
                {t.titel}
              </div>
              <div className="truncate text-[11px] text-b-2">{t.selskab}</div>
              <div className="flex flex-wrap gap-1">
                <Badge tone={prioTone(t.rawPrio)} className="text-[10px]">
                  {t.prio}
                </Badge>
                {t.frist !== '—' && (
                  <Badge tone={fristTone(t.fristDays)} className="text-[10px]">
                    {t.frist}
                  </Badge>
                )}
                <Badge tone="gray" className="text-[10px]">
                  {t.ansvarlig.split(' ')[0]}
                </Badge>
              </div>
            </button>
          )
        })
      )}
    </Panel>
  )
}
