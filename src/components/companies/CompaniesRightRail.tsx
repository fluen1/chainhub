'use client'

import type { CompanyRow } from '@/app/(dashboard)/companies/companies-list-b'
import { Badge, type BadgeTone, Panel, PanelHeader } from '@/components/ui/b'

// ────────────────────────────────────────────────────────────────────────────
// Right rail — Health-heatmap + kritiske selskaber.
// Fordeling-widget er fjernet herfra (hører hjemme i Regioner-viewet,
// UX-review #5: undgå redundans).
// ────────────────────────────────────────────────────────────────────────────

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

export function CompaniesRightRail({
  companies,
  onRowClick,
}: {
  companies: CompanyRow[]
  onRowClick: (id: string) => void
}) {
  const needsAttention = companies.filter((c) => c.health === 'critical' || c.health === 'warning')

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

      {/* Fordeling-widget fjernet fra højre-rail — hører hjemme i Regioner-viewet.
          UX-review #5/#34: undgå redundans ved altid-synlig duplikat-data. */}
    </aside>
  )
}
