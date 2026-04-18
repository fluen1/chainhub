import { AlertTriangle, Clock, CalendarDays } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  getPriorityLabel,
  getPriorityStyle,
  getTaskStatusLabel,
  formatDate,
} from '@/lib/labels'
import type { TaskUrgency } from '@/lib/task-detail/helpers'

interface TaskHeaderProps {
  title: string
  status: string
  priority: string
  dueDate: Date | null
  urgency: TaskUrgency
  editButton?: React.ReactNode
}

const URGENCY_BADGE: Record<TaskUrgency, { label: string; tone: string; icon: typeof Clock } | null> = {
  overdue: { label: 'Forfalden', tone: 'bg-red-50 text-red-700', icon: AlertTriangle },
  'due-soon': { label: 'Haster', tone: 'bg-amber-50 text-amber-700', icon: Clock },
  upcoming: null,
  none: null,
}

export function TaskHeader({
  title,
  status,
  priority,
  dueDate,
  urgency,
  editButton,
}: TaskHeaderProps) {
  const urgencyBadge = URGENCY_BADGE[urgency]
  const UrgencyIcon = urgencyBadge?.icon

  return (
    <div className="flex items-start justify-between gap-4 mb-6">
      <div className="min-w-0 flex-1">
        <h1 className="text-xl font-bold text-gray-900">{title}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span
            className={cn(
              'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
              getPriorityStyle(priority)
            )}
          >
            {getPriorityLabel(priority)}
          </span>
          <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
            {getTaskStatusLabel(status)}
          </span>
          {dueDate && (
            <span className="inline-flex items-center gap-1 text-xs text-gray-500">
              <CalendarDays className="h-3 w-3" aria-hidden />
              {formatDate(dueDate)}
            </span>
          )}
          {urgencyBadge && UrgencyIcon && (
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium',
                urgencyBadge.tone
              )}
            >
              <UrgencyIcon className="h-3 w-3" aria-hidden />
              {urgencyBadge.label}
            </span>
          )}
        </div>
      </div>
      {editButton}
    </div>
  )
}
