'use client'

import { memo } from 'react'
import type { TaskRow } from '@/app/(dashboard)/tasks/tasks-list-b'
import { TableWrap, Th, Tr, Td, TableEmpty, Badge, type BadgeTone } from '@/components/ui/b'

// ────────────────────────────────────────────────────────────────────────────
// Flat tabel + grupperet tabel for opgaver
// ────────────────────────────────────────────────────────────────────────────

type SortKey = 'titel' | 'selskab' | 'type' | 'rawPrio' | 'rawStatus' | 'fristDays' | 'ansvarlig'

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

export interface TasksFlatTableProps {
  tasks: TaskRow[]
  sortCol: SortKey
  sortDir: 'asc' | 'desc'
  onSort: (col: SortKey) => void
  onRowClick: (id: string) => void
}

export function TasksFlatTable({
  tasks,
  sortCol,
  sortDir,
  onSort,
  onRowClick,
}: TasksFlatTableProps) {
  if (tasks.length === 0) {
    return (
      <TableWrap>
        <TableEmpty>Ingen opgaver matcher de aktive filtre.</TableEmpty>
      </TableWrap>
    )
  }

  return (
    <TableWrap>
      <table className="w-full table-fixed border-collapse">
        <thead>
          <tr>
            <Th col="titel" sortCol={sortCol} sortDir={sortDir} onSort={onSort} sticky>
              Titel
            </Th>
            <Th col="selskab" sortCol={sortCol} sortDir={sortDir} onSort={onSort} width={170}>
              Selskab
            </Th>
            <Th col="type" sortCol={sortCol} sortDir={sortDir} onSort={onSort} width={96}>
              Type
            </Th>
            <Th col="rawPrio" sortCol={sortCol} sortDir={sortDir} onSort={onSort} width={80}>
              Prio
            </Th>
            <Th col="rawStatus" sortCol={sortCol} sortDir={sortDir} onSort={onSort} width={92}>
              Status
            </Th>
            <Th col="fristDays" sortCol={sortCol} sortDir={sortDir} onSort={onSort} width={110}>
              Frist
            </Th>
            <Th col="ansvarlig" sortCol={sortCol} sortDir={sortDir} onSort={onSort} width={110}>
              Ansv.
            </Th>
            <Th width={20}>{''}</Th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((t) => (
            <TaskTr key={t.id} t={t} onClick={() => onRowClick(t.id)} />
          ))}
        </tbody>
      </table>
    </TableWrap>
  )
}

export const TaskTr = memo(function TaskTr({
  t,
  onClick,
  hideSelskab,
}: {
  t: TaskRow
  onClick: () => void
  hideSelskab?: boolean
}) {
  const done = t.rawStatus === 'LUKKET'
  return (
    <Tr onClick={onClick} ariaLabel={`${t.titel} – åbn opgave`}>
      <Td sticky title={t.titel}>
        <span className={done ? 'text-b-3 line-through' : 'font-medium text-b-1'}>{t.titel}</span>
      </Td>
      {!hideSelskab && (
        <Td width={170} secondary>
          {t.selskab}
        </Td>
      )}
      <Td width={96} secondary>
        {t.type}
      </Td>
      <Td width={80}>
        <Badge tone={prioTone(t.rawPrio)}>{t.prio}</Badge>
      </Td>
      <Td width={92}>
        <Badge tone={statusTone(t.rawStatus)}>{t.status}</Badge>
      </Td>
      <Td width={110}>
        {t.frist === '—' ? (
          <span className="text-b-border-strong">—</span>
        ) : (
          <Badge tone={fristTone(t.fristDays)}>{t.frist}</Badge>
        )}
      </Td>
      <Td width={110} secondary>
        {t.ansvarlig}
      </Td>
      <Td width={20}>
        <span className="text-b-3">›</span>
      </Td>
    </Tr>
  )
})
