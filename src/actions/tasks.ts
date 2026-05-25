'use server'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { canAccessCompany, getAccessibleCompanies } from '@/lib/permissions'
import {
  createTaskSchema,
  updateTaskStatusSchema,
  updateTaskPrioritySchema,
  updateTaskAssigneeSchema,
  updateTaskDueDateSchema,
  type CreateTaskInput,
  type UpdateTaskStatusInput,
  type UpdateTaskPriorityInput,
  type UpdateTaskAssigneeInput,
  type UpdateTaskDueDateInput,
} from '@/lib/validations/case'
import { revalidatePath } from 'next/cache'
import type { ActionResult } from '@/types/actions'
import type { Task, TaskHistoryField, TaskStatus, Prioritet, Prisma } from '@prisma/client'
import { captureError } from '@/lib/logger'
import { recordAuditEvent } from '@/lib/audit'
import { checkActionRateLimit } from '@/lib/rate-limit'
import { parsePaginationParams } from '@/lib/pagination'
import { getTaskStatusLabel, getPriorityLabel, daysUntil } from '@/lib/labels'
import { formatShortDate } from '@/lib/date-helpers'

// ────────────────────────────────────────────────────────────────────────────
// getTasksPaginated — server-side pagineret liste til /tasks
// ────────────────────────────────────────────────────────────────────────────

export interface TaskRow {
  id: string
  titel: string
  selskab: string
  type: string
  prio: string
  rawPrio: string
  status: string
  rawStatus: string
  frist: string
  fristDays: number
  ansvarlig: string
  isMine: boolean
}

export interface TaskPaginationParams {
  page?: number
  pageSize?: number
  search?: string
  status?: string
  priority?: string
  sort?: string
  sortDir?: 'asc' | 'desc'
  assignedToMe?: boolean
}

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

