'use client'

import { memo } from 'react'
import type { ContractRow } from '@/app/(dashboard)/contracts/contracts-list-b'
import { Badge, type BadgeTone, AIBadge, Panel } from '@/components/ui/b'

// ────────────────────────────────────────────────────────────────────────────
// Kortvisning for kontrakter (mobil-default — skjules fra sm+)
// ────────────────────────────────────────────────────────────────────────────

function udlobTone(days: number): BadgeTone {
  if (days < 0) return 'red'
  if (days <= 30) return 'red'
  if (days <= 60) return 'amber'
  return 'gray'
}

function statusTone(status: string): BadgeTone {
  if (status === 'Aktiv') return 'green'
  if (status === 'Udløbet') return 'red'
  return 'gray'
}

function sensitivityTone(sens: string): BadgeTone {
  if (sens === 'INTERN') return 'blue'
  if (sens === 'FORTROLIG' || sens === 'STRENGT FORTROLIG') return 'amber'
  return 'gray'
}

function shortSens(sens: string): string {
  if (sens === 'STRENGT FORTROLIG') return 'STRENGT'
  return sens
}

const ContractCard = memo(function ContractCard({
  c,
  onClick,
}: {
  c: ContractRow
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col gap-2 rounded-[4px] border border-b-border bg-b-panel p-2.5 text-left hover:border-b-border-strong hover:bg-b-row-hover"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="min-w-0 truncate text-[13px] font-medium text-b-1">{c.type}</span>
        {c.ai && <AIBadge />}
      </div>
      <div className="truncate text-[11px] text-b-2">{c.selskab}</div>
      <div className="flex flex-wrap gap-1">
        <Badge tone={statusTone(c.status)} className="text-[10px]">
          {c.status}
        </Badge>
        {c.udlob !== '—' && (
          <Badge tone={udlobTone(c.udlobDays)} className="text-[10px]">
            {c.udlob}
          </Badge>
        )}
        {c.sensitivity && c.sensitivity !== 'PUBLIC' && c.sensitivity !== 'STANDARD' && (
          <Badge tone={sensitivityTone(c.sensitivity)} className="text-[10px]">
            {shortSens(c.sensitivity)}
          </Badge>
        )}
      </div>
    </button>
  )
})

export function ContractsCardView({
  contracts,
  onRowClick,
}: {
  contracts: ContractRow[]
  onRowClick: (id: string) => void
}) {
  if (contracts.length === 0) {
    return (
      <Panel>
        <div className="px-3 py-8 text-center text-[13px] text-b-3">
          Ingen kontrakter matcher de aktive filtre.
        </div>
      </Panel>
    )
  }
  return (
    <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {contracts.map((c) => (
        <ContractCard key={c.id} c={c} onClick={() => onRowClick(c.id)} />
      ))}
    </div>
  )
}
