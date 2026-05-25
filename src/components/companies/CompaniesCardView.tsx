'use client'

import { Badge, type BadgeTone, Panel } from '@/components/ui/b'
import type { CompanyRow } from '@/app/(dashboard)/companies/companies-list-b'

// ────────────────────────────────────────────────────────────────────────────
// Kortvisning for selskaber
// ────────────────────────────────────────────────────────────────────────────

function healthLabel(h: CompanyRow['health']): { label: string; tone: BadgeTone } {
  if (h === 'critical') return { label: 'Kritisk', tone: 'red' }
  if (h === 'warning') return { label: 'Opmærks.', tone: 'amber' }
  return { label: 'OK', tone: 'green' }
}

export function CompaniesCardView({
  companies,
  onRowClick,
}: {
  companies: CompanyRow[]
  onRowClick: (id: string) => void
}) {
  if (companies.length === 0) {
    return (
      <Panel>
        <div className="px-3 py-8 text-center text-[13px] text-b-3">
          Ingen selskaber matcher de aktive filtre.
        </div>
      </Panel>
    )
  }
  return (
    <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {companies.map((c) => {
        const hb = healthLabel(c.health)
        return (
          <button
            key={c.id}
            type="button"
            onClick={() => onRowClick(c.id)}
            className="flex flex-col gap-2 rounded-[4px] border border-b-border bg-b-panel p-2.5 text-left hover:border-b-border-strong hover:bg-b-row-hover"
          >
            <div className="flex items-start justify-between gap-2">
              <span className="min-w-0 truncate text-[13px] font-medium text-b-1">{c.navn}</span>
              <Badge tone={hb.tone} className="text-[10px]">
                {hb.label}
              </Badge>
            </div>
            <div className="truncate text-[11px] text-b-2">
              {c.type} · CVR {c.cvr}
              {c.city ? ` · ${c.city}` : ''}
            </div>
            <div className="flex flex-wrap gap-1">
              <Badge tone="gray" className="text-[10px]">
                {c.kaedePct}%
              </Badge>
              <Badge
                tone={c.kontrakterUdlob > 0 || c.kontrakterExpired > 0 ? 'amber' : 'gray'}
                className="text-[10px]"
              >
                {c.kontrakter} kontr.
              </Badge>
              {c.sager > 0 && (
                <Badge tone={c.sager > 1 ? 'red' : 'amber'} className="text-[10px]">
                  {c.sager} sager
                </Badge>
              )}
              {c.ebitda != null && (
                <Badge tone="green" className="text-[10px]">
                  {c.ebitdaShort}
                </Badge>
              )}
            </div>
          </button>
        )
      })}
    </div>
  )
}
