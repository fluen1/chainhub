'use client'

import { useState, useTransition, useCallback } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { TaskStatus, Prioritet } from '@prisma/client'
import { listTasks, createTask, updateTaskStatus } from '@/actions/tasks'
import { TaskListView } from './TaskListView'
import { TaskKanbanView } from './TaskKanbanView'
import { TaskFormDialog } from './TaskFormDialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Plus, List, LayoutGrid, Search, X } from 'lucide-react'
import { toast } from 'sonner'
import { STATUS_LABELS, PRIORITET_LABELS } from '@/types/task'
import type { TaskWithAssignee } from '@/types/task'
import { useEffect } from 'react'

interface User {
  id: string
  name: string
  email: string
  avatarUrl: string | null
}

interface TasksClientProps {
  initialView: 'liste' | 'kanban'
  users: User[]
  currentUserId: string
  searchParams: {
    view?: string
    status?: string
    priority?: string
    assignedTo?: string
    search?: string
    page?: string
  }
}

export function TasksClient({
  initialView,
  users,
  currentUserId,
  searchParams,
}: TasksClientProps) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()

  const [view, setView] = useState<'liste' | 'kanban'>(initialView)
  const [tasks, setTasks] = useState<TaskWithAssignee[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [isPending, startTransition] = useTransition()
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [page, setPage] = useState(
    Math.max(1, parseInt(searchParams.page ?? '1', 10))
  )

  // Filter state
  const [statusFilter, setStatusFilter] = useState<TaskStatus | 'alle'>(
    (searchParams.status as TaskStatus) ?? 'alle'
  )
  const [priorityFilter, setPriorityFilter] = useState<Prioritet | 'alle'>(
    (searchParams.priority as Prioritet) ?? 'alle'
  )
  const [assignedToFilter, setAssignedToFilter] = useState<string | 'alle'>(
    searchParams.assignedTo ?? 'alle'
  )
  const [searchQuery, setSearchQuery] = useState(searchParams.search ?? '')
  const [searchInput, setSearchInput] = useState(searchParams.search ?? '')

  const pageSize = 25

  const fetchTasks = useCallback(async () => {
    setLoading(true)
    try {
      const result = await listTasks({
        status: statusFilter !== 'alle' ? statusFilter : undefined,
        priority: priorityFilter !== 'alle' ? priorityFilter : undefined,
        assignedTo: assignedToFilter !== 'alle' ? assignedToFilter : undefined,
        search: searchQuery || undefined,
        page,
        pageSize,
        sortBy: 'createdAt',
        sortDir: 'desc',
      })

      if (result.error) {
        toast.error(result.error)
      } else {
        setTasks(result.data.tasks)
        setTotal(result.data.total)
      }
    } finally {
      setLoading(false)
    }
  }, [statusFilter, priorityFilter, assignedToFilter, searchQuery, page])

  useEffect(() => {
    fetchTasks()
  }, [fetchTasks])

  const handleViewChange = (newView: 'liste' | 'kanban') => {
    setView(newView)
    const newParams = new URLSearchParams(params.toString())
    newParams.set('view', newView)
    router.push(`${pathname}?${newParams.toString()}`)
  }

  const handleSearch = () => {
    setSearchQuery(searchInput)
    setPage(1)
  }

  const handleClearSearch = () => {
    setSearchInput('')
    setSearchQuery('')
    setPage(1)
  }

  const handleStatusChange = (newStatus: TaskWithAssignee, status: TaskStatus) => {
    startTransition(async () => {
      const result = await updateTaskStatus({ taskId: newStatus.id, status })
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('Status opdateret')
        fetchTasks()
      }
    })
  }

  const handleTaskCreated = () => {
    setShowCreateDialog(false)
    toast.success('Opgaven er oprettet')
    fetchTasks()
  }

  const totalPages = Math.ceil(total / pageSize)

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Filtre */}
        <div className="flex flex-wrap gap-2">
          {/* Status filter */}
          <Select
            value={statusFilter}
            onValueChange={(v) => {
              setStatusFilter(v as TaskStatus | 'alle')
              setPage(1)
            }}
          >
            <SelectTrigger className="w-36 h-9">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="alle">Alle statuser</SelectItem>
              {Object.entries(STATUS_LABELS).map(([key, label]) => (
                <SelectItem key={key} value={key}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Prioritet filter */}
          <Select
            value={priorityFilter}
            onValueChange={(v) => {
              setPriorityFilter(v as Prioritet | 'alle')
              setPage(1)
            }}
          >
            <SelectTrigger className="w-36 h-9">
              <SelectValue placeholder="Prioritet" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="alle">Alle prioriteter</SelectItem>
              {Object.entries(PRIORITET_LABELS).map(([key, label]) => (
                <SelectItem key={key} value={key}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Ansvarlig filter */}
          <Select
            value={assignedToFilter}
            onValueChange={(v) => {
              setAssignedToFilter(v)
              setPage(1)
            }}
          >
            <SelectTrigger className="w-44 h-9">
              <SelectValue placeholder="Ansvarlig" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="alle">Alle</SelectItem>
              <SelectItem value={currentUserId}>Mine opgaver</SelectItem>
              {users.map((user) => (
                <SelectItem key={user.id} value={user.id}>
                  {user.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Søgning */}
          <div className="flex items-center gap-1">
            <div className="relative">
              <Search className="absolute left-2.5 top-2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Søg opgaver..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="pl-8 h-9 w-48"
              />
              {searchInput && (
                <button
                  onClick={handleClearSearch}
                  className="absolute right-2 top-2 text-gray-400 hover:text-gray-600"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <Button variant="outline" size="sm" onClick={handleSearch} className="h-9">
              Søg
            </Button>
          </div>
        </div>

        {/* Visning + Opret */}
        <div className="flex items-center gap-2">
          <Tabs value={view} onValueChange={(v) => handleViewChange(v as 'liste' | 'kanban')}>
            <TabsList className="h-9">
              <TabsTrigger value="liste" className="gap-1.5 px-3">
                <List className="h-4 w-4" />
                <span className="hidden sm:inline">Liste</span>
              </TabsTrigger>
              <TabsTrigger value="kanban" className="gap-1.5 px-3">
                <LayoutGrid className="h-4 w-4" />
                <span className="hidden sm:inline">Kanban</span>
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <Button
            onClick={() => setShowCreateDialog(true)}
            size="sm"
            className="h-9 gap-1.5"
          >
            <Plus className="h-4 w-4" />
            Ny opgave
          </Button>
        </div>
      </div>

      {/* Antal resultater */}
      {!loading && (
        <p className="text-sm text-gray-500">
          {total === 0
            ? 'Ingen opgaver fundet'
            : `${total} opgave${total !== 1 ? 'r' : ''} fundet`}
        </p>
      )}

      {/* Visning */}
      {view === 'liste' ? (
        <TaskListView
          tasks={tasks}
          loading={loading}
          onStatusChange={handleStatusChange}
          onRefresh={fetchTasks}
          page={page}
          totalPages={totalPages}
          onPageChange={setPage}
        />
      ) : (
        <TaskKanbanView
          tasks={tasks}
          loading={loading}
          onStatusChange={handleStatusChange}
          onRefresh={fetchTasks}
        />
      )}

      {/* Opret dialog */}
      {showCreateDialog && (
        <TaskFormDialog
          users={users}
          onSuccess={handleTaskCreated}
          onCancel={() => setShowCreateDialog(false)}
        />
      )}
    </div>
  )
}