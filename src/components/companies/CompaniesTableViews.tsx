'use client'

import { memo, useMemo, useState } from 'react'
import { TableWrap, Th, Tr, Td, TableEmpty, Badge, type BadgeTone } from '@/components/ui/b'
import type { CompanyRow } from '@/app/(dashboard)/companies/companies-list-b'

// ────────────────────────────────────────────────────────────────────────────
// Tabel- og regionsvisning for selskaber
// ────────────────────────────────────────────────────────────────────────────

type SortKey =
  | 'navn'
  | 'cvr'
  | 'type'
  | 'kaedePct'
  | 'kontrakter'
  | 'sager'
  | 'ebitda'
  | 'sortScore'

type Region = 'Kbh' | 'Sjælland' | 'Syd' | 'Midt' | 'Nord' | 'Ukendt'

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

export interface CompaniesFlatTableProps {
  companies: CompanyRow[]
  sortCol: SortKey
  sortDir: 'asc' | 'desc'
  onSort: (col: SortKey) => void
  onRowClick: (id: string) => void
}

export function CompaniesFlatTable({
  companies,
  sortCol,
  sortDir,
  onSort,
  onRowClick,
}: CompaniesFlatTableProps) {
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

export const CompanyTr = memo(function CompanyTr({ c, onClick }: { c: CompanyRow; onClick: () => void }) {
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
})

export function CompaniesRegionsView({
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
      const arr = map.get(c.region as Region) ?? []
      arr.push(c)
      map.set(c.region as Region, arr)
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