export async function getTasksPaginated(
  params: TaskPaginationParams
): Promise<{ rows: TaskRow[]; totalCount: number; page: number; pageSize: number }> {
  const session = await auth()
  if (!session) return { rows: [], totalCount: 0, page: 1, pageSize: 20 }

  const orgId = session.user.organizationId
  const userId = session.user.id
  const { page, skip, take } = parsePaginationParams(String(params.page ?? 1), params.pageSize)

  const companyIds = await getAccessibleCompanies(userId, orgId)

  // Byg WHERE-klausulen
  const where: Prisma.TaskWhereInput = {
    organization_id: orgId,
    deleted_at: null,
    OR: [{ company_id: null }, { company_id: { in: companyIds } }],
  }

  if (params.search?.trim()) {
    where.title = { contains: params.search.trim(), mode: 'insensitive' }
  }

  // Status-filter: accepterer både rå DB-værdier (NY, AKTIV_TASK) og dansk label (Ny, I gang)
  const STATUS_LABEL_MAP: Record<string, TaskStatus> = {
    Ny: 'NY',
    'I gang': 'AKTIV_TASK',
    Afventer: 'AFVENTER',
    Lukket: 'LUKKET',
  }
  if (params.status && params.status !== 'Alle') {
    const mapped = STATUS_LABEL_MAP[params.status] ?? (params.status as TaskStatus)
    where.status = mapped
  }

  // Prioritet-filter: accepterer både rå DB-værdier og dansk label
  const PRIO_LABEL_MAP: Record<string, Prioritet> = {
    Lav: 'LAV',
    Mellem: 'MELLEM',
    Høj: 'HOEJ',
    Kritisk: 'KRITISK',
  }
  if (params.priority && params.priority !== 'Alle') {
    const mapped = PRIO_LABEL_MAP[params.priority] ?? (params.priority as Prioritet)
    where.priority = mapped
  }

  if (params.assignedToMe) {
    where.assigned_to = userId
  }

  // Byg OrderBy
  const sortDir = params.sortDir ?? 'asc'
  let orderBy: Prisma.TaskOrderByWithRelationInput = { due_date: sortDir }

  const sortKey = params.sort ?? 'due_date'
  if (sortKey === 'title') orderBy = { title: sortDir }
  else if (sortKey === 'status') orderBy = { status: sortDir }
  else if (sortKey === 'priority') orderBy = { priority: sortDir }
  else if (sortKey === 'due_date') orderBy = { due_date: sortDir }

  const [rawTasks, totalCount] = await Promise.all([
    prisma.task.findMany({
      where,
      orderBy,
      skip,
      take,
      select: {
        id: true,
        title: true,
        company_id: true,
        contract_id: true,
        case_id: true,
        due_date: true,
        status: true,
        priority: true,
        assigned_to: true,
        assignee: { select: { id: true, name: true } },
        case: { select: { id: true, title: true } },
      },
    }),
    prisma.task.count({ where }),
  ])

  // Resolv company-navne (Task.company_id har ingen direkte relation)
  const companyIdsInPage = Array.from(
    new Set(rawTasks.map((t) => t.company_id).filter((id): id is string => !!id))
  )
  const companies = companyIdsInPage.length
    ? await prisma.company.findMany({
        where: { id: { in: companyIdsInPage }, organization_id: orgId, deleted_at: null },
        select: { id: true, name: true },
      })
    : []
  const companyMap = new Map(companies.map((c) => [c.id, c.name]))

  const rows: TaskRow[] = rawTasks.map((t) => {
    const dDue = t.due_date ? daysUntil(t.due_date) : null
    const isClosed = t.status === 'LUKKET'
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

  return { rows, totalCount, page, pageSize: take }
}

export async function createTask(input: CreateTaskInput): Promise<ActionResult<Task>> {
  const session = await auth()
  if (!session) return { error: 'Din session er udløbet — log ind igen.' }

  const parsed = createTaskSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Ugyldigt input' }

  if (parsed.data.companyId) {
    const hasAccess = await canAccessCompany(
      session.user.id,
      parsed.data.companyId,
      session.user.organizationId
    )
    if (!hasAccess) return { error: 'Ingen adgang til dette selskab' }
  }

  const rl = await checkActionRateLimit(session.user.organizationId)
  if (rl.limited) return { error: 'For mange handlinger. Vent venligst.' }

  try {
    const task = await prisma.$transaction(async (tx) => {
      const created = await tx.task.create({
        data: {
          organization_id: session.user.organizationId,
          title: parsed.data.title,
          description: parsed.data.description || null,
          assigned_to: parsed.data.assignedTo || null,
          due_date: parsed.data.dueDate ? new Date(parsed.data.dueDate) : null,
          priority: parsed.data.priority,
          status: 'NY',
          case_id: parsed.data.caseId || null,
          company_id: parsed.data.companyId || null,
          created_by: session.user.id,
        },
      })

      // Opret initial TaskHistory for alle satte felter
      const historyEntries: Array<{
        organization_id: string
        task_id: string
        field_name: TaskHistoryField
        old_value: string | null
        new_value: string | null
        changed_by: string
      }> = [
        {
          organization_id: session.user.organizationId,
          task_id: created.id,
          field_name: 'STATUS',
          old_value: null,
          new_value: 'NY',
          changed_by: session.user.id,
        },
        {
          organization_id: session.user.organizationId,
          task_id: created.id,
          field_name: 'PRIORITY',
          old_value: null,
          new_value: parsed.data.priority,
          changed_by: session.user.id,
        },
      ]

      if (parsed.data.assignedTo) {
        historyEntries.push({
          organization_id: session.user.organizationId,
          task_id: created.id,
          field_name: 'ASSIGNEE',
          old_value: null,
          new_value: parsed.data.assignedTo,
          changed_by: session.user.id,
        })
      }

      if (parsed.data.dueDate) {
        historyEntries.push({
          organization_id: session.user.organizationId,
          task_id: created.id,
          field_name: 'DUE_DATE',
          old_value: null,
          new_value: parsed.data.dueDate,
          changed_by: session.user.id,
        })
      }

      await Promise.all(historyEntries.map((entry) => tx.taskHistory.create({ data: entry })))

      return created
    })

    revalidatePath('/tasks')
    if (parsed.data.caseId) revalidatePath(`/cases/${parsed.data.caseId}`)
    return { data: task }
  } catch (err) {
    captureError(err, {
      namespace: 'action:createTask',
      extra: { companyId: parsed.data.companyId, caseId: parsed.data.caseId },
    })
    return { error: 'Opgaven kunne ikke oprettes — prøv igen' }
  }
}

export async function updateTaskStatus(input: UpdateTaskStatusInput): Promise<ActionResult<Task>> {
  const session = await auth()
  if (!session) return { error: 'Din session er udløbet — log ind igen.' }

  const parsed = updateTaskStatusSchema.safeParse(input)
  if (!parsed.success) return { error: 'Udfyld alle påkrævede felter og prøv igen.' }

  const task = await prisma.task.findFirst({
    where: {
      id: parsed.data.taskId,
      organization_id: session.user.organizationId,
      deleted_at: null,
    },
    select: { id: true, status: true, case_id: true },
  })
  if (!task) return { error: 'Opgave ikke fundet' }

  if (task.status === parsed.data.status) {
    return { data: task as unknown as Task }
  }

  const rlSts = await checkActionRateLimit(session.user.organizationId)
  if (rlSts.limited) return { error: 'For mange handlinger. Vent venligst.' }

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const next = await tx.task.update({
        where: { id: parsed.data.taskId },
        data: { status: parsed.data.status },
      })
      await tx.taskHistory.create({
        data: {
          organization_id: session.user.organizationId,
          task_id: task.id,
          field_name: 'STATUS',
          old_value: task.status,
          new_value: parsed.data.status,
          changed_by: session.user.id,
        },
      })
      return next
    })

    revalidatePath('/tasks')
    revalidatePath(`/tasks/${task.id}`)
    if (task.case_id) revalidatePath(`/cases/${task.case_id}`)
    return { data: updated }
  } catch (err) {
    captureError(err, {
      namespace: 'action:updateTaskStatus',
      extra: { taskId: parsed.data.taskId, newStatus: parsed.data.status },
    })
    return { error: 'Status kunne ikke opdateres' }
  }
}

