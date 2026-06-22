'use client'

import { Building2 } from 'lucide-react'
import { memo } from 'react'
import type { PersonRow } from '@/app/(dashboard)/persons/persons-list-b'
import { Badge, type BadgeTone, Panel } from '@/components/ui/b'

// ────────────────────────────────────────────────────────────────────────────
// Kortvisning for personer (mobil-default — skjules fra sm+)
// ────────────────────────────────────────────────────────────────────────────

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

// Lokal kopi af InitialsBox — ikke eksporteret fra persons-list-b
function InitialsBox({ ini, size = 'sm' }: { ini: string; size?: 'sm' | 'md' }) {
  const dim = size === 'md' ? 'h-8 w-8 text-[12px]' : 'h-6 w-6 text-[10px]'
  return (
    <div
      className={`${dim} flex shrink-0 items-center justify-center rounded-[4px] bg-b-blue-subtle font-medium text-b-blue-fg`}
    >
      {ini}
    </div>
  )
}

const PersonCard = memo(function PersonCard({ p, onClick }: { p: PersonRow; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
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
          {p.rolle !== '—' && <div className="mt-0.5 truncate text-[11px] text-b-2">{p.rolle}</div>}
        </div>
      </div>
      {p.selskab !== '—' && (
        <div className="flex items-center gap-1.5 text-[11px] text-b-2">
          <Building2 className="h-3 w-3 shrink-0" aria-hidden />
          <span className="truncate">{p.selskab}</span>
          {p.selskabsCount > 1 && (
            <span className="b-tnum shrink-0 rounded-[8px] bg-b-border px-1.5 py-px text-[10px] font-medium text-b-gray-fg">
              +{p.selskabsCount - 1}
            </span>
          )}
        </div>
      )}
    </button>
  )
})

export function PersonsCardView({
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
        <PersonCard key={p.id} p={p} onClick={() => onRowClick(p.id)} />
      ))}
    </div>
  )
}
