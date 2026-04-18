'use client'

import { useState, useEffect, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { updateTaskStatus } from '@/actions/tasks'
import {
  TASK_STATUS_LABELS,
  getPriorityLabel,
  getPriorityStyle,
} from '@/lib/labels'
import type { TaskStatus } from '@prisma/client'

export interface KanbanTask {
  id: string
  title: string
  status: string
  priority: string
  due_date: string | null // ISO-dato-string (server→client serialisation)
  assigneeName: string | null
  caseTitle: string | null
  caseId: string | null
}

interface TasksKanbanBoardProps {
  tasks: KanbanTask[]
}

// Viser vi LUKKET-kolonne? Typisk bruges den kun når filter specifikt inkluderer lukkede
const COLUMNS: TaskStatus[] = ['NY', 'AKTIV_TASK', 'AFVENTER', 'LUKKET']

const COLUMN_ACCENT: Record<string, string> = {
  NY: 'border-t-slate-400',
  AKTIV_TASK: 'border-t-blue-500',
  AFVENTER: 'border-t-amber-500',
  LUKKET: 'border-t-emerald-500',
}

export function TasksKanbanBoard({ tasks }: TasksKanbanBoardProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [localTasks, setLocalTasks] = useState(tasks)
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null)
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null)

  // Genopfrisk når server sender nye props (efter router.refresh())
  useEffect(() => {
    setLocalTasks(tasks)
  }, [tasks])

  function handleDragStart(e: React.DragEvent, taskId: string) {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', taskId)
    setDraggedTaskId(taskId)
  }

  function handleDragEnd() {
    setDraggedTaskId(null)
    setDragOverColumn(null)
  }

  function handleDragOver(e: React.DragEvent, columnStatus: string) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (dragOverColumn !== columnStatus) setDragOverColumn(columnStatus)
  }

  function handleDragLeave(columnStatus: string) {
    if (dragOverColumn === columnStatus) setDragOverColumn(null)
  }

  async function handleDrop(e: React.DragEvent, nextStatus: string) {
    e.preventDefault()
    const taskId = e.dataTransfer.getData('text/plain')
    setDragOverColumn(null)
    setDraggedTaskId(null)

    const task = localTasks.find((t) => t.id === taskId)
    if (!task || task.status === nextStatus) return

    const previousStatus = task.status
    // Optimistisk opdatering — bekræftes af router.refresh() bagefter
    setLocalTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: nextStatus } : t))
    )

    startTransition(async () => {
      const result = await updateTaskStatus({
        taskId,
        status: nextStatus as never,
      })
      if (result.error) {
        // Rul tilbage ved fejl
        setLocalTasks((prev) =>
          prev.map((t) => (t.id === taskId ? { ...t, status: previousStatus } : t))
        )
        toast.error(result.error)
      } else {
        router.refresh()
      }
    })
  }

  const tasksByColumn: Record<string, KanbanTask[]> = {
    NY: [],
    AKTIV_TASK: [],
    AFVENTER: [],
    LUKKET: [],
  }
  for (const t of localTasks) {
    const bucket = tasksByColumn[t.status]
    if (bucket) bucket.push(t)
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      {COLUMNS.map((status) => {
        const items = tasksByColumn[status] ?? []
        const isDropTarget = dragOverColumn === status
        return (
          <div
            key={status}
            onDragOver={(e) => handleDragOver(e, status)}
            onDragLeave={() => handleDragLeave(status)}
            onDrop={(e) => handleDrop(e, status)}
            className={cn(
              'rounded-xl border border-t-2 border-slate-200 bg-slate-50/60 p-3 transition-colors',
              COLUMN_ACCENT[status],
              isDropTarget && 'bg-blue-50/80 ring-2 ring-inset ring-blue-300'
            )}
          >
            <div className="flex items-center justify-between mb-3 px-1">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                {TASK_STATUS_LABELS[status]}
              </h2>
              <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-700 tabular-nums">
                {items.length}
              </span>
            </div>

            <div className="space-y-2 min-h-[60px]">
              {items.length === 0 ? (
                <p className="py-4 text-center text-xs text-slate-400 italic">
                  {isDropTarget ? 'Slip her' : 'Ingen opgaver'}
                </p>
              ) : (
                items.map((task) => (
                  <KanbanCard
                    key={task.id}
                    task={task}
                    isDragging={draggedTaskId === task.id}
                    disabled={isPending}
                    onDragStart={(e) => handleDragStart(e, task.id)}
                    onDragEnd={handleDragEnd}
                  />
                ))
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

interface KanbanCardProps {
  task: KanbanTask
  isDragging: boolean
  disabled: boolean
  onDragStart: (e: React.DragEvent) => void
  onDragEnd: () => void
}

function KanbanCard({ task, isDragging, disabled, onDragStart, onDragEnd }: KanbanCardProps) {
  const isOverdue =
    task.due_date &&
    new Date(task.due_date) < new Date() &&
    task.status !== 'LUKKET'

  return (
    <div
      draggable={!disabled}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={cn(
        'rounded-lg border border-slate-200 bg-white p-3 shadow-sm transition-opacity',
        disabled ? 'cursor-not-allowed' : 'cursor-grab active:cursor-grabbing hover:border-slate-300',
        isDragging && 'opacity-40'
      )}
    >
      <Link
        href={`/tasks/${task.id}`}
        className="block text-sm font-medium text-slate-900 hover:text-blue-600 no-underline mb-1.5"
        onClick={(e) => e.stopPropagation()}
      >
        {task.title}
      </Link>
      <div className="flex flex-wrap items-center gap-1.5">
        <span
          className={cn(
            'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
            getPriorityStyle(task.priority)
          )}
        >
          {getPriorityLabel(task.priority)}
        </span>
        {task.due_date && (
          <span
            className={cn(
              'text-xs tabular-nums',
              isOverdue ? 'font-medium text-red-600' : 'text-slate-500'
            )}
          >
            {new Date(task.due_date).toLocaleDateString('da-DK')}
          </span>
        )}
      </div>
      {(task.assigneeName || task.caseTitle) && (
        <div className="mt-2 pt-2 border-t border-slate-100 flex flex-wrap items-center gap-1.5">
          {task.assigneeName && (
            <span className="text-xs text-slate-400">{task.assigneeName}</span>
          )}
          {task.caseTitle && task.caseId && (
            <Link
              href={`/cases/${task.caseId}`}
              className="text-xs text-blue-500 hover:text-blue-700 no-underline"
              onClick={(e) => e.stopPropagation()}
            >
              → {task.caseTitle}
            </Link>
          )}
        </div>
      )}
    </div>
  )
}
