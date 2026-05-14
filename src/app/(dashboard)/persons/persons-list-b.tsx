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
// /persons — klient-komponent.
// Følger samme arketype som /contracts/cases/tasks. Forskel: 3. view er
// "Kort" (card-grid) i stedet for kanban (designet vil have visuelt overblik
// over personer ikke processtatus).
// ────────────────────────────────────────────────────────────────────────────

export interface PersonRow {
  id: string
  ini: string
  navn: string
  rolle: string
  rawRole: string | null
  selskab: string
  companyId: string | null
  ansat: string
  ansatSort: number
  status: string
  sens: string
}

type ViewMode = 'tabel' | 'grouped' | 'kort'
type SortKey = 'navn' | 'rolle' | 'selskab' | 'ansatSort' | 'status' | 'sens'

const STATUS_OPTS = ['Alle', 'Aktiv', 'Opsagt', 'Inaktiv']

function statusTone(status: string): BadgeTone {
  switch (status) {
    case 'Aktiv':
      return 'green'
    case 'Opsagt':
      return 'red'
    default:
      return 'gray'
  }
}

function sensitivityTone(sens: string): BadgeTone {
  if (sens === 'INTERN') return 'blue'
  if (sens === 'FORTROLIG' || sens === 'STRENGT_FORTROLIG' || sens === 'STRENGT FORTROLIG')
    return 'amber'
  return 'gray'
}

// Governance/ejer-roller får blå tone, ansatte gray.
function roleTone(rawRole: string | null): BadgeTone {
  if (!rawRole) return 'gray'
  const governance = [
    'direktoer',
    'bestyrelsesformand',
    'bestyrelsesmedlem',
    'tegningsberettiget',
    'leder',
  ]
  return governance.includes(rawRole) ? 'blue' : 'gray'
}

