'use server'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { canAccessCompany } from '@/lib/permissions'
import {
  createTaskSchema,
  updateTaskStatusSchema,
  type CreateTaskInput,
  type UpdateTaskStatusInput,
} from '@/lib/validations/case'
import { revalidatePath } from 'next/cache'
import type { ActionResult } from '@/types/actions'
import type { Task } from '@prisma/client'

export async function createTask(
  input: CreateTaskInput
): Promise<ActionResult<Task>> {
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
        priority: parsed.data.priority as never,
        status: 'NY',
        case_id: parsed.data.caseId || null,
        company_id: parsed.data.companyId || null,
        created_by: session.user.id,
      },
    })

    revalidatePath('/tasks')
    if (parsed.data.caseId) revalidatePath(`/cases/${parsed.data.caseId}`)
    return { data: task }
  } catch {
    return { error: 'Opgaven kunne ikke oprettes — prøv igen' }
  }
}

export async function updateTaskStatus(
  input: UpdateTaskStatusInput
): Promise<ActionResult<Task>> {
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

  try {
    const updated = await prisma.task.update({
      where: { id: parsed.data.taskId },
      data: { status: parsed.data.status as never },
    })

    revalidatePath('/tasks')
    if (task.case_id) revalidatePath(`/cases/${task.case_id}`)
    return { data: updated }
  } catch {
    return { error: 'Status kunne ikke opdateres' }
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