export async function updateTaskPriority(
  input: UpdateTaskPriorityInput
): Promise<ActionResult<Task>> {
  const session = await auth()
  if (!session) return { error: 'Din session er udløbet — log ind igen.' }

  const parsed = updateTaskPrioritySchema.safeParse(input)
  if (!parsed.success) return { error: 'Udfyld alle påkrævede felter og prøv igen.' }

  const task = await prisma.task.findFirst({
    where: {
      id: parsed.data.taskId,
      organization_id: session.user.organizationId,
      deleted_at: null,
    },
    select: { id: true, priority: true },
  })
  if (!task) return { error: 'Opgave ikke fundet' }
  if (task.priority === parsed.data.priority) return { data: task as unknown as Task }

  const rlPrio = await checkActionRateLimit(session.user.organizationId)
  if (rlPrio.limited) return { error: 'For mange handlinger. Vent venligst.' }

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const next = await tx.task.update({
        where: { id: task.id },
        data: { priority: parsed.data.priority },
      })
      await tx.taskHistory.create({
        data: {
          organization_id: session.user.organizationId,
          task_id: task.id,
          field_name: 'PRIORITY',
          old_value: task.priority,
          new_value: parsed.data.priority,
          changed_by: session.user.id,
        },
      })
      return next
    })
    revalidatePath('/tasks')
    revalidatePath(`/tasks/${task.id}`)
    return { data: updated }
  } catch (err) {
    captureError(err, {
      namespace: 'action:updateTaskPriority',
      extra: { taskId: parsed.data.taskId, newPriority: parsed.data.priority },
    })
    return { error: 'Prioritet kunne ikke opdateres' }
  }
}

export async function updateTaskAssignee(
  input: UpdateTaskAssigneeInput
): Promise<ActionResult<Task>> {
  const session = await auth()
  if (!session) return { error: 'Din session er udløbet — log ind igen.' }

  const parsed = updateTaskAssigneeSchema.safeParse(input)
  if (!parsed.success) return { error: 'Udfyld alle påkrævede felter og prøv igen.' }

  const task = await prisma.task.findFirst({
    where: {
      id: parsed.data.taskId,
      organization_id: session.user.organizationId,
      deleted_at: null,
    },
    select: {
      id: true,
      assigned_to: true,
      assignee: { select: { name: true } },
    },
  })
  if (!task) return { error: 'Opgave ikke fundet' }
  if (task.assigned_to === parsed.data.assignedTo) return { data: task as unknown as Task }

  const rlAssign = await checkActionRateLimit(session.user.organizationId)
  if (rlAssign.limited) return { error: 'For mange handlinger. Vent venligst.' }

  // Resolve nyt assignee-navn til historik (user-id er ikke læsbart bagefter)
  let newAssigneeName: string | null = null
  if (parsed.data.assignedTo) {
    const nextUser = await prisma.user.findFirst({
      where: {
        id: parsed.data.assignedTo,
        organization_id: session.user.organizationId,
        deleted_at: null,
      },
      select: { name: true },
    })
    if (!nextUser) return { error: 'Valgt bruger ikke fundet' }
    newAssigneeName = nextUser.name
  }

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const next = await tx.task.update({
        where: { id: task.id },
        data: { assigned_to: parsed.data.assignedTo },
      })
      await tx.taskHistory.create({
        data: {
          organization_id: session.user.organizationId,
          task_id: task.id,
          field_name: 'ASSIGNEE',
          old_value: task.assignee?.name ?? null,
          new_value: newAssigneeName,
          changed_by: session.user.id,
        },
      })
      return next
    })
    revalidatePath('/tasks')
    revalidatePath(`/tasks/${task.id}`)
    return { data: updated }
  } catch (err) {
    captureError(err, {
      namespace: 'action:updateTaskAssignee',
      extra: { taskId: parsed.data.taskId, newAssigneeId: parsed.data.assignedTo },
    })
    return { error: 'Ansvarlig kunne ikke opdateres' }
  }
}

