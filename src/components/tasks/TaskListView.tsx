'use client'

import { useState } from 'react'
import Link from 'next/link'
import { format, isPast, isToday } from 'date-fns'
import { da } from 'date-fns/locale'
import { TaskStatus } from '@prisma/client'
import { updateTask, deleteTask } from '@/actions/tasks'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
import {
  MoreHorizontal,
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Calendar,
  User,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { STATUS_LABELS, STATUS_COLORS, PRIORITET_LABELS, PRIORITET_COLORS } from '@/types/task'
import type { TaskWithAssignee } from '@/types/task'
import { TaskFormDialog } from './TaskFormDialog'

interface TaskListViewProps {
  tasks: TaskWithAssignee[]
  loading: boolean
  onStatusChange: (task: TaskWithAssignee, status: TaskStatus) => void
  onRefresh: () => void
  page: number
  totalPages: number
  onPageChange: (page: number) => void
}

export function TaskListView({
  tasks,
  loading,
  onStatusChange,
  onRefresh,
  page,
  totalPages,
  onPageChange,
}: TaskListViewProps) {
  const [editTask, setEditTask] = useState<TaskWithAssignee | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<TaskWithAssignee | null>(null)
  const [deleting, setDeleting] = useState(false)

  const handleDelete = async () => {
    if (!deleteConfirm) return
    setDeleting(true)
    try {
      const result = await deleteTask({ taskId: deleteConfirm.id })
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('Opgaven er slettet')
        setDeleteConfirm(null)
        onRefresh()
      }
    } finally {
      setDeleting(false)
    }
  }

  if (loading) {
    return <TasksListSkeleton />
  }

  if (tasks.length === 0) {
    return (
      <div className="text-center py-16 border border-dashed rounded-lg">
        <p className="text-gray-500 font-medium">Ingen opgaver fundet</p>
        <p className="text-sm text-gray-400 mt-1">
          Justér filtrene eller opret en ny opgave
        </p>
      </div>
    )
  }

  return (
    <>
      <div className="rounded-lg border bg-white overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead className="w-[40%]">Titel</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Prioritet</TableHead>
              <TableHead>Ansvarlig</TableHead>
              <TableHead>Forfaldsdato</TableHead>
              <TableHead>Sag</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {tasks.map((task) => {
              const isDue =
                task.dueDate && isPast(new Date(task.dueDate)) && task.status !== 'LUKKET'
              const isDueToday =
                task.dueDate && isToday(new Date(task.dueDate)) && task.status !== 'LUKKET'

              return (
                <TableRow key={task.id} className="hover:bg-gray-50">
                  <TableCell>
                    <Link
                      href={`/tasks/${task.id}`}
                      className="font-medium text-gray-900 hover:text-blue-600 hover:underline line-clamp-2"
                    >
                      {task.title}
                    </Link>
                    {task.description && (
                      <p className="text-xs text-gray-500 line-clamp-1 mt-0.5">
                        {task.description}
                      </p>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="secondary"
                      className={cn('text-xs', STATUS_COLORS[task.status])}
                    >
                      {STATUS_LABELS[task.status]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="secondary"
                      className={cn('text-xs', PRIORITET_COLORS[task.priority])}
                    >
                      {PRIORITET_LABELS[task.priority]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {task.assignee ? (
                      <div className="flex items-center gap-1.5">
                        <div className="h-6 w-6 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                          <span className="text-xs font-medium text-blue-700">
                            {task.assignee.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <span className="text-sm text-gray-700 truncate max-w-[120px]">
                          {task.assignee.name}
                        </span>
                      </div>
                    ) : (
                      <span className="text-sm text-gray-400 flex items-center gap-1">
                        <User className="h-3.5 w-3.5" />
                        Ikke tildelt
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    {task.dueDate ? (
                      <span
                        className={cn(
                          'flex items-center gap-1 text-sm',
                          isDue && 'text-red-600 font-medium',
                          isDueToday && 'text-orange-600 font-medium',
                          !isDue && !isDueToday && 'text-gray-600'
                        )}
                      >
                        <Calendar className="h-3.5 w-3.5" />
                        {format(new Date(task.dueDate), 'd. MMM yyyy', { locale: da })}
                        {isDue && ' (overskredet)'}
                        {isDueToday && ' (i dag)'}
                      </span>
                    ) : (
                      <span className="text-sm text-gray-400">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {task.case ? (
                      <Link
                        href={`/cases/${task.case.id}`}
                        className="text-sm text-blue-600 hover:underline truncate max-w-[120px] block"
                      >
                        {task.case.title}
                      </Link>
                    ) : (
                      <span className="text-sm text-gray-400">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                          <span className="sr-only">Handlinger</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => setEditTask(task)}
                          className="gap-2"
                        >
                          <Pencil className="h-4 w-4" />
                          Rediger
                        </DropdownMenuItem>
                        {/* Skift status */}
                        <DropdownMenuSeparator />
                        {(['NY', 'AKTIV', 'AFVENTER', 'LUKKET'] as TaskStatus[])
                          .filter((s) => s !== task.status)
                          .map((s) => (
                            <DropdownMenuItem
                              key={s}
                              onClick={() => onStatusChange(task, s)}
                            >
                              Sæt til {STATUS_LABELS[s]}
                            </DropdownMenuItem>
                          ))}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => setDeleteConfirm(task)}
                          className="text-red-600 gap-2"
                        >
                          <Trash2 className="h-4 w-4" />
                          Slet
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-sm text-gray-500">
            Side {page} af {totalPages}
          </p>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Edit dialog */}
      {editTask && (
        <TaskFormDialog
          task={editTask}
          users={[]}
          onSuccess={() => {
            setEditTask(null)
            toast.success('Opgaven er opdateret')
            onRefresh()
          }}
          onCancel={() => setEditTask(null)}
        />
      )}

      {/* Delete confirm */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Slet opgave</AlertDialogTitle>
            <AlertDialogDescription>
              Er du sikker på, at du vil slette opgaven &ldquo;{deleteConfirm?.title}&rdquo;? Denne
              handling kan ikke fortrydes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuller</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleting ? 'Sletter...' : 'Slet opgave'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

function TasksListSkeleton() {
  return (
    <div className="rounded-lg border bg-white overflow-hidden">
      <div className="animate-pulse">
        <div className="h-10 bg-gray-50 border-b" />
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-14 border-b bg-white flex items-center px-4 gap-4">
            <div className="h-4 bg-gray-200 rounded w-1/3" />
            <div className="h-5 bg-gray-200 rounded w-16" />
            <div className="h-5 bg-gray-200 rounded w-16" />
            <div className="h-4 bg-gray-200 rounded w-24" />
            <div className="h-4 bg-gray-200 rounded w-24" />
          </div>
        ))}
      </div>
    </div>
  )
}