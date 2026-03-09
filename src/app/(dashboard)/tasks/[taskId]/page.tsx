import { notFound } from 'next/navigation'
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { canAccessModule } from '@/lib/permissions'
import { getTask } from '@/actions/tasks'
import { TaskDetailClient } from '@/components/tasks/TaskDetailClient'
import { prisma } from '@/lib/db'

interface TaskPageProps {
  params: { taskId: string }
}

export default async function TaskPage({ params }: TaskPageProps) {
  const session = await auth()
  if (!session?.user) redirect('/login')

  const hasAccess = await canAccessModule(session.user.id, 'tasks')
  if (!hasAccess) redirect('/tasks')

  const result = await getTask({ taskId: params.taskId })
  if (result.error) notFound()

  const task = result.data!

  const users = await prisma.user.findMany({
    where: {
      organizationId: session.user.organizationId,
      deletedAt: null,
    },
    select: { id: true, name: true, email: true, avatarUrl: true },
    orderBy: { name: 'asc' },
  })

  return (
    <TaskDetailClient
      task={task}
      users={users}
      currentUserId={session.user.id}
    />
  )
}