export async function updateTaskDueDate(
  input: UpdateTaskDueDateInput
): Promise<ActionResult<Task>> {
  const session = await auth()
  if (!session) return { error: 'Din session er udløbet — log ind igen.' }

  const parsed = updateTaskDueDateSchema.safeParse(input)
  if (!parsed.success) return { error: 'Udfyld alle påkrævede felter og prøv igen.' }

  const task = await prisma.task.findFirst({
    where: {
      id: parsed.data.taskId,
      organization_id: session.user.organizationId,
      deleted_at: null,
    },
    select: { id: true, due_date: true },
  })
  if (!task) return { error: 'Opgave ikke fundet' }

  const rlDue = await checkActionRateLimit(session.user.organizationId)
  if (rlDue.limited) return { error: 'For mange handlinger. Vent venligst.' }

  const newDueDate = parsed.data.dueDate ? new Date(parsed.data.dueDate) : null
  const oldIso = task.due_date ? task.due_date.toISOString().slice(0, 10) : null
  const newIso = newDueDate ? newDueDate.toISOString().slice(0, 10) : null
  if (oldIso === newIso) return { data: task as unknown as Task }

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const next = await tx.task.update({
        where: { id: task.id },
        data: { due_date: newDueDate },
      })
      await tx.taskHistory.create({
        data: {
          organization_id: session.user.organizationId,
          task_id: task.id,
          field_name: 'DUE_DATE',
          old_value: oldIso,
          new_value: newIso,
          changed_by: session.user.id,
        },
      })
      return next
    })
    revalidatePath('/tasks')
    revalidatePath(`/tasks/${task.id}`)
    return { data: updated }
  } catch (err) {
    captureError(err, {
      namespace: 'action:updateTaskDueDate',
      extra: { taskId: parsed.data.taskId, newDueDate: parsed.data.dueDate },
    })
    return { error: 'Frist kunne ikke opdateres' }
  }
}

export async function deleteTask(taskId: string): Promise<ActionResult<void>> {
  const session = await auth()
  if (!session) return { error: 'Din session er udløbet — log ind igen.' }

  const task = await prisma.task.findFirst({
    where: { id: taskId, organization_id: session.user.organizationId, deleted_at: null },
    select: { id: true, created_by: true, company_id: true, case_id: true },
  })
  if (!task) return { error: 'Opgave ikke fundet' }

  if (task.created_by !== session.user.id) {
    const hasAdmin = await canAccessCompany(
      session.user.id,
      task.company_id ?? '',
      session.user.organizationId
    )
    if (!hasAdmin) return { error: 'Ingen adgang til at slette denne opgave' }
  }

  const rlDel = await checkActionRateLimit(session.user.organizationId)
  if (rlDel.limited) return { error: 'For mange handlinger. Vent venligst.' }

  await prisma.task.update({
    where: { id: taskId },
    data: { deleted_at: new Date() },
  })

  await recordAuditEvent({
    organizationId: session.user.organizationId,
    userId: session.user.id,
    action: 'DELETE',
    resourceType: 'task',
    resourceId: taskId,
    resourceCompanyId: task.company_id ?? undefined,
  })

  revalidatePath('/tasks')
  return { data: undefined }
}
