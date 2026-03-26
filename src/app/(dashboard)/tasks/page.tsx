import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { getAccessibleCompanies } from '@/lib/permissions'
import { CheckSquare, Plus } from 'lucide-react'
import Link from 'next/link'
import { TaskStatusButton } from '@/components/tasks/TaskStatusButton'
import { Suspense } from 'react'
import { SearchAndFilter } from '@/components/ui/SearchAndFilter'
import { Pagination } from '@/components/ui/Pagination'
import { parsePaginationParams } from '@/lib/pagination'
import {
  TASK_STATUS_LABELS,
  PRIORITY_LABELS,
  getPriorityLabel,
  getPriorityStyle,
  getTaskStatusLabel,
} from '@/lib/labels'
import type { TaskStatus, Prisma } from '@prisma/client'

const PAGE_SIZE = 20

const STATUS_OPTIONS = Object.entries(TASK_STATUS_LABELS)
  .filter(([key]) => key !== 'AKTIV') // AKTIV is alias for AKTIV_TASK, skip duplicate
  .map(([value, label]) => ({ value, label }))

const PRIORITY_OPTIONS = [
  { value: 'KRITISK', label: PRIORITY_LABELS['KRITISK'] },
  { value: 'HOEJ', label: PRIORITY_LABELS['HOEJ'] },
  { value: 'MELLEM', label: PRIORITY_LABELS['MELLEM'] },
  { value: 'LAV', label: PRIORITY_LABELS['LAV'] },
]

interface TasksPageProps {
  searchParams: {
    q?: string
    status?: string
    priority?: string
    company?: string
    page?: string
  }
}

export default async function TasksPage({ searchParams }: TasksPageProps) {
  const session = await auth()
  if (!session) redirect('/login')

  const { page, skip, take } = parsePaginationParams(searchParams.page, PAGE_SIZE)
  const q = searchParams.q?.trim() ?? ''
  const statusFilter = searchParams.status
  const priorityFilter = searchParams.priority
  const companyFilter = searchParams.company

  const today = new Date()

  // Hent accessible companies til filter-dropdown
  const companyIds = await getAccessibleCompanies(
    session.user.id,
    session.user.organizationId
  )

  const companyOptions = companyIds.length > 0
    ? (await prisma.company.findMany({
        where: {
          id: { in: companyIds },
          organization_id: session.user.organizationId,
          deleted_at: null,
        },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      })).map((c) => ({ value: c.id, label: c.name }))
    : []

  // Byg where-clause — vis åbne opgaver som default, medmindre brugeren filtrerer på LUKKET
  const where: Prisma.TaskWhereInput = {
    organization_id: session.user.organizationId,
    deleted_at: null,
    ...(statusFilter
      ? { status: statusFilter as TaskStatus }
      : { status: { not: 'LUKKET' as TaskStatus } }),
    ...(priorityFilter ? { priority: priorityFilter as never } : {}),
    ...(q ? { title: { contains: q, mode: 'insensitive' as const } } : {}),
    ...(companyFilter ? { company_id: companyFilter } : {}),
  }

  const tasksQuery = prisma.task.findMany({
    where,
    include: {
      assignee: { select: { id: true, name: true } },
      case: { select: { id: true, title: true } },
    },
    orderBy: [{ due_date: 'asc' }, { priority: 'desc' }],
    skip,
    take,
  })
  const countQuery = prisma.task.count({ where })

  const [tasks, totalCount] = await Promise.all([tasksQuery, countQuery])

  const overdueTasks = tasks.filter((t) => t.due_date && new Date(t.due_date) < today)
  const upcomingTasks = tasks.filter((t) => !t.due_date || new Date(t.due_date) >= today)
  const hasFilters = !!(q || statusFilter || priorityFilter || companyFilter)

  const overdueCount = await prisma.task.count({
    where: {
      organization_id: session.user.organizationId,
      deleted_at: null,
      status: { not: 'LUKKET' },
      due_date: { lt: today },
      ...(companyFilter ? { company_id: companyFilter } : {}),
    },
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Opgaver</h1>
          <p className="mt-1 text-sm text-gray-500">
            {totalCount} opgave{totalCount !== 1 ? 'r' : ''}
            {overdueCount > 0 && (
              <span className="ml-2 text-red-600 font-medium">
                · {overdueCount} forfaldne
              </span>
            )}
          </p>
        </div>
        <Link
          href="/tasks/new"
          className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          Ny opgave
        </Link>
      </div>

      <Suspense fallback={null}>
        <SearchAndFilter
          placeholder="Søg på opgavenavn..."
          filters={[
            { key: 'company', label: 'Selskab', options: companyOptions },
            { key: 'status', label: 'Status', options: STATUS_OPTIONS },
            { key: 'priority', label: 'Prioritet', options: PRIORITY_OPTIONS },
          ]}
        />
      </Suspense>

      {tasks.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-gray-300 p-12 text-center">
          <CheckSquare className="mx-auto h-12 w-12 text-gray-400" />
          {hasFilters ? (
            <>
              <h3 className="mt-2 text-sm font-semibold text-gray-900">Ingen opgaver matcher søgningen</h3>
              <p className="mt-1 text-sm text-gray-500">Prøv at ændre filtrene.</p>
            </>
          ) : (
            <>
              <h3 className="mt-2 text-sm font-semibold text-gray-900">Ingen åbne opgaver</h3>
              <p className="mt-1 text-sm text-gray-500">Opret en opgave for at komme i gang.</p>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Forfaldne */}
          {overdueTasks.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-red-700 mb-3">
                Forfaldne ({overdueTasks.length})
              </h2>
              <TaskList tasks={overdueTasks} today={today} isOverdueSection />
            </div>
          )}

          {/* Kommende */}
          {upcomingTasks.length > 0 && (
            <div>
              {overdueTasks.length > 0 && (
                <h2 className="text-sm font-semibold text-gray-700 mb-3">
                  Kommende ({upcomingTasks.length})
                </h2>
              )}
              <TaskList tasks={upcomingTasks} today={today} />
            </div>
          )}

          <Suspense fallback={null}>
            <Pagination currentPage={page} totalCount={totalCount} pageSize={PAGE_SIZE} />
          </Suspense>
        </div>
      )}
    </div>
  )
}

