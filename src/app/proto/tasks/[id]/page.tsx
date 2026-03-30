'use client'

import Link from 'next/link'
import { ArrowLeft, MessageSquare, User } from 'lucide-react'
import { usePrototype } from '@/components/prototype/PrototypeProvider'
import { getTaskById } from '@/mock/tasks'
import { cn } from '@/lib/utils'
import type { MockTask } from '@/mock/types'

function statusBadgeClass(status: MockTask['status']): string {
  switch (status) {
    case 'NY': return 'bg-blue-100 text-blue-700'
    case 'AKTIV': return 'bg-green-100 text-green-700'
    case 'AFVENTER': return 'bg-amber-100 text-amber-700'
    case 'LUKKET': return 'bg-gray-100 text-gray-500'
    default: return 'bg-gray-100 text-gray-600'
  }
}

function priorityBadgeClass(priority: MockTask['priority']): string {
  switch (priority) {
    case 'KRITISK': return 'bg-red-100 text-red-700'
    case 'HOEJ': return 'bg-orange-100 text-orange-700'
    case 'MELLEM': return 'bg-blue-100 text-blue-700'
    case 'LAV': return 'bg-gray-100 text-gray-600'
    default: return 'bg-gray-100 text-gray-600'
  }
}

function dueDateColor(task: MockTask): string {
  const days = task.daysUntilDue
  if (days === null) return 'text-gray-500'
  if (days < 0) return 'text-red-600 font-medium'
  if (days <= 7) return 'text-amber-600'
  return 'text-gray-700'
}

function dueDateLabel(task: MockTask): string {
  const days = task.daysUntilDue
  if (days === null) return 'Ingen forfaldsdato'
  if (days < 0) return `Forfaldet — ${Math.abs(days)} dage siden`
  if (days === 0) return 'Forfalder i dag'
  if (days === 1) return 'Forfalder i morgen'
  return `Forfalder om ${days} dage`
}

export default function TaskDetailPage({ params }: { params: { id: string } }) {
  // usePrototype bruges til at sikre vi er inden for provideren
  usePrototype()

  const task = getTaskById(params.id)

  if (!task) {
    return (
      <div className="space-y-4">
        <Link
          href="/proto/tasks"
          className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Opgaver
        </Link>
        <div className="bg-white rounded-lg shadow-sm border p-12 text-center">
          <p className="text-gray-500 text-sm">Opgave ikke fundet</p>
          <Link
            href="/proto/tasks"
            className="mt-4 inline-block text-sm text-blue-600 hover:underline"
          >
            Tilbage til opgaveoversigt
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Brødkrumme */}
      <Link
        href="/proto/tasks"
        className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Opgaver
      </Link>

      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="space-y-3">
          <h1 className="text-xl font-bold text-gray-900">{task.title}</h1>
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn('inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium', statusBadgeClass(task.status))}>
              {task.statusLabel}
            </span>
            <span className={cn('inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium', priorityBadgeClass(task.priority))}>
              {task.priorityLabel}
            </span>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4 border-t pt-4">
          {/* Forfaldsdato */}
          <div>
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Forfaldsdato</span>
            <div className="mt-1">
              {task.dueDate ? (
                <div>
                  <span className="text-sm text-gray-900">{task.dueDate}</span>
                  <span className={cn('ml-2 text-xs', dueDateColor(task))}>
                    ({dueDateLabel(task)})
                  </span>
                </div>
              ) : (
                <span className={cn('text-sm', dueDateColor(task))}>
                  {dueDateLabel(task)}
                </span>
              )}
            </div>
          </div>

          {/* Selskab */}
          <div>
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Selskab</span>
            <div className="mt-1">
              <Link
                href={`/proto/portfolio/${task.companyId}`}
                className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
              >
                {task.companyName}
              </Link>
            </div>
          </div>

          {/* Tildelt til */}
          <div>
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Tildelt til</span>
            <div className="mt-1 flex items-center gap-1.5">
              <User className="h-3.5 w-3.5 text-gray-400" />
              <span className="text-sm text-gray-700">{task.assignedToName}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Kommentarer og historik */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex items-center gap-2 mb-4">
          <MessageSquare className="h-4 w-4 text-gray-400" />
          <h2 className="text-sm font-semibold text-gray-900">Kommentarer og historik</h2>
        </div>
        <p className="text-sm text-gray-400 italic">Ingen kommentarer endnu</p>
      </div>
    </div>
  )
}
