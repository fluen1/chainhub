import type { Metadata } from 'next'
import { auth } from '@/lib/auth'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { getTaskDetailData } from '@/actions/task-detail'
import { TaskHeader } from '@/components/task-detail/task-header'
import { TaskContext } from '@/components/task-detail/task-context'
import { TaskDescription } from '@/components/task-detail/task-description'
import { TaskHistory } from '@/components/task-detail/task-history'
import { EditTaskDialog } from '@/components/task-detail/edit-task-dialog'
import { CommentSection } from '@/components/comments/comment-section'

export const metadata: Metadata = { title: 'Opgave' }

export default async function TaskDetailPage({ params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) redirect('/login')

  const data = await getTaskDetailData(
    params.id,
    session.user.id,
    session.user.organizationId
  )

  if (!data) notFound()

  return (
    <div className="max-w-3xl space-y-4">
      {/* Breadcrumb */}
      <nav className="text-xs text-gray-400">
        <Link href="/tasks" className="text-slate-500 no-underline hover:text-blue-600">
          Opgaver
        </Link>
        <span className="mx-2">&rsaquo;</span>
        <span className="font-medium text-slate-900">{data.task.title}</span>
      </nav>

      <TaskHeader
        title={data.task.title}
        status={data.task.status}
        priority={data.task.priority}
        dueDate={data.task.due_date}
        urgency={data.urgency}
        editButton={
          <EditTaskDialog
            taskId={data.task.id}
            currentStatus={data.task.status}
            currentPriority={data.task.priority}
            currentAssigneeId={data.assignee?.id ?? null}
            currentDueDate={data.task.due_date}
            availableAssignees={data.availableAssignees}
          />
        }
      />

      <TaskContext
        relatedCompany={data.relatedCompany}
        relatedCase={data.relatedCase}
        relatedContract={data.relatedContract}
        assignee={data.assignee}
      />

      <TaskDescription description={data.task.description} />

      <TaskHistory entries={data.history} />

      <CommentSection
        taskId={data.task.id}
        comments={data.comments.map((c) => ({
          id: c.id,
          content: c.content,
          authorName: c.author.name,
          authorId: c.created_by,
          createdAt: c.created_at.toISOString(),
        }))}
        currentUserId={session.user.id}
      />
    </div>
  )
}
