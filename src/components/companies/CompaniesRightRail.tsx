'use client'

import { useMemo } from 'react'
import { Badge, type BadgeTone, Panel, PanelHeader } from '@/components/ui/b'
import type { CompanyRow } from '@/app/(dashboard)/companies/companies-list-b'

// ────────────────────────────────────────────────────────────────────────────
// Right rail — Health heatmap, kritiske selskaber, fordeling
// ────────────────────────────────────────────────────────────────────────────

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

function healthCellBg(h: CompanyRow['health']): string {
  if (h === 'critical') return 'bg-[#b91c1c]'
  if (h === 'warning') return 'bg-[#fdb8b1]'
  return 'bg-[#239a3b]'
}

function RailRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between px-3 py-1 text-[11px]">
      <span className="text-b-2">{label}</span>
      <span className="b-tnum font-medium text-b-1">{value}</span>
    </div>
  )
}

export function CompaniesRightRail({
  companies,
  onRowClick,
}: {
  companies: CompanyRow[]
  onRowClick: (id: string) => void
}) {
  const needsAttention = companies.filter((c) => c.health === 'critical' || c.health === 'warning')

  const byRegion = useMemo(() => {
    const m = new Map<Region, number>()
    for (const c of companies) m.set(c.region as Region, (m.get(c.region as Region) ?? 0) + 1)
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
