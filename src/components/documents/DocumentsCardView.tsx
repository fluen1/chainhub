'use client'

import { memo } from 'react'
import type { DocRow } from '@/app/(dashboard)/documents/documents-list-b'
import { Badge, type BadgeTone, Panel } from '@/components/ui/b'

// ────────────────────────────────────────────────────────────────────────────
// Kortvisning for dokumenter (mobil-default — skjules fra sm+)
// ────────────────────────────────────────────────────────────────────────────

type AiStatus = 'AI ✓' | 'Review' | 'Afventer' | 'Ikke AI'

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

function attTone(att: number): BadgeTone {
  if (att === 1) return 'amber'
  return 'red'
}

const DocumentCard = memo(function DocumentCard({
  d,
  onClick,
}: {
  d: DocRow
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col gap-2 rounded-[4px] border border-b-border bg-b-panel p-2.5 text-left hover:border-b-border-strong hover:bg-b-row-hover"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-1.5">
          <Badge tone={extTone(d.ext)} className="shrink-0 text-[10px]">
            {d.ext}
          </Badge>
          <span className="min-w-0 truncate text-[13px] font-medium text-b-1">{d.navn}</span>
        </div>
        <span className="shrink-0 text-[11px] text-b-2">{d.size}</span>
      </div>
      <div className="truncate text-[11px] text-b-2">
        {d.selskab}
        {d.tilknytning !== '—' ? ` · ${d.tilknytning}` : ''}
      </div>
      <div className="flex flex-wrap gap-1">
        <Badge tone={aiStatusTone(d.aiStatus)} className="text-[10px]">
          {d.aiStatus}
        </Badge>
        {d.att > 0 && (
          <Badge tone={attTone(d.att)} className="text-[10px]">
            {d.att} opmærk.
          </Badge>
        )}
        <Badge tone="gray" className="text-[10px]">
          {d.dato}
        </Badge>
      </div>
    </button>
  )
})

export function DocumentsCardView({
  docs,
  onRowClick,
}: {
  docs: DocRow[]
  onRowClick: (id: string) => void
}) {
  if (docs.length === 0) {
    return (
      <Panel>
        <div className="px-3 py-8 text-center text-[13px] text-b-3">
          Ingen dokumenter matcher de aktive filtre.
        </div>
      </Panel>
    )
  }
  return (
    <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {docs.map((d) => (
        <DocumentCard key={d.id} d={d} onClick={() => onRowClick(d.id)} />
      ))}
    </div>
  )
}
