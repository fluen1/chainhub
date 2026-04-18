import type { Metadata } from 'next'
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { getAccessibleCompanies } from '@/lib/permissions'
import { CheckSquare, List, LayoutGrid, KanbanSquare } from 'lucide-react'
import Link from 'next/link'
import { PageHeader } from '@/components/ui/page-header'
import { TaskStatusButton } from '@/components/tasks/TaskStatusButton'
import { TasksKanbanBoard } from '@/components/tasks/tasks-kanban-board'
import { CollapsibleSection } from '@/components/ui/CollapsibleSection'
import { Suspense } from 'react'
import { SearchAndFilter } from '@/components/ui/SearchAndFilter'
import { Pagination } from '@/components/ui/Pagination'
import { parsePaginationParams } from '@/lib/pagination'
import { cn } from '@/lib/utils'
import {
  TASK_STATUS_LABELS,
  PRIORITY_LABELS,
  getPriorityLabel,
  getPriorityStyle,
  getTaskStatusLabel,
} from '@/lib/labels'
import { groupTasksByCompany, NO_COMPANY_KEY } from '@/lib/task-detail/helpers'
import type { TaskStatus, Prisma } from '@prisma/client'

export const metadata: Metadata = { title: 'Opgaver' }

const PAGE_SIZE = 20

