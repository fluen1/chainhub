'use client'

import { useState } from 'react'
import { TaskStatus } from '@prisma/client'
import { format, isPast } from 'date-fns'
import { da } from 'date-fns/locale'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Calendar, User } from 'lucide-react'
import { KANBAN_COLUMNS, STATUS_LABELS, PRIORITET_LABELS, PRIORITET_COLORS } from '@/types/task'
import type { TaskWithAssignee } from '@/types/task'

interface TaskKanbanViewProps {
  tasks: TaskWithAssignee[]
  loading: boolean
  onStatusChange: (task: TaskWithAssignee, status: TaskStatus) => void
  onRefresh: () => void
}

export function TaskKanbanView({
  tasks,
  loading,
  onStatusChange,
}: TaskKanbanViewProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {KANBAN_COLUMNS.map((col) => (
          <KanbanColumnSkeleton key={col.status} label={col.label} />
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {KANBAN_COLUMNS.map((col) => {
        const columnTasks = tasks.filter((t) => t.status === col.status)
        return (
          <KanbanColumn
            key={col.status}
            status={col.status}
            label={col.label}
            borderColor={col.color}
            tasks={columnTasks}
            onStatusChange={onStatusChange}
          />
        )
      })}
    </div>
  )
}

interface KanbanColumnProps {
  status: TaskStatus
  label: string
  borderColor: string
  tasks: TaskWithAssignee[]
  onStatusChange: (task: TaskWithAssignee, status: TaskStatus) => void
}

function KanbanColumn({ status, label, borderColor, tasks, onStatusChange }: KanbanColumnProps) {
  return (
    <div className={cn('flex flex-col rounded-lg border-t-4 bg-gray-50', borderColor)}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 bg-white rounded-t-sm border-x border-b border-gray-200">
        <span className="font-medium text-sm text-gray-700">{label}</span>
        <span className="text-xs font-medium text-gray-500 bg-gray-100 rounded-full px-2 py-0.5">
          {tasks.length}
        </span>
      </div>

      {/* Kort */}
      <div className="flex flex-col gap-2 p-2 min-h-[200px]">
        {tasks.length === 0 ? (
          <div className="flex-1 flex items-center justify-center py-8">
            <p className="text-xs text-gray-400">Ingen opgaver</p>
          </div>
        ) : (
          tasks.map((task) => (
            <KanbanCard
              key={task.id}
              task={task}
              currentStatus={status}
              onStatusChange={onStatusChange}
            />
          ))
        )}
      </div>
    </div>
  )
}

interface KanbanCardProps {
  task: TaskWithAssignee
  currentStatus: TaskStatus
  onStatusChange: (task: TaskWithAssignee, status: TaskStatus) => void
}

function KanbanCard({ task, currentStatus, onStatusChange }: KanbanCardProps) {
  const [showMenu, setShowMenu] = useState(false)
  const isDue =
    task.dueDate && isPast(new Date(task.dueDate)) && task.status !== 'LUKKET'

  const otherStatuses = (['NY', 'AKTIV', 'AFVENTER', 'LUKKET'] as TaskStatus[]).filter(
    (s) => s !== currentStatus
  )

  return (
    <div className="relative bg-white rounded-md border border-gray-200 p-3 shadow-sm hover:shadow-md transition-shadow group">
      {/* Titre */}
      <Link
        href={`/tasks/${task.id}`}
        className="block font-medium text-sm text-gray-900 hover:text-blue-600 line-clamp-2 mb-2"
      >
        {task.title}
      </Link>

      {/* Prioritet badge */}
      <Badge
        variant="secondary"
        className={cn('text-xs mb-2', PRIORITET_COLORS[task.priority])}
      >
        {PRIORITET_LABELS[task.priority]}
      </Badge>

      {/* Meta */}
      <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
        {task.assignee ? (
          <div className="flex items-center gap-1">
            <div className="h-5 w-5 rounded-full bg-blue-100 flex items-center justify-center">
              <span className="text-xs font-medium text-blue-700">
                {task.assignee.name.charAt(0).toUpperCase()}
              </span>
            </div>
            <span className="truncate max-w-[80px]">{task.assignee.name}</span>
          </div>
        ) : (
          <span className="flex items-center gap-1 text-gray-400">
            <User className="h-3.5 w-3.5" />
            Ikke tildelt
          </span>
        )}

        {task.dueDate && (
          <span
            className={cn(
              'flex items-center gap-1',
              isDue ? 'text-red-600 font-medium' : 'text-gray-500'
            )}
          >
            <Calendar className="h-3.5 w-3.5" />
            {format(new Date(task.dueDate), 'd. MMM', { locale: da })}
          </span>
        )}
      </div>

      {/* Status-skift knapper — vises ved hover */}
      <div className="mt-2 pt-2 border-t border-gray-100 hidden group-hover:flex flex-wrap gap-1">
        {otherStatuses.map((s) => (
          <button
            key={s}
            onClick={() => onStatusChange(task, s)}
            className="text-xs text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded px-1.5 py-0.5 transition-colors"
          >
            → {STATUS_LABELS[s]}
          </button>
        ))}
      </div>
    </div>
  )
}

function KanbanColumnSkeleton({ label }: { label: string }) {
  return (
    <div className="flex flex-col rounded-lg border-t-4 border-gray-200 bg-gray-50">
      <div className="flex items-center justify-between px-3 py-2.5 bg-white border-x border-b border-gray-200">
        <span className="font-medium text-sm text-gray-700">{label}</span>
      </div>
      <div className="flex flex-col gap-2 p-2 animate-pulse">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-20 bg-gray-200 rounded-md" />
        ))}
      </div>
    </div>
  )
}