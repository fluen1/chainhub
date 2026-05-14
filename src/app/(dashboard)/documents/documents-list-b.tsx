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
  PlusBadge,
} from '@/components/ui/b'
import { DeleteDocumentButton } from '@/components/documents/DeleteDocumentButton'

// ────────────────────────────────────────────────────────────────────────────
// /documents — klient-komponent.
// Plus-tier attention-panel viser docs med opmærksomhedsfelter (att > 0) eller
// status='Review'. Skjules når attOnly-toggle er aktiv (visningen er da redundant).
// ────────────────────────────────────────────────────────────────────────────

type AiStatus = 'AI ✓' | 'Review' | 'Afventer' | 'Ikke AI'

export interface DocRow {
  id: string
  ext: string
  navn: string
  size: string
  selskab: string
  tilknytning: string
  aiStatus: AiStatus
  konf: number | null
  att: number
  dato: string
  datoSort: number
  contractName?: string | null
  caseName?: string | null
}

type ViewMode = 'flat' | 'grouped'
type SortKey = 'ext' | 'navn' | 'selskab' | 'tilknytning' | 'aiStatus' | 'konf' | 'att' | 'datoSort'

const AI_STATUS_OPTS = ['Alle', 'AI ✓', 'Review', 'Afventer', 'Ikke AI']

function extTone(ext: string): BadgeTone {
  if (ext === 'PDF') return 'red'
  if (ext === 'DOCX' || ext === 'DOC') return 'blue'
  if (ext === 'PNG' || ext === 'JPG' || ext === 'JPEG') return 'green'
  return 'gray'
}

function aiStatusTone(s: AiStatus): BadgeTone {
  if (s === 'AI ✓') return 'green'
  if (s === 'Review') return 'amber'
  if (s === 'Afventer') return 'blue'
  return 'gray'
}

function konfTone(konf: number): BadgeTone {
  if (konf >= 85) return 'green'
  if (konf >= 70) return 'amber'
  return 'red'
}

function attTone(att: number): BadgeTone {
  if (att === 1) return 'amber'
  return 'red'
}