const STATUS_OPTIONS = Object.entries(TASK_STATUS_LABELS)
  .filter(([key]) => key !== 'AKTIV')
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
    view?: string // 'flat' (default) | 'grouped' | 'kanban'
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
  const viewFilter: 'flat' | 'grouped' | 'kanban' =
    searchParams.view === 'grouped' ? 'grouped' : searchParams.view === 'kanban' ? 'kanban' : 'flat'

  const today = new Date()

  const companyIds = await getAccessibleCompanies(session.user.id, session.user.organizationId)

  const companyOptions =
    companyIds.length > 0
      ? (
          await prisma.company.findMany({
            where: {
              id: { in: companyIds },
              organization_id: session.user.organizationId,
              deleted_at: null,
            },
            select: { id: true, name: true },
            orderBy: { name: 'asc' },
          })
        ).map((c) => ({ value: c.id, label: c.name }))
      : []

  const companyNameLookup = new Map(companyOptions.map((c) => [c.value, c.label]))

  // Kanban-view viser alle 4 statusser (inkl. LUKKET) så brugeren kan trække derind.
  // Andre views filtrerer LUKKET fra som default (uændret adfærd).
  const where: Prisma.TaskWhereInput = {
    organization_id: session.user.organizationId,
    deleted_at: null,
    ...(statusFilter
      ? { status: statusFilter as TaskStatus }
      : viewFilter === 'kanban'
        ? {}
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

  const overdueTasks = tasks.filter((t) => t.due_date && new Date(t.due_date) < today)
  const upcomingTasks = tasks.filter((t) => !t.due_date || new Date(t.due_date) >= today)

  const groupedByCompany = viewFilter === 'grouped' ? groupTasksByCompany(tasks) : null

  function buildToggleHref(nextView: 'flat' | 'grouped' | 'kanban'): string {
    const params = new URLSearchParams()
    if (q) params.set('q', q)
    if (statusFilter) params.set('status', statusFilter)
    if (priorityFilter) params.set('priority', priorityFilter)
    if (companyFilter) params.set('company', companyFilter)
    params.set('view', nextView)
    return `/tasks?${params.toString()}`
  }

  const kanbanTasks =
    viewFilter === 'kanban'
      ? tasks.map((t) => ({
          id: t.id,
          title: t.title,
          status: t.status,
          priority: t.priority,
          due_date: t.due_date ? t.due_date.toISOString() : null,
          assigneeName: t.assignee?.name ?? null,
          caseTitle: t.case?.title ?? null,
          caseId: t.case?.id ?? null,
        }))
      : null

  return (
    <div className="space-y-6">
      <PageHeader
        title="Opgaver"
        subtitle={`${totalCount} opgave${totalCount !== 1 ? 'r' : ''}${overdueCount > 0 ? ` · ${overdueCount} forfaldne` : ''}`}
        actionLabel="Ny opgave"
        actionHref="/tasks/new"
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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

        <div className="flex items-center rounded-md border border-gray-200 bg-white shrink-0">
          <Link
            href={buildToggleHref('flat')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-l-md no-underline',
              viewFilter === 'flat' ? 'bg-blue-50 text-blue-700' : 'text-gray-500 hover:bg-gray-50'
            )}
          >
            <List className="h-3.5 w-3.5" aria-hidden />
            Tidslinje
          </Link>
          <Link
            href={buildToggleHref('grouped')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border-l border-gray-200 no-underline',
              viewFilter === 'grouped'
                ? 'bg-blue-50 text-blue-700'
                : 'text-gray-500 hover:bg-gray-50'
            )}
          >
            <LayoutGrid className="h-3.5 w-3.5" aria-hidden />
            Pr. selskab
          </Link>
          <Link
            href={buildToggleHref('kanban')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-r-md border-l border-gray-200 no-underline',
              viewFilter === 'kanban'
                ? 'bg-blue-50 text-blue-700'
                : 'text-gray-500 hover:bg-gray-50'
            )}
          >
            <KanbanSquare className="h-3.5 w-3.5" aria-hidden />
            Kanban
          </Link>
        </div>
      </div>

      {tasks.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-gray-300 p-12 text-center">
          <CheckSquare className="mx-auto h-12 w-12 text-gray-400" />
          {hasFilters ? (
            <>
              <h3 className="mt-2 text-sm font-semibold text-gray-900">
                Ingen opgaver matcher søgningen
              </h3>
              <p className="mt-1 text-sm text-gray-500">Prøv at ændre filtrene.</p>
            </>
          ) : (
            <>
              <h3 className="mt-2 text-sm font-semibold text-gray-900">Ingen åbne opgaver</h3>
              <p className="mt-1 text-sm text-gray-500">Opret en opgave for at komme i gang.</p>
            </>
          )}
        </div>
      ) : viewFilter === 'kanban' && kanbanTasks ? (
        <TasksKanbanBoard tasks={kanbanTasks} />
      ) : viewFilter === 'grouped' && groupedByCompany ? (
        <div className="space-y-3">
          {Array.from(groupedByCompany.entries()).map(([companyId, tasksForCompany]) => {
            const name =
              companyId === NO_COMPANY_KEY
                ? 'Uden selskab'
                : (companyNameLookup.get(companyId) ?? 'Ukendt selskab')
            return (
              <CollapsibleSection key={companyId} title={name} count={tasksForCompany.length}>
                <TaskList tasks={tasksForCompany} today={today} />
              </CollapsibleSection>
            )
          })}
          <Suspense fallback={null}>
            <Pagination currentPage={page} totalCount={totalCount} pageSize={PAGE_SIZE} />
          </Suspense>
        </div>
      ) : (
        <div className="space-y-6">
          {overdueTasks.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-2 h-2 rounded-full bg-red-500" />
                <h2 className="text-sm font-semibold text-red-700">
                  Forfaldne ({overdueTasks.length})
                </h2>
              </div>
              <TaskList tasks={overdueTasks} today={today} isOverdueSection />
            </div>
          )}

          {overdueTasks.length > 0 && upcomingTasks.length > 0 && (
            <div className="border-t border-gray-200" />
          )}

          {upcomingTasks.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-2 h-2 rounded-full bg-green-500" />
                <h2 className="text-sm font-semibold text-gray-700">
                  Kommende ({upcomingTasks.length})
                </h2>
              </div>
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
                isOverdueSection ? 'bg-red-50/60 border-l-2 border-red-400' : 'hover:bg-gray-50'
              }`}
            >
              <div className="flex-1 min-w-0">
                <Link
                  href={`/tasks/${task.id}`}
                  className={`text-sm font-medium no-underline hover:underline ${isOverdueSection ? 'text-red-800' : 'text-gray-900 hover:text-blue-600'}`}
                >
                  {task.title}
                </Link>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  {task.due_date && (
                    <span
                      className={`text-xs ${isOverdue ? 'text-red-600 font-medium' : 'text-gray-500'}`}
                    >
                      {new Date(task.due_date).toLocaleDateString('da-DK')}
                    </span>
                  )}
                  {task.priority && (
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${getPriorityStyle(task.priority)}`}
                    >
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
