'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { toast } from 'sonner'
import { updateTaskStatus } from '@/actions/tasks'
import type { TaskRow } from '@/app/(dashboard)/tasks/tasks-list-b'
import { Badge, type BadgeTone, Panel, SegmentedToggle } from '@/components/ui/b'
import { safeAction } from '@/lib/safe-action'

// ────────────────────────────────────────────────────────────────────────────
// Kanban-visning for opgaver — drag-drop, keyboard-nav og aria-live
// ────────────────────────────────────────────────────────────────────────────

type TaskStatus = 'NY' | 'AKTIV_TASK' | 'AFVENTER' | 'LUKKET'

function statusLabel(rawStatus: string): string {
  switch (rawStatus) {
    case 'NY':
      return 'Åben'
    case 'AKTIV_TASK':
      return 'I gang'
    case 'AFVENTER':
      return 'Afventer'
    case 'LUKKET':
      return 'Fuldført'
    default:
      return rawStatus
  }
}

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

function fristTone(days: number): BadgeTone {
  if (days >= 9999) return 'gray'
  if (days < 0) return 'red'
  if (days <= 1) return 'red'
  if (days <= 7) return 'amber'
  return 'gray'
}

type KanbanColDef = {
  title: string
  rawStatus: string
  tone: 'default' | 'amber' | 'blue' | 'green'
}
const KANBAN_COLS: KanbanColDef[] = [
  { title: 'Åben', rawStatus: 'NY', tone: 'default' },
  { title: 'I gang', rawStatus: 'AKTIV_TASK', tone: 'blue' },
  { title: 'Afventer', rawStatus: 'AFVENTER', tone: 'amber' },
  { title: 'Fuldført', rawStatus: 'LUKKET', tone: 'green' },
]

const KANBAN_STATUS_ORDER: TaskStatus[] = ['NY', 'AKTIV_TASK', 'AFVENTER', 'LUKKET']

const KANBAN_MOBILE_TABS: Array<{ value: string; label: string }> = [
  { value: 'NY', label: 'Åben' },
  { value: 'AKTIV_TASK', label: 'I gang' },
  { value: 'AFVENTER', label: 'Afventer' },
  { value: 'LUKKET', label: 'Fuldført' },
]

export function KanbanView({
  tasks,
  onRowClick,
}: {
  tasks: TaskRow[]
  onRowClick: (id: string) => void
}) {
  const [localTasks, setLocalTasks] = useState<TaskRow[]>(tasks)
  const prevTasksRef = useRef(tasks)

  useEffect(() => {
    if (prevTasksRef.current !== tasks) {
      prevTasksRef.current = tasks
      setLocalTasks(tasks)
    }
  }, [tasks])

  const [liveMsg, setLiveMsg] = useState('')
  const [grabbedId, setGrabbedId] = useState<string | null>(null)
  const [selectedKanbanStatus, setSelectedKanbanStatus] = useState<string>('NY')

  const moveTask = useCallback(
    async (taskId: string, newStatus: TaskStatus) => {
      const prev = localTasks
      const task = prev.find((t) => t.id === taskId)
      if (!task) return

      const updated = prev.map((t) =>
        t.id === taskId ? { ...t, rawStatus: newStatus, status: statusLabel(newStatus) } : t
      )
      setLocalTasks(updated)
      setLiveMsg(`Opgave "${task.titel}" flyttet til ${statusLabel(newStatus)}`)

      const data = await safeAction(
        updateTaskStatus({ taskId, status: newStatus }),
        'Status kunne ikke opdateres — prøv igen.'
      )
      if (!data) {
        setLocalTasks(prev)
        setLiveMsg(`Opgave "${task.titel}" kunne ikke flyttes — prøv igen`)
      }
    },
    [localTasks]
  )

  const handleDrop = useCallback(
    (colStatus: TaskStatus, e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      const taskId = e.dataTransfer.getData('task-id')
      if (!taskId) return
      const task = localTasks.find((t) => t.id === taskId)
      if (!task || task.rawStatus === colStatus) return
      void moveTask(taskId, colStatus)
    },
    [localTasks, moveTask]
  )

  const handleKeyboardMove = useCallback(
    (taskId: string, direction: 'left' | 'right') => {
      const task = localTasks.find((t) => t.id === taskId)
      if (!task) return
      const currentIdx = KANBAN_STATUS_ORDER.indexOf(task.rawStatus as TaskStatus)
      if (currentIdx === -1) return
      const nextIdx = direction === 'right' ? currentIdx + 1 : currentIdx - 1
      if (nextIdx < 0 || nextIdx >= KANBAN_STATUS_ORDER.length) return
      const newStatus = KANBAN_STATUS_ORDER[nextIdx]
      if (!newStatus) return
      void moveTask(taskId, newStatus)
    },
    [localTasks, moveTask]
  )

  return (
    <>
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {liveMsg}
      </div>

      <div className="mb-2.5 lg:hidden" data-testid="kanban-mobile-tabs">
        <SegmentedToggle<string>
          value={selectedKanbanStatus}
          onChange={setSelectedKanbanStatus}
          options={KANBAN_MOBILE_TABS}
        />
      </div>

      <div className="grid gap-2.5 lg:grid-cols-4 lg:items-start">
        {KANBAN_COLS.map((col) => {
          const items = localTasks.filter((t) => t.rawStatus === col.rawStatus)
          const isVisibleOnMobile = col.rawStatus === selectedKanbanStatus
          return (
            <div
              key={col.rawStatus}
              className={isVisibleOnMobile ? 'block lg:block' : 'hidden lg:block'}
            >
              <KanbanCol
                title={col.title}
                tone={col.tone}
                rawStatus={col.rawStatus as TaskStatus}
                items={items}
                onRowClick={onRowClick}
                onDrop={handleDrop}
                grabbedId={grabbedId}
                onGrab={(id) => setGrabbedId(id)}
                onRelease={() => {
                  setGrabbedId(null)
                  setLiveMsg('Flytning annulleret')
                }}
                onKeyboardMove={handleKeyboardMove}
              />
            </div>
          )
        })}
      </div>
    </>
  )
}

