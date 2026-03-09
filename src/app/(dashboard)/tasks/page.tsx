import { Suspense } from 'react'
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { canAccessModule } from '@/lib/permissions'
import { listTasks } from '@/actions/tasks'
import { prisma } from '@/lib/db'
import { TasksClient } from '@/components/tasks/TasksClient'
import { TasksListSkeleton } from '@/components/tasks/TasksListSkeleton'

export const metadata = {
  title: 'Opgaver — ChainHub',
}

interface TasksPageProps {
  searchParams: {
    view?: string
    status?: string
    priority?: string
    assignedTo?: string
    search?: string
    page?: string
  }
}

export default async function TasksPage({ searchParams }: TasksPageProps) {
  const session = await auth()
  if (!session?.user) redirect('/login')

  const hasAccess = await canAccessModule(session.user.id, 'tasks')
  if (!hasAccess) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">Du har ikke adgang til opgavemodulet</p>
      </div>
    )
  }

  // Hent brugere til filter-dropdown
  const users = await prisma.user.findMany({
    where: {
      organizationId: session.user.organizationId,
      deletedAt: null,
    },
    select: { id: true, name: true, email: true, avatarUrl: true },
    orderBy: { name: 'asc' },
  })

  const view = searchParams.view === 'kanban' ? 'kanban' : 'liste'
  const page = Math.max(1, parseInt(searchParams.page ?? '1', 10))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Opgaver</h1>
          <p className="text-sm text-gray-500 mt-1">
            Administrér og følg op på opgaver på tværs af sager og selskaber
          </p>
        </div>
      </div>

      <Suspense fallback={<TasksListSkeleton />}>
        <TasksClient
          initialView={view}
          users={users}
          currentUserId={session.user.id}
          searchParams={searchParams}
        />
      </Suspense>
    </div>
  )
}