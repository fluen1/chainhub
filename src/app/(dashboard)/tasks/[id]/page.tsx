import type { Metadata } from 'next'
import { auth } from '@/lib/auth'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { prisma } from '@/lib/db'
import { getPriorityLabel, getPriorityStyle, getTaskStatusLabel } from '@/lib/labels'
import { TaskStatusButton } from '@/components/tasks/TaskStatusButton'
import { CommentSection } from '@/components/comments/comment-section'

export const metadata: Metadata = { title: 'Opgave' }

export default async function TaskDetailPage({ params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) redirect('/login')

  const task = await prisma.task.findFirst({
    where: {
      id: params.id,
      organization_id: session.user.organizationId,
      deleted_at: null,
    },
    include: {
      assignee: { select: { id: true, name: true } },
      case: { select: { id: true, title: true } },
      comments: {
        orderBy: { created_at: 'desc' },
        include: {
          author: { select: { id: true, name: true } },
        },
      },
    },
  })

  if (!task) notFound()

  const isOverdue = task.due_date && new Date(task.due_date) < new Date()

  return (
    <div className="max-w-3xl">
      {/* Breadcrumb */}
      <nav className="mb-4 text-xs text-gray-400">
        <Link href="/tasks" className="text-slate-500 no-underline hover:text-blue-600">Opgaver</Link>
        <span className="mx-2">&rsaquo;</span>
        <span className="font-medium text-slate-900">{task.title}</span>
      </nav>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold text-gray-900">{task.title}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getPriorityStyle(task.priority)}`}>
              {getPriorityLabel(task.priority)}
            </span>
            <span className="text-xs text-gray-500">{getTaskStatusLabel(task.status)}</span>
            {isOverdue && (
              <span className="inline-flex items-center rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-700">
                Forfalden
              </span>
            )}
          </div>
        </div>
        <TaskStatusButton taskId={task.id} currentStatus={task.status} />
      </div>

      {/* Details */}
      <div className="mb-6 rounded-xl border border-gray-200 bg-white p-5">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="mb-1 text-xs text-gray-400">Frist</div>
            <div className={isOverdue ? 'font-medium text-red-600' : 'text-gray-900'}>
              {task.due_date ? new Date(task.due_date).toLocaleDateString('da-DK', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'}
            </div>
          </div>
          <div>
            <div className="mb-1 text-xs text-gray-400">Ansvarlig</div>
            <div className="text-gray-900">{task.assignee?.name ?? '—'}</div>
          </div>
          {task.case && (
            <div>
              <div className="mb-1 text-xs text-gray-400">Tilknyttet sag</div>
              <Link href={`/cases/${task.case.id}`} className="text-blue-600 no-underline hover:text-blue-800">
                {task.case.title}
              </Link>
            </div>
          )}
          <div>
            <div className="mb-1 text-xs text-gray-400">Oprettet</div>
            <div className="text-gray-500">{task.created_at.toLocaleDateString('da-DK', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
          </div>
        </div>

        {task.description && (
          <div className="mt-4 border-t border-gray-100 pt-4">
            <div className="mb-1 text-xs text-gray-400">Beskrivelse</div>
            <p className="whitespace-pre-wrap text-sm text-gray-700">{task.description}</p>
          </div>
        )}
      </div>

      {/* Comments */}
      <CommentSection
        taskId={task.id}
        comments={task.comments.map((c) => ({
          id: c.id,
          content: c.content,
          authorName: c.author.name,
          authorId: c.author.id,
          createdAt: c.created_at.toISOString(),
        }))}
        currentUserId={session.user.id}
      />
    </div>
  )
}
