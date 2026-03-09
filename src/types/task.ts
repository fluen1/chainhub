import type { Task, User, Case, Prioritet, TaskStatus } from '@prisma/client'

export type ActionResult<T> =
  | { data: T; error?: never }
  | { error: string; data?: never }

export type TaskWithAssignee = Task & {
  assignee: Pick<User, 'id' | 'name' | 'email' | 'avatarUrl'> | null
  case: Pick<Case, 'id' | 'title'> | null
}

export type TaskWithRelations = Task & {
  assignee: Pick<User, 'id' | 'name' | 'email' | 'avatarUrl'> | null
  case: Pick<Case, 'id' | 'title'> | null
}

export type TaskListResult = {
  tasks: TaskWithAssignee[]
  total: number
}

export const PRIORITET_LABELS: Record<Prioritet, string> = {
  LAV: 'Lav',
  MELLEM: 'Medium',
  HOEJ: 'Høj',
  KRITISK: 'Kritisk',
}

export const PRIORITET_COLORS: Record<Prioritet, string> = {
  LAV: 'bg-gray-100 text-gray-700',
  MELLEM: 'bg-blue-100 text-blue-700',
  HOEJ: 'bg-orange-100 text-orange-700',
  KRITISK: 'bg-red-100 text-red-700',
}

export const STATUS_LABELS: Record<TaskStatus, string> = {
  NY: 'Ny',
  AKTIV: 'Aktiv',
  AFVENTER: 'Afventer',
  LUKKET: 'Lukket',
}

export const STATUS_COLORS: Record<TaskStatus, string> = {
  NY: 'bg-slate-100 text-slate-700',
  AKTIV: 'bg-blue-100 text-blue-700',
  AFVENTER: 'bg-yellow-100 text-yellow-700',
  LUKKET: 'bg-green-100 text-green-700',
}

export const KANBAN_COLUMNS: { status: TaskStatus; label: string; color: string }[] = [
  { status: 'NY', label: 'Ny', color: 'border-slate-300' },
  { status: 'AKTIV', label: 'Aktiv', color: 'border-blue-400' },
  { status: 'AFVENTER', label: 'Afventer', color: 'border-yellow-400' },
  { status: 'LUKKET', label: 'Lukket', color: 'border-green-400' },
]