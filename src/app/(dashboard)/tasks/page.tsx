import type { Metadata } from 'next'
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { getAccessibleCompanies, canAccessModule } from '@/lib/permissions'
import { getTaskStatusLabel, getPriorityLabel, daysUntil } from '@/lib/labels'
import { formatShortDate } from '@/lib/date-helpers'
import { TasksListB, type TaskRow } from './tasks-list-b'

export const metadata: Metadata = { title: 'Opgaver' }

// Task har ingen "type"-felt — vi udleder kategori fra hvilke entiteter den er
// tilknyttet: contract_id → "Kontrakt", case_id → "Sag", company_id → "Selskab",
// ellers "Admin".
function inferTaskType(t: {
  contract_id: string | null
  case_id: string | null
  company_id: string | null
}): string {
  if (t.contract_id) return 'Kontrakt'
  if (t.case_id) return 'Sag'
  if (t.company_id) return 'Selskab'
  return 'Admin'
}

export default async function TasksPage() {
  const session = await auth()
  if (!session) redirect('/login')

  const orgId = session.user.organizationId
  const userId = session.user.id

  const hasAccess = await canAccessModule(userId, 'tasks', orgId)
  if (!hasAccess) redirect('/dashboard')

  const canExport = await canAccessModule(userId, 'export', orgId)

  const companyIds = await getAccessibleCompanies(userId, orgId)

  // Opgaver er org-scoped (company_id er nullable). Vi viser alle opgaver i org
  // hvor brugeren har adgang ELLER opgave ikke er bundet til et selskab.
  const [rawTasks, totalCount] = await Promise.all([
    prisma.task.findMany({
      where: {
        organization_id: orgId,
        deleted_at: null,
        OR: [{ company_id: null }, { company_id: { in: companyIds } }],
      },
      orderBy: { due_date: 'asc' },
      include: {
        assignee: { select: { id: true, name: true } },
        case: { select: { id: true, title: true } },
      },
    }),
    prisma.task.count({
      where: {
        organization_id: orgId,
        deleted_at: null,
        OR: [{ company_id: null }, { company_id: { in: companyIds } }],
      },
    }),
  ])

  // Resolv company-navne (Task.company_id har ingen direkte relation)
  const companyIdsSet = Array.from(
    new Set(rawTasks.map((t) => t.company_id).filter((id): id is string => !!id))
  )
  const companies = companyIdsSet.length
    ? await prisma.company.findMany({
        where: { id: { in: companyIdsSet }, organization_id: orgId, deleted_at: null },
        select: { id: true, name: true },
      })
    : []
  const companyMap = new Map(companies.map((c) => [c.id, c.name]))

  const rows: TaskRow[] = rawTasks.map((t) => {
    const dDue = t.due_date ? daysUntil(t.due_date) : null
    const isClosed = t.status === 'LUKKET'
    // Lukkede opgaver viser bare dato (eller "—"), aldrig "for sent" — overskreden
    // frist på en lukket opgave er støj, ikke handlingsanvisende info.
    const fristDays = isClosed ? 9999 : (dDue ?? 9999)
    let frist = '—'
    if (t.due_date && dDue != null) {
      if (isClosed) frist = formatShortDate(t.due_date)
      else if (dDue < 0) frist = `${Math.abs(dDue)}d for sent`
      else frist = formatShortDate(t.due_date)
    }

    return {
      id: t.id,
      titel: t.title,
      selskab: t.company_id ? (companyMap.get(t.company_id) ?? '—') : '—',
      type: inferTaskType(t),
      prio: getPriorityLabel(t.priority),
      rawPrio: t.priority,
      status: getTaskStatusLabel(t.status),
      rawStatus: t.status,
      frist,
      fristDays,
      ansvarlig: t.assignee?.name ?? 'Ikke tildelt',
      isMine: t.assigned_to === userId,
    }
  })

  return <TasksListB tasks={rows} totalCount={totalCount} canExport={canExport} />
}
