'use client'

import { Mail, Phone, Building2 } from 'lucide-react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useMemo, useState, useTransition } from 'react'
import {
  Breadcrumb,
  PageHeader,
  BButton,
  FilterRow,
  FilterSearch,
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
  Panel,
} from '@/components/ui/b'
import { ExportButton } from '@/components/ui/export-button'

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
  email: string | null
  phone: string | null
  selskabsCount: number
}

type ViewMode = 'tabel' | 'grouped' | 'kort'
type SortKey = 'navn' | 'rolle' | 'selskab' | 'ansatSort' | 'status' | 'sens'

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
  page: initialPage = 1,
  pageSize: initialPageSize = 15,
}: {
  persons: PersonRow[]
  totalCount: number
  page?: number
  pageSize?: number
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [, startTransition] = useTransition()

  const viewMode: ViewMode = (searchParams.get('view') as ViewMode) || 'tabel'
  const search = searchParams.get('search') ?? ''
  const [sortCol, setSortCol] = useState<SortKey>('navn')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const page = initialPage
  const pageSize = initialPageSize

  function pushUrl(overrides: Record<string, string>) {
    const sp = new URLSearchParams(searchParams.toString())
    for (const [k, v] of Object.entries(overrides)) {
      if (v === '' || v === 'Alle' || (v === '1' && k === 'page')) sp.delete(k)
      else sp.set(k, v)
    }
    if (sp.get('view') === 'tabel') sp.delete('view')
    startTransition(() => {
      router.push(`${pathname}?${sp.toString()}`, { scroll: false })
    })
  }

  // Sortering er klient-side inden for den aktuelle side
  const sorted = useMemo(() => {
    const arr = [...persons]
    arr.sort((a, b) => {
      const av = a[sortCol] as string | number
      const bv = b[sortCol] as string | number
      if (av < bv) return sortDir === 'asc' ? -1 : 1
      if (av > bv) return sortDir === 'asc' ? 1 : -1
      return 0
    })
    return arr
  }, [persons, sortCol, sortDir])

  const activeCount = useMemo(() => persons.filter((p) => p.status === 'Aktiv').length, [persons])
  const inactiveCount = useMemo(() => persons.filter((p) => p.status !== 'Aktiv').length, [persons])

  const hasFilter = search.length > 0

  function handleSort(col: SortKey) {
    if (sortCol === col) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else {
      setSortCol(col)
      setSortDir('asc')
    }
  }

  function resetFilters() {
    pushUrl({ search: '', page: '1' })
  }

  function goTo(id: string) {
    router.push(`/persons/${id}`)
  }

  const maxPage = Math.max(1, Math.ceil(totalCount / pageSize))
  const safePage = Math.min(page, maxPage)
  // Data er allerede pagineret fra server — vis alle rækker i den aktuelle side
  const paged = sorted

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
            {totalCount} i alt
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
            pushUrl({ search: v, page: '1' })
          }}
          placeholder="Søg personer..."
        />
        {hasFilter && <FilterReset onClick={resetFilters} />}
        <FilterSep />
        <SegmentedToggle<ViewMode>
          value={viewMode}
          onChange={(v) => {
            pushUrl({ view: v })
          }}
          options={[
            { value: 'tabel', label: 'Tabel' },
            { value: 'grouped', label: 'Grupperet' },
            { value: 'kort', label: 'Kort' },
          ]}
        />
        <FilterSpacer />
        <ExportButton entity="persons" label="Eksportér CSV" />
      </FilterRow>

      {hasFilter && (
        <div className="text-[11px] text-b-2">
          {totalCount} {totalCount === 1 ? 'resultat' : 'resultater'} — søgning aktiv
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

      {viewMode === 'tabel' && totalCount > 0 && (
        <Pager
          info={`${Math.min((safePage - 1) * pageSize + 1, totalCount)}–${Math.min(safePage * pageSize, totalCount)} af ${totalCount}`}
          page={safePage}
          maxPage={maxPage}
          onPage={(n) => {
            pushUrl({ page: String(n) })
          }}
          pageSize={pageSize}
          onPageSize={(n) => {
            pushUrl({ pageSize: String(n), page: '1' })
          }}
          sizes={[15, 25, 50]}
        />
      )}

      <BottomBar
        left={
          <>
            {totalCount} {totalCount === 1 ? 'person' : 'personer'} · {activeCount} aktive på siden
            {hasFilter && ` · søgning aktiv`}
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
          <div className="flex items-start gap-2.5">
            <InitialsBox ini={p.ini} size="md" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <div className="truncate text-[13px] font-medium text-b-1">{p.navn}</div>
                <Badge tone={statusTone(p.status)} className="shrink-0 text-[10px]">
                  {p.status}
                </Badge>
              </div>
              {p.rolle !== '—' && (
                <div className="mt-0.5 truncate text-[11px] text-b-2">{p.rolle}</div>
              )}
            </div>
          </div>

          {/* Kontakt-rækker: skjul linje hvis intet data */}
          {(p.email || p.phone) && (
            <div className="flex flex-col gap-0.5 border-t border-b-divider pt-1.5 text-[11px] text-b-2">
              {p.email && (
                <div className="flex items-center gap-1.5">
                  <Mail className="h-3 w-3 shrink-0" aria-hidden />
                  <span className="truncate">{p.email}</span>
                </div>
              )}
              {p.phone && (
                <div className="flex items-center gap-1.5">
                  <Phone className="h-3 w-3 shrink-0" aria-hidden />
                  <span className="truncate">{p.phone}</span>
                </div>
              )}
            </div>
          )}

          {/* Selskab + ansat — med chip hvis personen er aktiv i flere lokationer */}
          {p.selskab !== '—' && (
            <div className="flex items-center justify-between gap-2 text-[11px] text-b-2">
              <div className="flex min-w-0 items-center gap-1.5">
                <Building2 className="h-3 w-3 shrink-0" aria-hidden />
                <span className="truncate">{p.selskab}</span>
                {p.selskabsCount > 1 && (
                  <span className="b-tnum shrink-0 rounded-[8px] bg-b-border px-1.5 py-px text-[10px] font-medium text-b-gray-fg">
                    +{p.selskabsCount - 1}
                  </span>
                )}
              </div>
              {p.ansat !== '—' && <span className="b-tnum shrink-0">ans. {p.ansat}</span>}
            </div>
          )}
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
