'use client'

import { memo } from 'react'
import type { CaseRow } from '@/app/(dashboard)/cases/cases-list-b'
import { Badge, type BadgeTone, Panel } from '@/components/ui/b'

// ────────────────────────────────────────────────────────────────────────────
// Kortvisning for sager (mobil-default — skjules fra sm+)
// ────────────────────────────────────────────────────────────────────────────

function fristTone(days: number): BadgeTone {
  if (days < 0) return 'red'
  if (days <= 3) return 'red'
  if (days <= 14) return 'amber'
  return 'gray'
}

function statusTone(status: string): BadgeTone {
  switch (status) {
    case 'Ny':
      return 'blue'
    case 'Aktiv':
      return 'blue'
    case 'Afventer ekstern':
    case 'Afventer klient':
      return 'amber'
    case 'Lukket':
      return 'green'
    case 'Arkiveret':
      return 'gray'
    default:
      return 'gray'
  }
}

const CaseCard = memo(function CaseCard({ c, onClick }: { c: CaseRow; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col gap-2 rounded-[4px] border border-b-border bg-b-panel p-2.5 text-left hover:border-b-border-strong hover:bg-b-row-hover"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <span className="mr-1.5 text-[11px] text-b-2">{c.nr}</span>
          <span className="truncate text-[13px] font-medium text-b-1">{c.title}</span>
        </div>
      </div>
      <div className="truncate text-[11px] text-b-2">
        {c.type} · {c.selskab}
      </div>
      <div className="flex flex-wrap gap-1">
        <Badge tone={statusTone(c.status)} className="text-[10px]">
          {c.status}
        </Badge>
        {c.frist !== '—' && (
          <Badge tone={fristTone(c.fristDays)} className="text-[10px]">
            {c.frist}
          </Badge>
        )}
        {c.ansvarlig !== '—' && (
          <Badge tone="gray" className="text-[10px]">
            {c.ansvarlig}
          </Badge>
        )}
      </div>
    </button>
  )
})

export function CasesCardView({
  cases,
  onRowClick,
}: {
  cases: CaseRow[]
  onRowClick: (id: string) => void
}) {
  if (cases.length === 0) {
    return (
      <Panel>
        <div className="px-3 py-8 text-center text-[13px] text-b-3">
          Ingen sager matcher de aktive filtre.
        </div>
      </Panel>
    )
  }
  return (
    <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {cases.map((c) => (
        <CaseCard key={c.id} c={c} onClick={() => onRowClick(c.id)} />
      ))}
    </div>
  )
}