export function PersonsListB({
  persons,
  totalCount,
}: {
  persons: PersonRow[]
  totalCount: number
}) {
  const router = useRouter()

  const [viewMode, setViewMode] = useState<ViewMode>('tabel')
  const [search, setSearch] = useState('')
  const [selskabFil, setSelskabFil] = useState('Alle')
  const [rolleFil, setRolleFil] = useState('Alle')
  const [statusFil, setStatusFil] = useState('Alle')
  const [sortCol, setSortCol] = useState<SortKey>('navn')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(15)

  const uniqueSelskaber = useMemo(
    () =>
      Array.from(new Set(persons.map((p) => p.selskab).filter((s) => s !== '—'))).sort((a, b) =>
        a.localeCompare(b, 'da-DK')
      ),
    [persons]
  )
  const uniqueRoller = useMemo(
    () => Array.from(new Set(persons.map((p) => p.rolle).filter((r) => r !== '—'))).sort(),
    [persons]
  )

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return persons.filter((p) => {
      if (
        q &&
        !p.navn.toLowerCase().includes(q) &&
        !p.selskab.toLowerCase().includes(q) &&
        !p.rolle.toLowerCase().includes(q)
      ) {
        return false
      }
      if (selskabFil !== 'Alle' && p.selskab !== selskabFil) return false
      if (rolleFil !== 'Alle' && p.rolle !== rolleFil) return false
      if (statusFil !== 'Alle' && p.status !== statusFil) return false
      return true
    })
  }, [persons, search, selskabFil, rolleFil, statusFil])

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

  const activeCount = useMemo(() => persons.filter((p) => p.status === 'Aktiv').length, [persons])
  const inactiveCount = useMemo(() => persons.filter((p) => p.status !== 'Aktiv').length, [persons])

  const hasFilter =
    selskabFil !== 'Alle' || rolleFil !== 'Alle' || statusFil !== 'Alle' || search.length > 0

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
    setRolleFil('Alle')
    setStatusFil('Alle')
    setPage(1)
  }

  function goTo(id: string) {
    router.push(`/persons/${id}`)
  }

  const maxPage = Math.max(1, Math.ceil(sorted.length / pageSize))
  const safePage = Math.min(page, maxPage)
  const paged = sorted.slice((safePage - 1) * pageSize, safePage * pageSize)

  return (
    <>
      <Breadcrumb trail={[]} current="Personer" />

      <PageHeader
        title="Personer"
        meta={
          <>
            {activeCount} aktive
            {' · '}
            <span className="text-b-2">{inactiveCount} opsagte / inaktive</span>
            {' · '}
            {uniqueRoller.length} roller
          </>
        }
        actions={
          <BButton primary href="/persons/new">
            + Tilføj person
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
          placeholder="Søg personer..."
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
          label="Rolle"
          divider="Roller i systemet"
          options={['Alle', ...uniqueRoller]}
          value={rolleFil}
          onChange={(v) => {
            setRolleFil(v)
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
            { value: 'tabel', label: 'Tabel' },
            { value: 'grouped', label: 'Grupperet' },
            { value: 'kort', label: 'Kort' },
          ]}
        />
        <FilterSpacer />
        <FilterButton>Eksportér ▾</FilterButton>
      </FilterRow>

      {hasFilter && (
        <div className="text-[11px] text-b-2">
          {sorted.length} {sorted.length === 1 ? 'resultat' : 'resultater'} — filtreret fra{' '}
          {totalCount} personer
        </div>
      )}

      {viewMode === 'tabel' && (
        <FlatTable
          persons={paged}
          sortCol={sortCol}
          sortDir={sortDir}
          onSort={handleSort}
          onRowClick={goTo}
        />
      )}
      {viewMode === 'grouped' && <GroupedView persons={sorted} onRowClick={goTo} />}
      {viewMode === 'kort' && <CardView persons={sorted} onRowClick={goTo} />}

      {viewMode === 'tabel' && sorted.length > 0 && (
        <Pager
          info={`${Math.min((safePage - 1) * pageSize + 1, sorted.length)}–${Math.min(safePage * pageSize, sorted.length)} af ${sorted.length}`}
          page={safePage}
          maxPage={maxPage}
          onPage={setPage}
          pageSize={pageSize}
          onPageSize={(n) => {
            setPageSize(n)
            setPage(1)
          }}
          sizes={[15, 25, 50]}
        />
      )}

      <BottomBar
        left={
          <>
            {sorted.length} {sorted.length === 1 ? 'person' : 'personer'} vist · {activeCount}{' '}
            aktive
            {hasFilter && ` · filtreret fra ${totalCount}`}
          </>
        }
        right={
          <>
            <KbdHint k="⌘K" label="handling" />
            <span>·</span>
            <KbdHint k="N" label="ny person" />
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
  persons,
  sortCol,
  sortDir,
  onSort,
  onRowClick,
}: {
  persons: PersonRow[]
  sortCol: SortKey
  sortDir: 'asc' | 'desc'
  onSort: (col: SortKey) => void
  onRowClick: (id: string) => void
}) {
  if (persons.length === 0) {
    return (
      <TableWrap>
        <TableEmpty>Ingen personer matcher de aktive filtre.</TableEmpty>
      </TableWrap>
    )
  }

  return (
    <TableWrap>
      <table className="w-full table-fixed border-collapse">
        <thead>
          <tr>
            <Th col="navn" sortCol={sortCol} sortDir={sortDir} onSort={onSort}>
              Navn
            </Th>
            <Th col="rolle" sortCol={sortCol} sortDir={sortDir} onSort={onSort} width={155}>
              Primær rolle
            </Th>
            <Th col="selskab" sortCol={sortCol} sortDir={sortDir} onSort={onSort} width={190}>
              Selskab
            </Th>
            <Th col="ansatSort" sortCol={sortCol} sortDir={sortDir} onSort={onSort} width={104}>
              Ansat
            </Th>
            <Th col="status" sortCol={sortCol} sortDir={sortDir} onSort={onSort} width={84}>
              Status
            </Th>
            <Th col="sens" sortCol={sortCol} sortDir={sortDir} onSort={onSort} width={104}>
              Sens.
            </Th>
            <Th width={20}>{''}</Th>
          </tr>
        </thead>
        <tbody>
          {persons.map((p) => (
            <PersonTr key={p.id} p={p} onClick={() => onRowClick(p.id)} />
          ))}
        </tbody>
      </table>
    </TableWrap>
  )
}

function PersonTr({
  p,
  onClick,
  hideSelskab,
}: {
  p: PersonRow
  onClick: () => void
  hideSelskab?: boolean
}) {
  return (
    <Tr onClick={onClick}>
      <Td>
        <div className="flex items-center gap-2">
          <InitialsBox ini={p.ini} />
          <span className="font-medium text-b-1">{p.navn}</span>
        </div>
      </Td>
      <Td width={155}>
        {p.rolle === '—' ? (
          <span className="text-b-border-strong">—</span>
        ) : (
          <Badge tone={roleTone(p.rawRole)}>{p.rolle}</Badge>
        )}
      </Td>
      {!hideSelskab && (
        <Td width={190} secondary>
          {p.selskab}
        </Td>
      )}
      <Td width={104} secondary>
        {p.ansat}
      </Td>
      <Td width={84}>
        <Badge tone={statusTone(p.status)}>{p.status}</Badge>
      </Td>
      <Td width={104}>
        <Badge tone={sensitivityTone(p.sens)} className="text-[10px]">
          {p.sens}
        </Badge>
      </Td>
      <Td width={20}>
        <span className="text-b-3">›</span>
      </Td>
    </Tr>
  )
}

// ────────────────────────────────────────────────────────────────────────────

function GroupedView({
  persons,
  onRowClick,
}: {
  persons: PersonRow[]
  onRowClick: (id: string) => void
}) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  const groups = useMemo(() => {
    const map = new Map<string, PersonRow[]>()
    for (const p of persons) {
      const arr = map.get(p.selskab) ?? []
      arr.push(p)
      map.set(p.selskab, arr)
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b, 'da-DK'))
  }, [persons])

  if (persons.length === 0) {
    return (
      <TableWrap>
        <TableEmpty>Ingen personer matcher de aktive filtre.</TableEmpty>
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
        return (
          <div key={name}>
            <button
              type="button"
              onClick={() => toggle(name)}
              className="flex w-full items-center gap-2 border-b border-b-border bg-b-row-hover px-3 py-1.5 text-left hover:bg-[#ecedf0]"
            >
              <span className="w-3 shrink-0 text-[10px] text-b-2">{isOpen ? '▾' : '▸'}</span>
              <span className="flex-1 text-[12px] font-semibold text-b-1">{name}</span>
              <span className="b-tnum rounded-[10px] bg-b-border px-1.5 py-px text-[10px] font-semibold text-b-gray-fg">
                {rows.length}
              </span>
            </button>
            {isOpen && (
              <table className="w-full table-fixed border-collapse">
                <tbody>
                  {rows.map((p) => (
                    <PersonTr key={p.id} p={p} hideSelskab onClick={() => onRowClick(p.id)} />
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
  persons,
  onRowClick,
}: {
  persons: PersonRow[]
  onRowClick: (id: string) => void
}) {
  if (persons.length === 0) {
    return (
      <Panel>
        <div className="px-3 py-8 text-center text-[13px] text-b-3">
          Ingen personer matcher de aktive filtre.
        </div>
      </Panel>
    )
  }
  return (
    <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {persons.map((p) => (
        <button
          key={p.id}
          type="button"
          onClick={() => onRowClick(p.id)}
          className="flex flex-col gap-2 rounded-[4px] border border-b-border bg-b-panel p-2.5 text-left hover:border-b-border-strong hover:bg-b-row-hover"
        >
          <div className="flex items-center gap-2.5">
            <InitialsBox ini={p.ini} size="md" />
            <div className="min-w-0">
              <div className="truncate text-[13px] font-medium text-b-1">{p.navn}</div>
              <div className="truncate text-[11px] text-b-2">{p.selskab}</div>
            </div>
          </div>
          <div className="flex flex-wrap gap-1">
            {p.rolle !== '—' && (
              <Badge tone={roleTone(p.rawRole)} className="text-[10px]">
                {p.rolle}
              </Badge>
            )}
            <Badge tone={statusTone(p.status)} className="text-[10px]">
              {p.status}
            </Badge>
          </div>
        </button>
      ))}
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// InitialsBox — firkantet (ikke rund) initial-boks. Design-princip:
// ingen runde fotos.
// ────────────────────────────────────────────────────────────────────────────

function InitialsBox({ ini, size = 'sm' }: { ini: string; size?: 'sm' | 'md' | 'lg' }) {
  const dim =
    size === 'lg'
      ? 'h-9 w-9 text-[12px]'
      : size === 'md'
        ? 'h-7 w-7 text-[11px]'
        : 'h-5 w-5 text-[10px]'
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-[4px] bg-b-border font-semibold text-b-gray-fg ${dim}`}
    >
      {ini}
    </span>
  )
}