function KanbanCol({
  title,
  tone,
  rawStatus,
  items,
  onRowClick,
  onDrop,
  grabbedId,
  onGrab,
  onRelease,
  onKeyboardMove,
}: {
  title: string
  tone: 'default' | 'amber' | 'blue' | 'green'
  rawStatus: TaskStatus
  items: TaskRow[]
  onRowClick: (id: string) => void
  onDrop: (colStatus: TaskStatus, e: React.DragEvent<HTMLDivElement>) => void
  grabbedId: string | null
  onGrab: (id: string) => void
  onRelease: () => void
  onKeyboardMove: (id: string, direction: 'left' | 'right') => void
}) {
  const [isDragOver, setIsDragOver] = useState(false)

  const headerCls =
    tone === 'amber'
      ? 'bg-b-amber-bg text-b-amber-fg'
      : tone === 'blue'
        ? 'bg-b-blue-bg text-b-blue-fg'
        : tone === 'green'
          ? 'bg-b-green-bg text-b-green-fg'
          : 'bg-b-panel-h text-b-1'
  const countCls =
    tone === 'amber'
      ? 'bg-[#f5d673] text-b-amber-fg'
      : tone === 'blue'
        ? 'bg-[#b6e3ff] text-b-blue-fg'
        : tone === 'green'
          ? 'bg-[#92dca7] text-b-green-fg'
          : 'bg-b-border text-b-gray-fg'

  return (
    <Panel>
      <div
        className={`flex items-center justify-between border-b border-b-border px-2.5 py-1.5 ${headerCls}`}
      >
        <span className="text-[11px] font-semibold uppercase" style={{ letterSpacing: '0.5px' }}>
          {title}
        </span>
        <span
          className={`b-tnum rounded-[10px] px-1.5 py-px text-[10px] font-semibold ${countCls}`}
        >
          {items.length}
        </span>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault()
          setIsDragOver(true)
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={(e) => {
          setIsDragOver(false)
          onDrop(rawStatus, e)
        }}
        className={`min-h-[48px] transition-colors ${isDragOver ? 'bg-b-row-hover ring-2 ring-inset ring-b-border' : ''}`}
      >
        {items.length === 0 ? (
          <div className="px-3 py-2 text-[12px] text-b-3">Ingen</div>
        ) : (
          items.map((t) => (
            <KanbanCard
              key={t.id}
              task={t}
              isGrabbed={grabbedId === t.id}
              onRowClick={onRowClick}
              onGrab={onGrab}
              onRelease={onRelease}
              onKeyboardMove={onKeyboardMove}
            />
          ))
        )}
      </div>
    </Panel>
  )
}

function KanbanCard({
  task,
  isGrabbed,
  onRowClick,
  onGrab,
  onRelease,
  onKeyboardMove,
}: {
  task: TaskRow
  isGrabbed: boolean
  onRowClick: (id: string) => void
  onGrab: (id: string) => void
  onRelease: () => void
  onKeyboardMove: (id: string, direction: 'left' | 'right') => void
}) {
  const done = task.rawStatus === 'LUKKET'

  function handleKeyDown(e: React.KeyboardEvent<HTMLButtonElement>) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      if (isGrabbed) {
        onRelease()
        onRowClick(task.id)
      } else {
        onGrab(task.id)
      }
    } else if (e.key === 'Escape') {
      if (isGrabbed) {
        e.preventDefault()
        onRelease()
      }
    } else if (e.key === 'ArrowRight') {
      if (isGrabbed) {
        e.preventDefault()
        onKeyboardMove(task.id, 'right')
      }
    } else if (e.key === 'ArrowLeft') {
      if (isGrabbed) {
        e.preventDefault()
        onKeyboardMove(task.id, 'left')
      }
    }
  }

  return (
    <button
      type="button"
      draggable
      aria-pressed={isGrabbed}
      aria-label={`${task.titel} — ${task.selskab}. Tryk Enter for at gribe, piletaster for at flytte.`}
      onDragStart={(e) => {
        e.dataTransfer.setData('task-id', task.id)
        e.dataTransfer.effectAllowed = 'move'
      }}
      onClick={() => {
        if (!isGrabbed) onRowClick(task.id)
      }}
      onKeyDown={handleKeyDown}
      className={[
        'flex w-full flex-col gap-1 border-b border-b-divider px-2.5 py-1.5 text-left last:border-b-0 hover:bg-b-row-hover',
        done ? 'opacity-60' : '',
        isGrabbed ? 'ring-2 ring-inset ring-b-blue-fg border-b-blue-fg bg-b-blue-bg' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div
        className={`line-clamp-2 text-[12px] font-medium ${
          done ? 'text-b-3 line-through' : 'text-b-1'
        }`}
      >
        {task.titel}
      </div>
      <div className="truncate text-[11px] text-b-2">{task.selskab}</div>
      <div className="flex flex-wrap gap-1">
        <Badge tone={prioTone(task.rawPrio)} className="text-[10px]">
          {task.prio}
        </Badge>
        {task.frist !== '—' && (
          <Badge tone={fristTone(task.fristDays)} className="text-[10px]">
            {task.frist}
          </Badge>
        )}
        <Badge tone="gray" className="text-[10px]">
          {task.ansvarlig.split(' ')[0]}
        </Badge>
      </div>
    </button>
  )
}