type TaskItem = {
  id: string
  title: string
  description: string | null
  status: string
  due_date: Date | null
  priority: string | null
  assignee: { id: string; name: string } | null
  case: { id: string; title: string } | null
}

function TaskList({
  tasks,
  today,
  isOverdueSection = false,
}: {
  tasks: TaskItem[]
  today: Date
  isOverdueSection?: boolean
}) {
  return (
    <div className="overflow-hidden rounded-lg border bg-white shadow-sm">
      <ul className="divide-y divide-gray-200">
        {tasks.map((task) => {
          const isOverdue = task.due_date && new Date(task.due_date) < today
          return (
            <li
              key={task.id}
              className={`px-6 py-4 flex items-center justify-between gap-4 ${
                isOverdueSection ? 'bg-red-50' : 'hover:bg-gray-50'
              }`}
            >
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${isOverdueSection ? 'text-red-800' : 'text-gray-900'}`}>
                  {task.title}
                </p>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  {task.due_date && (
                    <span className={`text-xs ${isOverdue ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
                      {new Date(task.due_date).toLocaleDateString('da-DK')}
                    </span>
                  )}
                  {task.priority && (
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${getPriorityStyle(task.priority)}`}>
                      {getPriorityLabel(task.priority)}
                    </span>
                  )}
                  {task.assignee && (
                    <span className="text-xs text-gray-400">{task.assignee.name}</span>
                  )}
                  {task.case && (
                    <Link
                      href={`/cases/${task.case.id}`}
                      className="text-xs text-blue-500 hover:text-blue-700"
                    >
                      → {task.case.title}
                    </Link>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-xs text-gray-400 hidden sm:block">
                  {getTaskStatusLabel(task.status)}
                </span>
                <TaskStatusButton taskId={task.id} currentStatus={task.status} />
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
