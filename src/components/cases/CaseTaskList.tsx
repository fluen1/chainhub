'use client'

import { useState, useTransition } from 'react'
import { createTask, updateTask, deleteTask } from '@/actions/cases'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { PlusIcon, CheckIcon, TrashIcon, ClockIcon } from 'lucide-react'
import { format } from 'date-fns'
import { da } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import type { TaskWithAssignee } from '@/types/case'
import type { TaskStatus } from '@prisma/client'

interface CaseTaskListProps {
  caseId: string
  initialTasks: TaskWithAssignee[]
}

const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  NY: 'Ny',
  AKTIV: 'Aktiv',
  AFVENTER: 'Afventer',
  LUKKET: 'Lukket',
}

const TASK_STATUS_STYLES: Record<TaskStatus, string> = {
  NY: 'bg-blue-50 text-blue-700',
  AKTIV: 'bg-green-50 text-green-700',
  AFVENTER: 'bg-yellow-50 text-yellow-700',
  LUKKET: 'bg-gray-50 text-gray-500',
}

export function CaseTaskList({ caseId, initialTasks }: CaseTaskListProps) {
  const [tasks, setTasks] = useState(initialTasks)
  const [isPending, startTransition] = useTransition()
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [showNewTask, setShowNewTask] = useState(false)

  function handleCreateTask() {
    if (!newTaskTitle.trim()) return

    startTransition(async () => {
      const result = await createTask({
        caseId,
        title: newTaskTitle.trim(),
      })
      if (result.error) {
        toast.error(result.error)
        return
      }
      setTasks((prev) => [result.data as TaskWithAssignee, ...prev])
      setNewTaskTitle('')
      setShowNewTask(false)
      toast.success('Opgaven er oprettet')
    })
  }

  function handleToggleStatus(task: TaskWithAssignee) {
    const newStatus: TaskStatus = task.status === 'LUKKET' ? 'AKTIV' : 'LUKKET'
    startTransition(async () => {
      const result = await updateTask({
        taskId: task.id,
        caseId,
        status: newStatus,
      })
      if (result.error) {
        toast.error(result.error)
        return
      }
      setTasks((prev) =>
        prev.map((t) => (t.id === task.id ? { ...t, status: newStatus } : t))
      )
    })
  }

  function handleDeleteTask(taskId: string) {
    startTransition(async () => {
      const result = await deleteTask({ taskId, caseId })
      if (result.error) {
        toast.error(result.error)
        return
      }
      setTasks((prev) => prev.filter((t) => t.id !== taskId))
      toast.success('Opgaven er slettet')
    })
  }

  const activeTasks = tasks.filter((t) => t.status !== 'LUKKET')
  const completedTasks = tasks.filter((t) => t.status === 'LUKKET')

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-gray-900">
          Opgaver ({tasks.length})
        </h3>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setShowNewTask(true)}
          disabled={isPending}
        >
          <PlusIcon className="mr-1.5 h-3.5 w-3.5" />
          Tilføj opgave
        </Button>
      </div>

      {/* Ny opgave input */}
      {showNewTask && (
        <div className="flex gap-2">
          <Input
            placeholder="Opgavetitel..."
            value={newTaskTitle}
            onChange={(e) => setNewTaskTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreateTask()
              if (e.key === 'Escape') {
                setShowNewTask(false)
                setNewTaskTitle('')
              }
            }}
            autoFocus
          />
          <Button size="sm" onClick={handleCreateTask} disabled={!newTaskTitle.trim() || isPending}>
            Opret
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setShowNewTask(false)
              setNewTaskTitle('')
            }}
          >
            Annuller
          </Button>
        </div>
      )}

      {/* Tom tilstand */}
      {tasks.length === 0 && (
        <div className="rounded-lg border border-dashed border-gray-300 py-8 text-center">
          <p className="text-sm text-gray-500">Ingen opgaver endnu</p>
          <p className="mt-1 text-xs text-gray-400">
            Tilføj opgaver for at holde styr på arbejdet
          </p>
        </div>
      )}

      {/* Aktive opgaver */}
      {activeTasks.length > 0 && (
        <div className="space-y-1">
          {activeTasks.map((task) => (
            <div
              key={task.id}
              className="group flex items-center gap-3 rounded-lg border border-gray-100 bg-white p-3 hover:border-gray-200"
            >
              <button
                onClick={() => handleToggleStatus(task)}
                disabled={isPending}
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-gray-300 hover:border-green-500 transition-colors"
              >
                {task.status === 'LUKKET' && (
                  <CheckIcon className="h-3 w-3 text-green-500" />
                )}
              </button>
              <div className="min-w-0 flex-1">
                <span className="text-sm text-gray-900">{task.title}</span>
                <div className="mt-0.5 flex items-center gap-2">
                  <span
                    className={cn(
                      'inline-flex rounded px-1.5 py-0.5 text-xs font-medium',
                      TASK_STATUS_STYLES[task.status]
                    )}
                  >
                    {TASK_STATUS_LABELS[task.status]}
                  </span>
                  {task.dueDate && (
                    <span className="flex items-center gap-0.5 text-xs text-gray-400">
                      <ClockIcon className="h-3 w-3" />
                      {format(new Date(task.dueDate), 'd. MMM', { locale: da })}
                    </span>
                  )}
                  {task.assignee && (
                    <span className="text-xs text-gray-400">{task.assignee.name}</span>
                  )}
                </div>
              </div>
              <button
                onClick={() => handleDeleteTask(task.id)}
                disabled={isPending}
                className="invisible text-gray-400 hover:text-red-500 group-hover:visible"
              >
                <TrashIcon className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Lukkede opgaver */}
      {completedTasks.length > 0 && (
        <details className="group">
          <summary className="cursor-pointer text-sm text-gray-500 hover:text-gray-700">
            {completedTasks.length} afsluttet opgave{completedTasks.length !== 1 ? 'r' : ''}
          </summary>
          <div className="mt-2 space-y-1">
            {completedTasks.map((task) => (
              <div
                key={task.id}
                className="flex items-center gap-3 rounded-lg border border-gray-100 bg-gray-50 p-3 opacity-60"
              >
                <button
                  onClick={() => handleToggleStatus(task)}
                  disabled={isPending}
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-green-500 bg-green-500"
                >
                  <CheckIcon className="h-3 w-3 text-white" />
                </button>
                <span className="text-sm text-gray-500 line-through">{task.title}</span>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  )
}