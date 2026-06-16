import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getTasksPaginated } from '@/actions/tasks'
import { auth } from '@/lib/auth'
import { canAccessModule } from '@/lib/permissions'
import { TasksListB } from './tasks-list-b'

export const metadata: Metadata = { title: 'Opgaver' }

interface TasksPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function TasksPage({ searchParams }: TasksPageProps) {
  const session = await auth()
  if (!session) redirect('/login')

  const orgId = session.user.organizationId
  const userId = session.user.id

  const hasAccess = await canAccessModule(userId, 'tasks', orgId)
  if (!hasAccess) redirect('/dashboard')

  const canExport = await canAccessModule(userId, 'export', orgId)

  const sp = await searchParams
  function sp1(key: string): string | undefined {
    const v = sp[key]
    return Array.isArray(v) ? v[0] : v
  }

  const page = parseInt(sp1('page') ?? '1', 10) || 1
  const pageSize = parseInt(sp1('pageSize') ?? '20', 10) || 20
  const search = sp1('search')
  const status = sp1('status')
  const priority = sp1('prio')
  const sort = sp1('sort')
  const sortDir = (sp1('sortDir') as 'asc' | 'desc' | undefined) ?? 'asc'
  const assignedToMe = sp1('mine') === '1'

  const {
    rows,
    totalCount,
    page: currentPage,
    pageSize: currentPageSize,
  } = await getTasksPaginated({
    page,
    pageSize,
    search,
    status,
    priority,
    sort,
    sortDir,
    assignedToMe,
  })

  return (
    <TasksListB
      tasks={rows}
      totalCount={totalCount}
      page={currentPage}
      pageSize={currentPageSize}
      canExport={canExport}
    />
  )
}
