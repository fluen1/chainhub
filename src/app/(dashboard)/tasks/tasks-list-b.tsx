'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useMemo, useState, useTransition } from 'react'
import { TasksCardView } from '@/components/tasks/TasksCardView'
import { TasksFlatTable } from '@/components/tasks/TasksFlatTable'
import { TasksGroupedView } from '@/components/tasks/TasksGroupedView'
import { KanbanView } from '@/components/tasks/TasksKanban'
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
  Pager,
  BottomBar,
} from '@/components/ui/b'
import { ExportButton } from '@/components/ui/export-button'

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

const PRIO_OPTS = ['Alle', 'Kritisk', 'Høj', 'Mellem', 'Lav']
const STATUS_OPTS = ['Alle', 'Ny', 'I gang', 'Afventer', 'Lukket']

export function TasksListB({
  tasks,
  totalCount,
  page: initialPage = 1,
  pageSize: initialPageSize = 20,
  canExport,
}: {
  tasks: TaskRow[]
  totalCount: number
  page?: number
  pageSize?: number
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
  const [overdueOnly, setOverdueOnly] = useState(() => searchParams.get('overdue') === 'true')
  const [selskabFil, setSelskabFil] = useState(() => searchParams.get('company') ?? 'Alle')
  const [typeFil, setTypeFil] = useState(() => searchParams.get('type') ?? 'Alle')
  const [prioFil, setPrioFil] = useState(() => searchParams.get('prio') ?? 'Alle')
  const [statusFil, setStatusFil] = useState(() => searchParams.get('status') ?? 'Alle')
  const [sortCol, setSortCol] = useState<SortKey>('fristDays')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [page, setPage] = useState(initialPage)
  const [pageSize, setPageSize] = useState(initialPageSize)

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
      if (overdueOnly && (t.fristDays >= 0 || t.rawStatus === 'LUKKET')) return false
      if (selskabFil !== 'Alle' && t.selskab !== selskabFil) return false
      if (typeFil !== 'Alle' && t.type !== typeFil) return false
      if (prioFil !== 'Alle' && t.prio !== prioFil) return false
      if (statusFil !== 'Alle' && t.status !== statusFil) return false
      return true
    })
  }, [tasks, search, mineOnly, overdueOnly, selskabFil, typeFil, prioFil, statusFil])

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
    const newDir = sortCol === col && sortDir === 'asc' ? 'desc' : 'asc'
    setSortCol(col)
    setSortDir(newDir)
    pushUrl({ sort: col, sortDir: newDir, page: '1' })
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

  const maxPage = Math.max(1, Math.ceil(totalCount / pageSize))
  const safePage = Math.min(page, maxPage)
  const paged = tasks

  return (
    <>
      <Breadcrumb trail={[]} current="Opgaver" />

      <PageHeader
        title="Opgaver"
        meta={
          <>
            <span className="font-medium text-b-red-fg">
              {critCount} {critCount === 1 ? 'kritisk' : 'kritiske'}
            </span>
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
        <ExportButton entity="tasks" label="Eksportér CSV" canExport={canExport} />
      </FilterRow>

      {hasFilter && (
        <div className="text-[11px] text-b-2">
          {totalCount} {totalCount === 1 ? 'resultat' : 'resultater'} — filtreret
        </div>
      )}

      {viewMode === 'flat' && (
        <>
          <div className="sm:hidden">
            <TasksCardView tasks={paged} onRowClick={goTo} />
          </div>
          <div className="hidden sm:block">
            <TasksFlatTable
              tasks={paged}
              sortCol={sortCol}
              sortDir={sortDir}
              onSort={handleSort}
              onRowClick={goTo}
            />
          </div>
        </>
      )}
      {viewMode === 'grouped' && <TasksGroupedView tasks={sorted} onRowClick={goTo} />}
      {viewMode === 'kanban' && <KanbanView tasks={sorted} onRowClick={goTo} />}

      {viewMode !== 'kanban' && totalCount > 0 && (
        <Pager
          info={
            viewMode === 'flat'
              ? `${Math.min((safePage - 1) * pageSize + 1, totalCount)}–${Math.min(safePage * pageSize, totalCount)} af ${totalCount}`
              : `${totalCount} opgaver · ${new Set(tasks.map((t) => t.selskab)).size} selskaber`
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
                  pushUrl({ pageSize: String(n), page: '1' })
                }
              : undefined
          }
          sizes={[15, 25, 50]}
        />
      )}

      <BottomBar
        left={
          <>
            {totalCount} {totalCount === 1 ? 'opgave' : 'opgaver'} i alt
            {hasFilter && ` · filtreret`}
          </>
        }
      />
    </>
  )
}
