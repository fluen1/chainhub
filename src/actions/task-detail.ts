'use server'

import { prisma } from '@/lib/db'
import { canAccessCompany } from '@/lib/permissions'
import {
  deriveTaskUrgency,
  formatHistoryEntry,
  type TaskUrgency,
  type FormattedHistoryEntry,
} from '@/lib/task-detail/helpers'

// -----------------------------------------------------------------
// Output-typer
// -----------------------------------------------------------------

export interface TaskDetailData {
  task: {
    id: string
    title: string
    description: string | null
    status: string
    priority: string
    due_date: Date | null
    created_at: Date
    created_by: string
  }
  urgency: TaskUrgency
  assignee: { id: string; name: string; email: string } | null
  relatedCompany: { id: string; name: string } | null
  relatedCase: { id: string; title: string; case_type: string; status: string } | null
  relatedContract: { id: string; display_name: string; status: string } | null
  history: FormattedHistoryEntry[]
  comments: Array<{
    id: string
    content: string
    created_at: Date
    created_by: string
    author: { name: string }
  }>
  availableAssignees: Array<{ id: string; name: string }>
}

// -----------------------------------------------------------------
// Server action — henter alt detalje-data i én parallel batch
// -----------------------------------------------------------------

export async function getTaskDetailData(
  taskId: string,
  userId: string,
  orgId: string
): Promise<TaskDetailData | null> {
  const task = await prisma.task.findFirst({
    where: {
      id: taskId,
      organization_id: orgId,
      deleted_at: null,
    },
    include: {
      assignee: { select: { id: true, name: true, email: true } },
      case: { select: { id: true, title: true, case_type: true, status: true } },
    },
  })

  if (!task) return null

  // Permissions — hvis opgave har company_id, tjek adgang
  if (task.company_id) {
    const hasAccess = await canAccessCompany(userId, task.company_id)
    if (!hasAccess) return null
  }

  // Parallel batch — company, contract, comments, history, assignees
  const [company, contract, comments, historyRaw, users] = await Promise.all([
    task.company_id
      ? prisma.company.findFirst({
          where: { id: task.company_id, organization_id: orgId, deleted_at: null },
          select: { id: true, name: true },
        })
      : Promise.resolve(null),
    task.contract_id
      ? prisma.contract.findFirst({
          where: { id: task.contract_id, organization_id: orgId, deleted_at: null },
          select: { id: true, display_name: true, status: true },
        })
      : Promise.resolve(null),
    prisma.comment.findMany({
      where: { organization_id: orgId, task_id: taskId },
      include: { author: { select: { name: true } } },
      orderBy: { created_at: 'desc' },
      take: 50,
    }),
    prisma.taskHistory.findMany({
      where: { organization_id: orgId, task_id: taskId, deleted_at: null },
      include: { changedBy: { select: { name: true } } },
      orderBy: { changed_at: 'desc' },
      take: 50,
    }),
    prisma.user.findMany({
      where: { organization_id: orgId, active: true, deleted_at: null },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ])

  return {
    task: {
      id: task.id,
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      due_date: task.due_date,
      created_at: task.created_at,
      created_by: task.created_by,
    },
    urgency: deriveTaskUrgency(task),
    assignee: task.assignee,
    relatedCompany: company,
    relatedCase: task.case,
    relatedContract: contract,
    history: historyRaw.map(formatHistoryEntry),
    comments: comments.map((c) => ({
      id: c.id,
      content: c.content,
      created_at: c.created_at,
      created_by: c.created_by,
      author: c.author,
    })),
    availableAssignees: users,
  }
}
