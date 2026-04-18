'use server'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { canAccessCompany } from '@/lib/permissions'
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
import type { Task } from '@prisma/client'
import { captureError } from '@/lib/logger'

export async function createTask(input: CreateTaskInput): Promise<ActionResult<Task>> {
  const session = await auth()
  if (!session) return { error: 'Ikke autoriseret' }

  const parsed = createTaskSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Ugyldigt input' }

  if (parsed.data.companyId) {
    const hasAccess = await canAccessCompany(session.user.id, parsed.data.companyId)
    if (!hasAccess) return { error: 'Ingen adgang til dette selskab' }
  }

  try {
    const task = await prisma.task.create({
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
  if (!session) return { error: 'Ikke autoriseret' }

  const parsed = updateTaskStatusSchema.safeParse(input)
  if (!parsed.success) return { error: 'Ugyldigt input' }

  const task = await prisma.task.findFirst({
    where: {
      id: parsed.data.taskId,
      organization_id: session.user.organizationId,
      deleted_at: null,
    },
  })
  if (!task) return { error: 'Opgave ikke fundet' }

  if (task.status === parsed.data.status) {
    return { data: task }
  }

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
  if (!session) return { error: 'Ikke autoriseret' }

  const parsed = updateTaskPrioritySchema.safeParse(input)
  if (!parsed.success) return { error: 'Ugyldigt input' }

  const task = await prisma.task.findFirst({
    where: {
      id: parsed.data.taskId,
      organization_id: session.user.organizationId,
      deleted_at: null,
    },
  })
  if (!task) return { error: 'Opgave ikke fundet' }
  if (task.priority === parsed.data.priority) return { data: task }

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
  if (!session) return { error: 'Ikke autoriseret' }

  const parsed = updateTaskAssigneeSchema.safeParse(input)
  if (!parsed.success) return { error: 'Ugyldigt input' }

  const task = await prisma.task.findFirst({
    where: {
      id: parsed.data.taskId,
      organization_id: session.user.organizationId,
      deleted_at: null,
    },
    include: { assignee: { select: { name: true } } },
  })
  if (!task) return { error: 'Opgave ikke fundet' }
  if (task.assigned_to === parsed.data.assignedTo) return { data: task }

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
  if (!session) return { error: 'Ikke autoriseret' }

  const parsed = updateTaskDueDateSchema.safeParse(input)
  if (!parsed.success) return { error: 'Ugyldigt input' }

  const task = await prisma.task.findFirst({
    where: {
      id: parsed.data.taskId,
      organization_id: session.user.organizationId,
      deleted_at: null,
    },
  })
  if (!task) return { error: 'Opgave ikke fundet' }

  const newDueDate = parsed.data.dueDate ? new Date(parsed.data.dueDate) : null
  const oldIso = task.due_date ? task.due_date.toISOString().slice(0, 10) : null
  const newIso = newDueDate ? newDueDate.toISOString().slice(0, 10) : null
  if (oldIso === newIso) return { data: task }

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
  if (!session) return { error: 'Ikke autoriseret' }

  const task = await prisma.task.findFirst({
    where: { id: taskId, organization_id: session.user.organizationId, deleted_at: null },
  })
  if (!task) return { error: 'Opgave ikke fundet' }

  if (task.created_by !== session.user.id) {
    const hasAdmin = await canAccessCompany(session.user.id, task.company_id ?? '')
    if (!hasAdmin) return { error: 'Ingen adgang til at slette denne opgave' }
  }

  await prisma.task.update({
    where: { id: taskId },
    data: { deleted_at: new Date() },
  })

  revalidatePath('/tasks')
  return { data: undefined }
}
