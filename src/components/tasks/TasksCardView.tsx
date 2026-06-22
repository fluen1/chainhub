'use client'

import { memo } from 'react'
import type { TaskRow } from '@/app/(dashboard)/tasks/tasks-list-b'
import { Badge, type BadgeTone, Panel } from '@/components/ui/b'

// ────────────────────────────────────────────────────────────────────────────
// Kortvisning for opgaver (mobil-default — skjules fra sm+)
// ────────────────────────────────────────────────────────────────────────────

function prioTone(rawPrio: string): BadgeTone {
  switch (rawPrio) {
    case 'KRITISK':
      return 'red'
    case 'HOEJ':
      return 'amber'
    case 'MELLEM':
      return 'blue'
    default:
      return 'gray'
  }
}

function statusTone(rawStatus: string): BadgeTone {
  switch (rawStatus) {
    case 'NY':
      return 'gray'
    case 'AKTIV_TASK':
      return 'blue'
    case 'AFVENTER':
      return 'amber'
    case 'LUKKET':
      return 'green'
    default:
      return 'gray'
  }
}

function fristTone(days: number): BadgeTone {
  if (days >= 9999) return 'gray'
  if (days < 0) return 'red'
  if (days <= 1) return 'red'
  if (days <= 7) return 'amber'
  return 'gray'
}

const TaskCard = memo(function TaskCard({ t, onClick }: { t: TaskRow; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col gap-2 rounded-[4px] border border-b-border bg-b-panel p-2.5 text-left hover:border-b-border-strong hover:bg-b-row-hover"
    >
      <div className="flex items-start justify-between gap-2">
        <span
          className={`min-w-0 truncate text-[13px] font-medium text-b-1${t.rawStatus === 'LUKKET' ? ' line-through' : ''}`}
        >
          {t.titel}
        </span>
      </div>
      <div className="truncate text-[11px] text-b-2">
        {t.type} · {t.selskab}
      </div>
      <div className="flex flex-wrap gap-1">
        <Badge tone={prioTone(t.rawPrio)} className="text-[10px]">
          {t.prio}
        </Badge>
        <Badge tone={statusTone(t.rawStatus)} className="text-[10px]">
          {t.status}
        </Badge>
        {t.frist !== '—' && (
          <Badge tone={fristTone(t.fristDays)} className="text-[10px]">
            {t.frist}
          </Badge>
        )}
      </div>
    </button>
  )
})

export function TasksCardView({
  tasks,
  onRowClick,
}: {
  tasks: TaskRow[]
  onRowClick: (id: string) => void
}) {
  if (tasks.length === 0) {
    return (
      <Panel>
        <div className="px-3 py-8 text-center text-[13px] text-b-3">
          Ingen opgaver matcher de aktive filtre.
        </div>
      </Panel>
    )
  }
  return (
    <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {tasks.map((t) => (
        <TaskCard key={t.id} t={t} onClick={() => onRowClick(t.id)} />
      ))}
    </div>
  )
}
