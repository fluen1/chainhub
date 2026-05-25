'use client'

import { useMemo, useState } from 'react'
import { TableWrap, TableEmpty, Badge } from '@/components/ui/b'
import { TaskTr } from '@/components/tasks/TasksFlatTable'
import type { TaskRow } from '@/app/(dashboard)/tasks/tasks-list-b'

// ────────────────────────────────────────────────────────────────────────────
// Grupperet visning — grupperer opgaver per selskab
// ────────────────────────────────────────────────────────────────────────────

export function TasksGroupedView({
  tasks,
  onRowClick,
}: {
  tasks: TaskRow[]
  onRowClick: (id: string) => void
}) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  const groups = useMemo(() => {
    const map = new Map<string, TaskRow[]>()
    for (const t of tasks) {
      const arr = map.get(t.selskab) ?? []
      arr.push(t)
      map.set(t.selskab, arr)
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b, 'da-DK'))
  }, [tasks])

  if (tasks.length === 0) {
    return (
      <TableWrap>
        <TableEmpty>Ingen opgaver matcher de aktive filtre.</TableEmpty>
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
      {groups.map(([name, rows]) => {
        const isOpen = !collapsed.has(name)
        const hasUrgent = rows.some(
          (r) => r.fristDays <= 1 && r.fristDays < 9999 && r.rawStatus !== 'LUKKET'
        )
        return (
          <div key={name}>
            <button
              type="button"
              onClick={() => toggle(name)}
              className="flex w-full items-center gap-2 border-b border-b-border bg-b-row-hover px-3 py-1.5 text-left hover:bg-[#ecedf0]"
            >
              <span className="w-3 shrink-0 text-[10px] text-b-2">{isOpen ? '▾' : '▸'}</span>
              <span className="flex-1 text-[12px] font-semibold text-b-1">{name}</span>
              <span
                className={`b-tnum rounded-[10px] px-1.5 py-px text-[10px] font-semibold ${
                  hasUrgent ? 'bg-b-red-bg text-b-red-fg' : 'bg-b-border text-b-gray-fg'
                }`}
              >
                {rows.length}
              </span>
              {hasUrgent && (
                <Badge tone="red" className="text-[10px]">
                  ⚠
                </Badge>
              )}
            </button>
            {isOpen && (
              <table className="w-full table-fixed border-collapse">
                <tbody>
                  {rows.map((t) => (
                    <TaskTr key={t.id} t={t} hideSelskab onClick={() => onRowClick(t.id)} />
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
