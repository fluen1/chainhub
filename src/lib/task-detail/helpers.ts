import type { Task, TaskHistory, TaskHistoryField } from '@prisma/client'
import {
  getTaskStatusLabel,
  getPriorityLabel,
  formatDate,
} from '@/lib/labels'

// -----------------------------------------------------------------
// Typer
// -----------------------------------------------------------------

export type TaskUrgency = 'overdue' | 'due-soon' | 'upcoming' | 'none'

export type TaskSectionKey =
  | 'header'
  | 'context'
  | 'description'
  | 'history'
  | 'comments'

export const TASK_SECTION_KEYS: TaskSectionKey[] = [
  'header',
  'context',
  'description',
  'history',
  'comments',
]

// -----------------------------------------------------------------
// Urgency — "overdue" = due_date er passeret, ikke lukket opgave
// "due-soon" = mindre end 3 dage til frist
// "upcoming" = frist 3+ dage ude i fremtiden
// "none" = ingen due_date ELLER lukket opgave
// -----------------------------------------------------------------

const DUE_SOON_DAYS = 3

export function deriveTaskUrgency(
  task: Pick<Task, 'due_date' | 'status'>,
  today: Date = new Date()
): TaskUrgency {
  if (task.status === 'LUKKET') return 'none'
  if (!task.due_date) return 'none'

  const msPerDay = 1000 * 60 * 60 * 24
  const diffDays = Math.floor(
    (task.due_date.getTime() - startOfDay(today).getTime()) / msPerDay
  )

  if (diffDays < 0) return 'overdue'
  if (diffDays <= DUE_SOON_DAYS) return 'due-soon'
  return 'upcoming'
}

function startOfDay(d: Date): Date {
  const copy = new Date(d)
  copy.setHours(0, 0, 0, 0)
  return copy
}

// -----------------------------------------------------------------
// History formatering — oversætter gemte feltnavne + værdier til dansk
// -----------------------------------------------------------------

export interface FormattedHistoryEntry {
  id: string
  fieldLabel: string
  oldLabel: string
  newLabel: string
  changedAt: Date
  changedByName: string
}

export function formatHistoryEntry(
  entry: TaskHistory & { changedBy: { name: string } }
): FormattedHistoryEntry {
  return {
    id: entry.id,
    fieldLabel: fieldLabel(entry.field_name),
    oldLabel: valueLabel(entry.field_name, entry.old_value),
    newLabel: valueLabel(entry.field_name, entry.new_value),
    changedAt: entry.changed_at,
    changedByName: entry.changedBy.name,
  }
}

function fieldLabel(field: TaskHistoryField): string {
  switch (field) {
    case 'STATUS':
      return 'Status'
    case 'PRIORITY':
      return 'Prioritet'
    case 'ASSIGNEE':
      return 'Ansvarlig'
    case 'DUE_DATE':
      return 'Frist'
    case 'TITLE':
      return 'Titel'
    case 'DESCRIPTION':
      return 'Beskrivelse'
  }
}

function valueLabel(field: TaskHistoryField, value: string | null): string {
  if (value === null || value === '') return '—'
  switch (field) {
    case 'STATUS':
      return getTaskStatusLabel(value)
    case 'PRIORITY':
      return getPriorityLabel(value)
    case 'ASSIGNEE':
      return value // lagres som user name, ikke user id
    case 'DUE_DATE':
      return formatDate(value)
    case 'TITLE':
    case 'DESCRIPTION':
      return value
  }
}

// -----------------------------------------------------------------
// Group tasks by company (til /tasks?view=grouped)
// -----------------------------------------------------------------

export const NO_COMPANY_KEY = 'ingen-selskab' as const

export function groupTasksByCompany<T extends { company_id: string | null }>(
  tasks: T[]
): Map<string, T[]> {
  const map = new Map<string, T[]>()
  for (const t of tasks) {
    const key = t.company_id ?? NO_COMPANY_KEY
    const bucket = map.get(key)
    if (bucket) bucket.push(t)
    else map.set(key, [t])
  }
  return map
}

