'use client'

import { useMemo, useState, useRef, useCallback, useEffect, useTransition } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { toast } from 'sonner'
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
  TableWrap,
  Th,
  Tr,
  Td,
  TableEmpty,
  Badge,
  type BadgeTone,
  Pager,
  BottomBar,
  Panel,
} from '@/components/ui/b'
import { updateTaskStatus } from '@/actions/tasks'

// ────────────────────────────────────────────────────────────────────────────
// /tasks — klient-komponent.
// Følger samme arketype som /contracts og /cases. Ekstra: "Mine opgaver"-toggle.
// ────────────────────────────────────────────────────────────────────────────

export interface TaskRow {
  id: string
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
type SortKey = 'titel' | 'selskab' | 'type' | 'rawPrio' | 'rawStatus' | 'fristDays' | 'ansvarlig'

// Fix #4: Tilføj 'I gang' til STATUS_OPTS
const PRIO_OPTS = ['Alle', 'Kritisk', 'Høj', 'Mellem', 'Lav']
const STATUS_OPTS = ['Alle', 'Ny', 'I gang', 'Afventer', 'Lukket']

// Fix #5: Alle kanban-kolonner — rækkefølge og mapping
type KanbanColDef = {
  title: string
  rawStatus: string
  tone: 'default' | 'amber' | 'blue' | 'green'
}
const KANBAN_COLS: KanbanColDef[] = [
  { title: 'Åben', rawStatus: 'NY', tone: 'default' },
  { title: 'I gang', rawStatus: 'AKTIV_TASK', tone: 'blue' },
  { title: 'Afventer', rawStatus: 'AFVENTER', tone: 'amber' },
  { title: 'Fuldført', rawStatus: 'LUKKET', tone: 'green' },
]

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

export function TasksListB({
  tasks,
  totalCount,
  canExport,
}: {
  tasks: TaskRow[]
  totalCount: number
  /** Skjul eksport-knap hvis brugeren ikke har eksport-adgang */
  canExport?: boolean
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [, startTransition] = useTransition()

  const [viewMode, setViewMode] = useState<ViewMode>(
    () => (searchParams.get('view') as ViewMode) || 'flat'
  )
  const [search, setSearch] = useState(() => searchParams.get('search') ?? '')
  const [mineOnly, setMineOnly] = useState(() => searchParams.get('mine') === '1')
  const [selskabFil, setSelskabFil] = useState(() => searchParams.get('company') ?? 'Alle')
  const [typeFil, setTypeFil] = useState(() => searchParams.get('type') ?? 'Alle')
  const [prioFil, setPrioFil] = useState(() => searchParams.get('prio') ?? 'Alle')
  const [statusFil, setStatusFil] = useState(() => searchParams.get('status') ?? 'Alle')
  const [sortCol, setSortCol] = useState<SortKey>('fristDays')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [page, setPage] = useState(() => parseInt(searchParams.get('page') ?? '1', 10) || 1)
  const [pageSize, setPageSize] = useState(15)

  function pushUrl(overrides: Record<string, string>) {
    const sp = new URLSearchParams(searchParams.toString())
    for (const [k, v] of Object.entries(overrides)) {
      if (v === '' || v === 'Alle' || (v === '1' && k === 'page') || (v === '0' && k === 'mine'))
        sp.delete(k)
      else sp.set(k, v)
    }
    if (sp.get('view') === 'flat') sp.delete('view')
    startTransition(() => {
      router.push(`${pathname}?${sp.toString()}`, { scroll: false })
    })
  }

  useEffect(() => {
    setViewMode((searchParams.get('view') as ViewMode) || 'flat')
    setSearch(searchParams.get('search') ?? '')
    setMineOnly(searchParams.get('mine') === '1')
    setSelskabFil(searchParams.get('company') ?? 'Alle')
    setTypeFil(searchParams.get('type') ?? 'Alle')
    setPrioFil(searchParams.get('prio') ?? 'Alle')
    setStatusFil(searchParams.get('status') ?? 'Alle')
    setPage(parseInt(searchParams.get('page') ?? '1', 10) || 1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

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
      if (q && !t.titel.toLowerCase().includes(q) && !t.selskab.toLowerCase().includes(q)) {
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
    pushUrl({
      search: '',
      mine: '0',
      company: 'Alle',
      type: 'Alle',
      prio: 'Alle',
      status: 'Alle',
      page: '1',
    })
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
            pushUrl({ search: v, page: '1' })
          }}
          placeholder="Søg opgaver..."
        />
        <FilterButton
          active={mineOnly}
          onClick={() => {
            const next = !mineOnly
            setMineOnly(next)
            setPage(1)
            pushUrl({ mine: next ? '1' : '0', page: '1' })
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
            pushUrl({ company: v, page: '1' })
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
            pushUrl({ type: v, page: '1' })
          }}
        />
        <FilterDropdown
          label="Prioritet"
          options={PRIO_OPTS}
          value={prioFil}
          onChange={(v) => {
            setPrioFil(v)
            setPage(1)
            pushUrl({ prio: v, page: '1' })
          }}
        />
        <FilterDropdown
          label="Status"
          options={STATUS_OPTS}
          value={statusFil}
          onChange={(v) => {
            setStatusFil(v)
            setPage(1)
            pushUrl({ status: v, page: '1' })
          }}
        />
        {hasFilter && <FilterReset onClick={resetFilters} />}
        <FilterSep />
        <SegmentedToggle<ViewMode>
          value={viewMode}
          onChange={(v) => {
            setViewMode(v)
            pushUrl({ view: v })
          }}
          options={[
            { value: 'flat', label: 'Flat' },
            { value: 'grouped', label: 'Grupperet' },
            { value: 'kanban', label: 'Kanban' },
          ]}
        />
        <FilterSpacer />
        <ExportButton entity="tasks" label="Eksportér ▾" canExport={canExport} />
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
      {/* Fix #6: KanbanView bruger sorted (ikke filtered) */}
      {viewMode === 'kanban' && <KanbanView tasks={sorted} onRowClick={goTo} />}

      {viewMode !== 'kanban' && sorted.length > 0 && (
        <Pager
          info={
            viewMode === 'flat'
              ? `${Math.min((safePage - 1) * pageSize + 1, sorted.length)}–${Math.min(safePage * pageSize, sorted.length)} af ${sorted.length}`
              : `${sorted.length} opgaver · ${new Set(sorted.map((t) => t.selskab)).size} selskaber`
          }
          page={viewMode === 'flat' ? safePage : undefined}
          maxPage={viewMode === 'flat' ? maxPage : undefined}
          onPage={
            viewMode === 'flat'
              ? (n) => {
                  setPage(n)
                  pushUrl({ page: String(n) })
                }
              : undefined
          }
          pageSize={viewMode === 'flat' ? pageSize : undefined}
          onPageSize={
            viewMode === 'flat'
              ? (n) => {
                  setPageSize(n)
                  setPage(1)
                  pushUrl({ page: '1' })
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
              Prio
            </Th>
            <Th col="rawStatus" sortCol={sortCol} sortDir={sortDir} onSort={onSort} width={92}>
              Status
            </Th>
            <Th col="fristDays" sortCol={sortCol} sortDir={sortDir} onSort={onSort} width={110}>
              Frist
            </Th>
            <Th col="ansvarlig" sortCol={sortCol} sortDir={sortDir} onSort={onSort} width={110}>
              Ansv.
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
      <Td width={92}>
        <Badge tone={statusTone(t.rawStatus)}>{t.status}</Badge>
      </Td>
      <Td width={110}>
        {t.frist === '—' ? (
          <span className="text-b-border-strong">—</span>
        ) : (
          <Badge tone={fristTone(t.fristDays)}>{t.frist}</Badge>
        )}
      </Td>
      <Td width={110} secondary>
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
// Kanban med drag-drop, keyboard-nav og aria-live
// ────────────────────────────────────────────────────────────────────────────

type TaskStatus = 'NY' | 'AKTIV_TASK' | 'AFVENTER' | 'LUKKET'

function statusLabel(rawStatus: string): string {
  switch (rawStatus) {
    case 'NY':
      return 'Åben'
    case 'AKTIV_TASK':
      return 'I gang'
    case 'AFVENTER':
      return 'Afventer'
    case 'LUKKET':
      return 'Fuldført'
    default:
      return rawStatus
  }
}

const KANBAN_STATUS_ORDER: TaskStatus[] = ['NY', 'AKTIV_TASK', 'AFVENTER', 'LUKKET']

// Mobile kanban tab-bar: status-labels matcher KANBAN_COLS
const KANBAN_MOBILE_TABS: Array<{ value: string; label: string }> = [
  { value: 'NY', label: 'Åben' },
  { value: 'AKTIV_TASK', label: 'I gang' },
  { value: 'AFVENTER', label: 'Afventer' },
  { value: 'LUKKET', label: 'Fuldført' },
]

function KanbanView({ tasks, onRowClick }: { tasks: TaskRow[]; onRowClick: (id: string) => void }) {
  // Optimistisk lokal kopi af tasks
  const [localTasks, setLocalTasks] = useState<TaskRow[]>(tasks)
  // Synkroniser med ny server-data (fx ved route-refresh)
  const prevTasksRef = useRef(tasks)
  if (prevTasksRef.current !== tasks) {
    prevTasksRef.current = tasks
    setLocalTasks(tasks)
  }

  // Aria-live besked
  const [liveMsg, setLiveMsg] = useState('')

  // Grabbed-state til keyboard-navigation (max 1 ad gangen)
  const [grabbedId, setGrabbedId] = useState<string | null>(null)

  // Mobil kolonne-valg: viser kun én kolonne ad gangen på <lg
  const [selectedKanbanStatus, setSelectedKanbanStatus] = useState<string>('NY')

  const moveTask = useCallback(
    async (taskId: string, newStatus: TaskStatus) => {
      const prev = localTasks
      const task = prev.find((t) => t.id === taskId)
      if (!task) return

      // Optimistisk update
      const updated = prev.map((t) =>
        t.id === taskId ? { ...t, rawStatus: newStatus, status: statusLabel(newStatus) } : t
      )
      setLocalTasks(updated)
      setLiveMsg(`Opgave "${task.titel}" flyttet til ${statusLabel(newStatus)}`)

      const result = await updateTaskStatus({ taskId, status: newStatus })
      if ('error' in result) {
        // Rollback
        setLocalTasks(prev)
        setLiveMsg(`Opgave "${task.titel}" kunne ikke flyttes — prøv igen`)
        toast.error(result.error ?? 'Status kunne ikke opdateres')
      }
    },
    [localTasks]
  )

  const handleDrop = useCallback(
    (colStatus: TaskStatus, e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      const taskId = e.dataTransfer.getData('task-id')
      if (!taskId) return
      const task = localTasks.find((t) => t.id === taskId)
      if (!task || task.rawStatus === colStatus) return
      void moveTask(taskId, colStatus)
    },
    [localTasks, moveTask]
  )

  const handleKeyboardMove = useCallback(
    (taskId: string, direction: 'left' | 'right') => {
      const task = localTasks.find((t) => t.id === taskId)
      if (!task) return
      const currentIdx = KANBAN_STATUS_ORDER.indexOf(task.rawStatus as TaskStatus)
      if (currentIdx === -1) return
      const nextIdx = direction === 'right' ? currentIdx + 1 : currentIdx - 1
      if (nextIdx < 0 || nextIdx >= KANBAN_STATUS_ORDER.length) return
      const newStatus = KANBAN_STATUS_ORDER[nextIdx]
      void moveTask(taskId, newStatus)
    },
    [localTasks, moveTask]
  )

  return (
    <>
      {/* Aria-live region — Fix #3 */}
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {liveMsg}
      </div>

      {/* Mobil tab-bar: synlig på <lg, skjult på >=lg */}
      <div className="mb-2.5 lg:hidden" data-testid="kanban-mobile-tabs">
        <SegmentedToggle<string>
          value={selectedKanbanStatus}
          onChange={setSelectedKanbanStatus}
          options={KANBAN_MOBILE_TABS}
        />
      </div>

      {/* Desktop: 4-kolonne grid (>=lg). Mobil: vis kun valgt kolonne */}
      <div className="grid gap-2.5 lg:grid-cols-4 lg:items-start">
        {KANBAN_COLS.map((col) => {
          const items = localTasks.filter((t) => t.rawStatus === col.rawStatus)
          const isVisibleOnMobile = col.rawStatus === selectedKanbanStatus
          return (
            <div
              key={col.rawStatus}
              className={isVisibleOnMobile ? 'block lg:block' : 'hidden lg:block'}
            >
              <KanbanCol
                title={col.title}
                tone={col.tone}
                rawStatus={col.rawStatus as TaskStatus}
                items={items}
                onRowClick={onRowClick}
                onDrop={handleDrop}
                grabbedId={grabbedId}
                onGrab={(id) => setGrabbedId(id)}
                onRelease={() => {
                  setGrabbedId(null)
                  setLiveMsg('Flytning annulleret')
                }}
                onKeyboardMove={handleKeyboardMove}
              />
            </div>
          )
        })}
      </div>
    </>
  )
}

function KanbanCol({
  title,
  tone,
  rawStatus,
  items,
  onRowClick,
  onDrop,
  grabbedId,
  onGrab,
  onRelease,
  onKeyboardMove,
}: {
  title: string
  tone: 'default' | 'amber' | 'blue' | 'green'
  rawStatus: TaskStatus
  items: TaskRow[]
  onRowClick: (id: string) => void
  onDrop: (colStatus: TaskStatus, e: React.DragEvent<HTMLDivElement>) => void
  grabbedId: string | null
  onGrab: (id: string) => void
  onRelease: () => void
  onKeyboardMove: (id: string, direction: 'left' | 'right') => void
}) {
  const [isDragOver, setIsDragOver] = useState(false)

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

      {/* Drop-zone wrapper */}
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setIsDragOver(true)
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={(e) => {
          setIsDragOver(false)
          onDrop(rawStatus, e)
        }}
        className={`min-h-[48px] transition-colors ${isDragOver ? 'bg-b-row-hover ring-2 ring-inset ring-b-border' : ''}`}
      >
        {items.length === 0 ? (
          <div className="px-3 py-2 text-[12px] text-b-3">Ingen</div>
        ) : (
          items.map((t) => (
            <KanbanCard
              key={t.id}
              task={t}
              isGrabbed={grabbedId === t.id}
              onRowClick={onRowClick}
              onGrab={onGrab}
              onRelease={onRelease}
              onKeyboardMove={onKeyboardMove}
            />
          ))
        )}
      </div>
    </Panel>
  )
}

function KanbanCard({
  task,
  isGrabbed,
  onRowClick,
  onGrab,
  onRelease,
  onKeyboardMove,
}: {
  task: TaskRow
  isGrabbed: boolean
  onRowClick: (id: string) => void
  onGrab: (id: string) => void
  onRelease: () => void
  onKeyboardMove: (id: string, direction: 'left' | 'right') => void
}) {
  const done = task.rawStatus === 'LUKKET'

  function handleKeyDown(e: React.KeyboardEvent<HTMLButtonElement>) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      if (isGrabbed) {
        // Space/Enter på allerede grabbed: naviger til detalje
        onRelease()
        onRowClick(task.id)
      } else {
        onGrab(task.id)
      }
    } else if (e.key === 'Escape') {
      if (isGrabbed) {
        e.preventDefault()
        onRelease()
      }
    } else if (e.key === 'ArrowRight') {
      if (isGrabbed) {
        e.preventDefault()
        onKeyboardMove(task.id, 'right')
      }
    } else if (e.key === 'ArrowLeft') {
      if (isGrabbed) {
        e.preventDefault()
        onKeyboardMove(task.id, 'left')
      }
    }
  }

  return (
    <button
      type="button"
      draggable
      aria-pressed={isGrabbed}
      aria-label={`${task.titel} — ${task.selskab}. Tryk Enter for at gribe, piletaster for at flytte.`}
      onDragStart={(e) => {
        e.dataTransfer.setData('task-id', task.id)
        e.dataTransfer.effectAllowed = 'move'
      }}
      onClick={() => {
        if (!isGrabbed) onRowClick(task.id)
      }}
      onKeyDown={handleKeyDown}
      className={[
        'flex w-full flex-col gap-1 border-b border-b-divider px-2.5 py-1.5 text-left last:border-b-0 hover:bg-b-row-hover',
        done ? 'opacity-60' : '',
        isGrabbed ? 'ring-2 ring-inset ring-b-blue-fg border-b-blue-fg bg-b-blue-bg' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div
        className={`line-clamp-2 text-[12px] font-medium ${
          done ? 'text-b-3 line-through' : 'text-b-1'
        }`}
      >
        {task.titel}
      </div>
      <div className="truncate text-[11px] text-b-2">{task.selskab}</div>
      <div className="flex flex-wrap gap-1">
        <Badge tone={prioTone(task.rawPrio)} className="text-[10px]">
          {task.prio}
        </Badge>
        {task.frist !== '—' && (
          <Badge tone={fristTone(task.fristDays)} className="text-[10px]">
            {task.frist}
          </Badge>
        )}
        <Badge tone="gray" className="text-[10px]">
          {task.ansvarlig.split(' ')[0]}
        </Badge>
      </div>
    </button>
  )
}
