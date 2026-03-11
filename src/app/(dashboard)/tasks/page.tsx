import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { CheckSquare, Plus } from 'lucide-react'
import Link from 'next/link'
import { TaskStatusButton } from '@/components/tasks/TaskStatusButton'

const PRIORITY_LABELS: Record<string, string> = {
  LAV: 'Lav',
  MELLEM: 'Mellem',
  HOEJ: 'Høj',
  KRITISK: 'Kritisk',
}

const PRIORITY_STYLES: Record<string, string> = {
  LAV: 'bg-gray-100 text-gray-600',
  MELLEM: 'bg-blue-50 text-blue-700',
  HOEJ: 'bg-orange-50 text-orange-700',
  KRITISK: 'bg-red-100 text-red-700',
}

const STATUS_LABELS: Record<string, string> = {
  NY: 'Ny',
  AKTIV: 'Aktiv',
  AFVENTER: 'Afventer',
  LUKKET: 'Lukket',
}

export default async function TasksPage() {
  const session = await auth()
  if (!session) redirect('/login')

  const today = new Date()

  const tasks = await prisma.task.findMany({
    where: {
      organization_id: session.user.organizationId,
      deleted_at: null,
      status: { not: 'LUKKET' },
    },
    include: {
      assignee: { select: { id: true, name: true } },
      case: { select: { id: true, title: true } },
    },
    orderBy: [{ due_date: 'asc' }, { priority: 'desc' }],
  })

  const overdueTasks = tasks.filter((t) => t.due_date && new Date(t.due_date) < today)
  const upcomingTasks = tasks.filter((t) => !t.due_date || new Date(t.due_date) >= today)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Opgaver</h1>
          <p className="mt-1 text-sm text-gray-500">
            {tasks.length} åbne opgave{tasks.length !== 1 ? 'r' : ''}
            {overdueTasks.length > 0 && (
              <span className="ml-2 text-red-600 font-medium">
                · {overdueTasks.length} forfaldne
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

      {tasks.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-gray-300 p-12 text-center">
          <CheckSquare className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-semibold text-gray-900">Ingen åbne opgaver</h3>
          <p className="mt-1 text-sm text-gray-500">Opret en opgave for at komme i gang.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Forfaldne */}
          {overdueTasks.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-red-700 mb-3">
                ⚠️ Forfaldne ({overdueTasks.length})
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
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${PRIORITY_STYLES[task.priority] ?? 'bg-gray-100 text-gray-600'}`}>
                      {PRIORITY_LABELS[task.priority] ?? task.priority}
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
                  {STATUS_LABELS[task.status] ?? task.status}
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