export function DocumentsListB({ documents }: { documents: DocRow[] }) {
  const router = useRouter()

  const [viewMode, setViewMode] = useState<ViewMode>('flat')
  const [search, setSearch] = useState('')
  const [selFil, setSelFil] = useState('Alle')
  const [extFil, setExtFil] = useState('Alle')
  const [aiFil, setAiFil] = useState('Alle')
  const [attOnly, setAttOnly] = useState(false)
  const [attOpen, setAttOpen] = useState(true)
  const [sortCol, setSortCol] = useState<SortKey>('datoSort')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(15)

  const uniqueSelskaber = useMemo(
    () =>
      Array.from(new Set(documents.map((d) => d.selskab).filter((s) => s !== '—'))).sort((a, b) =>
        a.localeCompare(b, 'da-DK')
      ),
    [documents]
  )
  const uniqueExts = useMemo(
    () => Array.from(new Set(documents.map((d) => d.ext))).sort(),
    [documents]
  )

  // "Opmærksomheds-docs" = att > 0 OR aiStatus === 'Review'
  const attDocs = useMemo(
    () => documents.filter((d) => d.att > 0 || d.aiStatus === 'Review'),
    [documents]
  )

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return documents.filter((d) => {
      if (
        q &&
        !d.navn.toLowerCase().includes(q) &&
        !d.selskab.toLowerCase().includes(q) &&
        !d.tilknytning.toLowerCase().includes(q)
      ) {
        return false
      }
      if (selFil !== 'Alle' && d.selskab !== selFil) return false
      if (extFil !== 'Alle' && d.ext !== extFil) return false
      if (aiFil !== 'Alle' && d.aiStatus !== aiFil) return false
      if (attOnly && d.att === 0 && d.aiStatus !== 'Review') return false
      return true
    })
  }, [documents, search, selFil, extFil, aiFil, attOnly])

  const sorted = useMemo(() => {
    const arr = [...filtered]
    arr.sort((a, b) => {
      const av = a[sortCol] as string | number | null
      const bv = b[sortCol] as string | number | null
      if (av == null && bv != null) return 1
      if (av != null && bv == null) return -1
      if (av != null && bv != null) {
        if (av < bv) return sortDir === 'asc' ? -1 : 1
        if (av > bv) return sortDir === 'asc' ? 1 : -1
      }
      return 0
    })
    return arr
  }, [filtered, sortCol, sortDir])

  const totalCount = documents.length
  const aiCount = useMemo(() => documents.filter((d) => d.aiStatus === 'AI ✓').length, [documents])
  const revCount = useMemo(
    () => documents.filter((d) => d.aiStatus === 'Review').length,
    [documents]
  )
  const lowCount = useMemo(
    () => documents.filter((d) => d.konf != null && d.konf < 70).length,
    [documents]
  )
  const attCount = attDocs.length

  const hasFilter =
    selFil !== 'Alle' || extFil !== 'Alle' || aiFil !== 'Alle' || search.length > 0 || attOnly

  const stripCells: StripCellData[] = [
    { num: totalCount, label: 'I alt' },
    { num: aiCount, label: 'AI ✓', color: 'green' },
    { num: revCount, label: 'Afventer review', color: revCount > 0 ? 'amber' : 'default' },
    { num: lowCount, label: 'Lav konfidens', color: lowCount > 0 ? 'red' : 'default' },
    { num: attCount, label: 'Opmærksomhedsfelter' },
  ]

  function handleSort(col: SortKey) {
    if (sortCol === col) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else {
      setSortCol(col)
      setSortDir(col === 'datoSort' ? 'desc' : 'asc')
    }
  }

  function resetFilters() {
    setSearch('')
    setSelFil('Alle')
    setExtFil('Alle')
    setAiFil('Alle')
    setAttOnly(false)
    setPage(1)
  }

  function goTo(id: string) {
    router.push(`/documents/review/${id}`)
  }

  const maxPage = Math.max(1, Math.ceil(sorted.length / pageSize))
  const safePage = Math.min(page, maxPage)
  const paged = sorted.slice((safePage - 1) * pageSize, safePage * pageSize)

  return (
    <>
      <Breadcrumb trail={[]} current="Dokumenter" />

      <PageHeader
        title="Dokumenter"
        meta={
          <>
            {totalCount} i alt
            {' · '}
            <span className="font-medium text-b-ai-accent">{aiCount} AI-extracted</span>
            {' · '}
            <span className="font-medium text-b-amber-fg">{revCount} afventer review</span>
            {' · '}
            {lowCount} lav konfidens
          </>
        }
        actions={
          <BButton primary href="/documents/upload">
            ↑ Upload dokument
          </BButton>
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
          placeholder="Søg dokumenter..."
        />
        <FilterDropdown
          label="Selskab"
          options={['Alle', ...uniqueSelskaber]}
          value={selFil}
          onChange={(v) => {
            setSelFil(v)
            setPage(1)
          }}
        />
        <FilterDropdown
          label="Filtype"
          options={['Alle', ...uniqueExts]}
          value={extFil}
          onChange={(v) => {
            setExtFil(v)
            setPage(1)
          }}
        />
        <FilterDropdown
          label="AI-status"
          options={AI_STATUS_OPTS}
          value={aiFil}
          onChange={(v) => {
            setAiFil(v)
            setPage(1)
          }}
        />
        <FilterButton
          active={attOnly}
          onClick={() => {
            setAttOnly((v) => !v)
            setPage(1)
          }}
        >
          {attOnly ? '⚡ Kræver review ×' : '⚡ Kræver review'}
        </FilterButton>
        {hasFilter && <FilterReset onClick={resetFilters} />}
        <FilterSep />
        <SegmentedToggle<ViewMode>
          value={viewMode}
          onChange={setViewMode}
          options={[
            { value: 'flat', label: 'Flat' },
            { value: 'grouped', label: 'Grupperet' },
          ]}
        />
        <FilterSpacer />
        <FilterButton>Eksportér ▾</FilterButton>
      </FilterRow>

      {hasFilter && (
        <div className="text-[11px] text-b-2">
          {sorted.length} {sorted.length === 1 ? 'resultat' : 'resultater'} — filtreret fra{' '}
          {totalCount} dokumenter
        </div>
      )}

      {/* Attention panel — Plus (kun når der ikke filteres på samme udvalg) */}
      {!attOnly && !hasFilter && attDocs.length > 0 && (
        <AttentionPanel
          docs={attDocs}
          open={attOpen}
          onToggle={() => setAttOpen((v) => !v)}
          onRowClick={goTo}
        />
      )}

      {viewMode === 'flat' && (
        <FlatTable
          docs={paged}
          sortCol={sortCol}
          sortDir={sortDir}
          onSort={handleSort}
          onRowClick={goTo}
        />
      )}
      {viewMode === 'grouped' && <GroupedView docs={sorted} onRowClick={goTo} />}

      {viewMode === 'flat' && sorted.length > 0 && (
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
            {sorted.length} {sorted.length === 1 ? 'dokument' : 'dokumenter'} vist · {aiCount}{' '}
            AI-extracted
            {hasFilter && ` · filtreret fra ${totalCount}`}
          </>
        }
        right={
          <>
            <KbdHint k="⌘K" label="handling" />
            <span>·</span>
            <KbdHint k="U" label="upload" />
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
  docs,
  sortCol,
  sortDir,
  onSort,
  onRowClick,
}: {
  docs: DocRow[]
  sortCol: SortKey
  sortDir: 'asc' | 'desc'
  onSort: (col: SortKey) => void
  onRowClick: (id: string) => void
}) {
  if (docs.length === 0) {
    return (
      <TableWrap>
        <TableEmpty>Ingen dokumenter matcher de aktive filtre.</TableEmpty>
      </TableWrap>
    )
  }
  return (
    <TableWrap>
      <table className="w-full table-fixed border-collapse">
        <thead>
          <tr>
            <Th col="ext" sortCol={sortCol} sortDir={sortDir} onSort={onSort} width={52}>
              Fil
            </Th>
            <Th col="navn" sortCol={sortCol} sortDir={sortDir} onSort={onSort}>
              Navn
            </Th>
            <Th col="selskab" sortCol={sortCol} sortDir={sortDir} onSort={onSort} width={165}>
              Selskab
            </Th>
            <Th col="tilknytning" sortCol={sortCol} sortDir={sortDir} onSort={onSort} width={160}>
              Tilknyttet
            </Th>
            <Th col="aiStatus" sortCol={sortCol} sortDir={sortDir} onSort={onSort} width={94}>
              AI
            </Th>
            <Th col="konf" sortCol={sortCol} sortDir={sortDir} onSort={onSort} width={94}>
              Konf.
            </Th>
            <Th col="att" sortCol={sortCol} sortDir={sortDir} onSort={onSort} width={96}>
              Felt
            </Th>
            <Th col="datoSort" sortCol={sortCol} sortDir={sortDir} onSort={onSort} width={110}>
              Dato
            </Th>
            <Th width={20}>{''}</Th>
            <Th width={36}>{''}</Th>
          </tr>
        </thead>
        <tbody>
          {docs.map((d) => (
            <DocTr key={d.id} d={d} onClick={() => onRowClick(d.id)} />
          ))}
        </tbody>
      </table>
    </TableWrap>
  )
}

// Et dokument "kræver opmærksomhed" hvis det har 3+ felter under review eller
// AI-konfidensen er <60%. Disse rækker får en subtle amber bg-tint så reviewer
// hurtigt kan spotte hvor der skal fokuseres — uden at vente på AttentionPanel
// (som skjules ved aktive filtre).
function needsAttention(d: DocRow): boolean {
  if (d.att >= 3) return true
  if (d.konf != null && d.konf < 60) return true
  if (d.aiStatus === 'Review') return true
  return false
}

function DocTr({
  d,
  onClick,
  hideSelskab,
}: {
  d: DocRow
  onClick: () => void
  hideSelskab?: boolean
}) {
  const attention = needsAttention(d)
  return (
    <Tr
      onClick={onClick}
      className={attention ? 'bg-b-amber-bg/40 hover:bg-b-amber-bg/60' : undefined}
    >
      <Td width={52}>
        <Badge tone={extTone(d.ext)}>{d.ext}</Badge>
      </Td>
      <Td>
        <span className="font-medium text-b-1">{d.navn}</span>
        <span className="ml-1 text-[11px] text-b-2">{d.size}</span>
      </Td>
      {!hideSelskab && (
        <Td width={165} secondary>
          {d.selskab}
        </Td>
      )}
      <Td width={160} secondary>
        {d.tilknytning}
      </Td>
      <Td width={94}>
        <Badge tone={aiStatusTone(d.aiStatus)}>{d.aiStatus}</Badge>
      </Td>
      <Td width={94}>
        {d.konf == null ? (
          <span className="text-b-border-strong">—</span>
        ) : (
          <Badge tone={konfTone(d.konf)}>{`${d.konf}%`}</Badge>
        )}
      </Td>
      <Td width={96}>
        {d.att === 0 ? (
          <span className="text-b-border-strong">—</span>
        ) : (
          <Badge tone={attTone(d.att)}>{d.att === 1 ? '1 felt' : `${d.att} felter`}</Badge>
        )}
      </Td>
      <Td width={110} secondary>
        {d.dato}
      </Td>
      <Td width={20}>
        <span className="text-b-3">›</span>
      </Td>
      <Td width={36}>
        <DeleteDocumentButton
          documentId={d.id}
          fileName={d.navn}
          contractName={d.contractName}
          caseName={d.caseName}
        />
      </Td>
    </Tr>
  )
}

// ────────────────────────────────────────────────────────────────────────────

function GroupedView({ docs, onRowClick }: { docs: DocRow[]; onRowClick: (id: string) => void }) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  const groups = useMemo(() => {
    const map = new Map<string, DocRow[]>()
    for (const d of docs) {
      const arr = map.get(d.selskab) ?? []
      arr.push(d)
      map.set(d.selskab, arr)
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b, 'da-DK'))
  }, [docs])

  if (docs.length === 0) {
    return (
      <TableWrap>
        <TableEmpty>Ingen dokumenter matcher de aktive filtre.</TableEmpty>
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
        const needsReview = rows.some((r) => r.att > 0 || r.aiStatus === 'Review')
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
                  needsReview ? 'bg-[#f3e8ff] text-b-ai-accent' : 'bg-b-border text-b-gray-fg'
                }`}
              >
                {rows.length}
              </span>
              {needsReview && (
                <span className="rounded-[3px] bg-[#f3e8ff] px-1.5 py-px text-[10px] font-semibold text-b-ai-accent">
                  ⚡ Review
                </span>
              )}
            </button>
            {isOpen && (
              <table className="w-full table-fixed border-collapse">
                <tbody>
                  {rows.map((d) => (
                    <DocTr key={d.id} d={d} hideSelskab onClick={() => onRowClick(d.id)} />
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
// AttentionPanel — Plus-tier collapsible panel der prominent viser docs
// med opmærksomhedsfelter eller status='Review'. Skjules ved filter/attOnly.
// ────────────────────────────────────────────────────────────────────────────

function AttentionPanel({
  docs,
  open,
  onToggle,
  onRowClick,
}: {
  docs: DocRow[]
  open: boolean
  onToggle: () => void
  onRowClick: (id: string) => void
}) {
  return (
    <div className="overflow-hidden rounded-[4px] border border-b-ai-border bg-[linear-gradient(135deg,#f3e8ff_0%,#ede9fe_100%)]">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between px-3 py-2 text-left"
        aria-expanded={open}
      >
        <span
          className="flex items-center gap-1.5 text-[12px] font-semibold uppercase text-b-ai-accent"
          style={{ letterSpacing: '0.4px' }}
        >
          ⚡ Kræver gennemgang <PlusBadge />
        </span>
        <span className="flex items-center gap-1.5 text-[11px] text-b-ai-accent">
          <span>{docs.length} dokumenter med opmærksomhedsfelter</span>
          <span className="text-[10px]">{open ? '▾' : '▸'}</span>
        </span>
      </button>
      {open && (
        <div className="border-t border-b-ai-border bg-white">
          <div
            className="grid items-center gap-2.5 border-b border-b-border bg-b-panel-h px-3 py-1.5 text-[10px] font-semibold uppercase text-b-3"
            style={{
              gridTemplateColumns: '42px 1fr 160px 96px 90px 84px 92px',
              letterSpacing: '0.5px',
            }}
          >
            <span>Fil</span>
            <span>Navn</span>
            <span>Selskab</span>
            <span>Tilknyttet</span>
            <span>AI</span>
            <span>Konfidens</span>
            <span>Felter</span>
          </div>
          {docs.map((d, i) => (
            <button
              key={d.id}
              type="button"
              onClick={() => onRowClick(d.id)}
              className={`grid w-full items-center gap-2.5 px-3 py-1.5 text-left text-[12px] hover:bg-b-row-hover ${
                i < docs.length - 1 ? 'border-b border-b-divider' : ''
              }`}
              style={{ gridTemplateColumns: '42px 1fr 160px 96px 90px 84px 92px' }}
            >
              <Badge tone={extTone(d.ext)}>{d.ext}</Badge>
              <span className="truncate font-medium text-b-1">{d.navn}</span>
              <span className="truncate text-b-2">{d.selskab}</span>
              <span className="truncate text-b-2">{d.tilknytning}</span>
              <Badge tone={aiStatusTone(d.aiStatus)}>{d.aiStatus}</Badge>
              {d.konf != null ? (
                <Badge tone={konfTone(d.konf)}>{`AI ${d.konf}%`}</Badge>
              ) : (
                <span className="text-b-border-strong">—</span>
              )}
              {d.att > 0 ? (
                <Badge tone={attTone(d.att)}>{d.att === 1 ? '1 felt' : `${d.att} felter`}</Badge>
              ) : (
                <span className="text-b-border-strong">—</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
