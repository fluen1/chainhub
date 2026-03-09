'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { format, isPast } from 'date-fns'
import { da } from 'date-fns/locale'
import { updateTask, deleteTask, updateTaskStatus } from '@/actions/tasks'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { ArrowLeft, Calendar, User, Link2, Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { TaskStatus } from '@prisma/client'
import { STATUS_LABELS, STATUS_COLORS, PRIORITET_LABELS, PRIORITET_COLORS } from '@/types/task'
import { TaskFormDialog } from './TaskFormDialog'
import type { TaskWithAssignee } from '@/types/task'

interface User {
  id: string
  name: string
  email: string
  avatarUrl: string | null
}

interface TaskDetailClientProps {
  task: TaskWithAssignee
  users: User[]
  currentUserId: string
}

export function TaskDetailClient({ task, users, currentUserId }: TaskDetailClientProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [showEdit, setShowEdit] = useState(false)
  const [showDelete, setShowDelete] = useState(false)

  const isDue =
    task.dueDate && isPast(new Date(task.dueDate)) && task.status !== 'LUKKET'

  const handleStatusChange = (newStatus: TaskStatus) => {
    startTransition(async () => {
      const result = await updateTaskStatus({ taskId: task.id, status: newStatus })
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('Status opdateret')
        router.refresh()
      }
    })
  }

  const handleDelete = () => {
    startTransition(async () => {
      const result = await deleteTask({ taskId: task.id })
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('Opgaven er slettet')
        router.push('/tasks')
      }
    })
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Tilbage */}
      <Button variant="ghost" size="sm" asChild className="gap-2 -ml-2">
        <Link href="/tasks">
          <ArrowLeft className="h-4 w-4" />
          Tilbage til opgaver
        </Link>
      </Button>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <h1 className="text-2xl font-semibold text-gray-900">{task.title}</h1>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <Badge
              variant="secondary"
              className={cn('text-xs', STATUS_COLORS[task.status])}
            >
              {STATUS_LABELS[task.status]}
            </Badge>
            <Badge
              variant="secondary"
              className={cn('text-xs', PRIORITET_COLORS[task.priority])}
            >
              {PRIORITET_LABELS[task.priority]}
            </Badge>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowEdit(true)}
            className="gap-2"
          >
            <Pencil className="h-4 w-4" />
            Rediger
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowDelete(true)}
            className="gap-2 text-red-600 hover:bg-red-50 border-red-200"
          >
            <Trash2 className="h-4 w-4" />
            Slet
          </Button>
        </div>
      </div>

      {/* Detaljer */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Venstre */}
        <div className="space-y-4">
          {task.description && (
            <div>
              <h2 className="text-sm font-medium text-gray-500 mb-1">Beskrivelse</h2>
              <p className="text-sm text-gray-900 whitespace-pre-wrap">{task.description}</p>
            </div>
          )}

          {/* Skift status */}
          <div>
            <h2 className="text-sm font-medium text-gray-500 mb-1.5">Skift status</h2>
            <Select
              value={task.status}
              onValueChange={(v) => handleStatusChange(v as TaskStatus)}
              disabled={isPending}
            >
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(STATUS_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Højre — metadata */}
        <div className="space-y-3">
          <div className="rounded-lg border bg-gray-50 p-4 space-y-3">
            <h2 className="text-sm font-semibold text-gray-700">Detaljer</h2>

            <div className="flex items-center gap-2 text-sm">
              <User className="h-4 w-4 text-gray-400 flex-shrink-0" />
              <span className="text-gray-500">Ansvarlig:</span>
              {task.assignee ? (
                <span className="text-gray-900 font-medium">{task.assignee.name}</span>
              ) : (
                <span className="text-gray-400">Ikke tildelt</span>
              )}
            </div>

            <div className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4 text-gray-400 flex-shrink-0" />
              <span className="text-gray-500">Forfald:</span>
              {task.dueDate ? (
                <span className={cn('font-medium', isDue ? 'text-red-600' : 'text-gray-900')}>
                  {format(new Date(task.dueDate), 'd. MMMM yyyy', { locale: da })}
                  {isDue && ' (overskredet)'}
                </span>
              ) : (
                <span className="text-gray-400">Ingen forfaldsdato</span>
              )}
            </div>

            {task.case && (
              <div className="flex items-center gap-2 text-sm">
                <Link2 className="h-4 w-4 text-gray-400 flex-shrink-0" />
                <span className="text-gray-500">Sag:</span>
                <Link
                  href={`/cases/${task.case.id}`}
                  className="text-blue-600 hover:underline font-medium"
                >
                  {task.case.title}
                </Link>
              </div>
            )}

            <div className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4 text-gray-400 flex-shrink-0" />
              <span className="text-gray-500">Oprettet:</span>
              <span className="text-gray-900">
                {format(new Date(task.createdAt), 'd. MMMM yyyy', { locale: da })}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Edit dialog */}
      {showEdit && (
        <TaskFormDialog
          task={task}
          users={users}
          onSuccess={() => {
            setShowEdit(false)
            toast.success('Opgaven er opdateret')
            router.refresh()
          }}
          onCancel={() => setShowEdit(false)}
        />
      )}

      {/* Delete dialog */}
      <AlertDialog open={showDelete} onOpenChange={setShowDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Slet opgave</AlertDialogTitle>
            <AlertDialogDescription>
              Er du sikker på, at du vil slette opgaven &ldquo;{task.title}&rdquo;? Denne
              handling kan ikke fortrydes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuller</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isPending}
              className="bg-red-600 hover:bg-red-700"
            >
              {isPending ? 'Sletter...' : 'Slet opgave'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}