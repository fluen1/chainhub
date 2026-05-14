import type { Metadata } from 'next'
import { auth } from '@/lib/auth'
import { redirect, notFound } from 'next/navigation'
import { getTaskDetailData } from '@/actions/task-detail'
import { getTaskStatusLabel, getPriorityLabel, formatDate, daysUntil } from '@/lib/labels'
import { TaskDetailB, type TaskDetailViewData } from './task-detail-b'

export const metadata: Metadata = { title: 'Opgave' }

export default async function TaskDetailPage({ params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) redirect('/login')

  const data = await getTaskDetailData(params.id, session.user.id, session.user.organizationId)
  if (!data) notFound()

  const dDue = data.task.due_date ? daysUntil(data.task.due_date) : null
  const fristShort =
    data.task.due_date == null
      ? '—'
      : dDue != null && dDue < 0
        ? `${Math.abs(dDue)}d for sent`
        : dDue != null
          ? `${dDue}d`
          : '—'

  const view: TaskDetailViewData = {
    id: data.task.id,
    nr: `#${data.task.id.slice(-4).toUpperCase()}`,
    title: data.task.title,
    description: data.task.description,
    status: data.task.status,
    statusLabel: getTaskStatusLabel(data.task.status),
    priority: data.task.priority,
    priorityLabel: getPriorityLabel(data.task.priority),
    frist: data.task.due_date ? formatDate(data.task.due_date) : 'Ingen frist',
    fristShort,
    fristDays: dDue,
    isUrgent: dDue != null && dDue >= 0 && dDue <= 1,
    createdAt: formatDate(data.task.created_at),
    assigneeName: data.assignee?.name ?? 'Ikke tildelt',
    relatedCompany: data.relatedCompany,
    relatedCase: data.relatedCase
      ? {
          id: data.relatedCase.id,
          title: data.relatedCase.title,
          status: data.relatedCase.status,
        }
      : null,
    relatedContract: data.relatedContract,
    history: data.history.map((h) => ({
      id: h.id,
      fieldLabel: h.fieldLabel,
      oldLabel: h.oldLabel,
      newLabel: h.newLabel,
      changedByName: h.changedByName,
      changedAt: h.changedAt.toISOString(),
    })),
    comments: data.comments.map((c) => ({
      id: c.id,
      content: c.content,
      authorName: c.author.name,
      createdAt: c.created_at.toISOString(),
    })),
  }

  return <TaskDetailB data={view} />
}
