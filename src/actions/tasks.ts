'use server'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { canAccessCompany, canAccessModule } from '@/lib/permissions'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import {
  createTaskSchema,
  updateTaskSchema,
  deleteTaskSchema,
  getTaskSchema,
  listTasksSchema,
  updateTaskStatusSchema,
} from '@/lib/validations/task'
import type { ActionResult, TaskWithAssignee, TaskListResult } from '@/types/task'
import type { Task, Prisma } from '@prisma/client'

// ==================== HJÆLPEFUNKTIONER ====================

async function verifyTaskAccess(
  taskId: string,
  userId: string,
  organizationId: string
): Promise<
  | { ok: true; task: Task }
  | { ok: false; error: string }
> {
  const task = await prisma.task.findFirst({
    where: {
      id: taskId,
      organizationId,
      deletedAt: null,
    },
  })

  if (!task) {
    return { ok: false, error: 'Opgaven blev ikke fundet' }
  }

  // Tjek company-adgang hvis opgaven er tilknyttet et selskab
  if (task.companyId) {
    const hasAccess = await canAccessCompany(userId, task.companyId)
    if (!hasAccess) {
      return { ok: false, error: 'Du har ikke adgang til denne opgave' }
    }
  }

  return { ok: true, task }
}

// ==================== OPRET OPGAVE ====================

export async function createTask(
  input: z.infer<typeof createTaskSchema>
): Promise<ActionResult<Task>> {
  const session = await auth()
  if (!session?.user) return { error: 'Ikke autoriseret' }

  const hasModuleAccess = await canAccessModule(session.user.id, 'tasks')
  if (!hasModuleAccess) return { error: 'Du har ikke adgang til opgavemodulet' }

  const parsed = createTaskSchema.safeParse(input)
  if (!parsed.success) {
    const firstError = parsed.error.errors[0]
    return { error: firstError?.message ?? 'Ugyldigt input' }
  }

  const data = parsed.data

  // Validér caseId tilhører organisationen
  if (data.caseId) {
    const caseRecord = await prisma.case.findFirst({
      where: {
        id: data.caseId,
        organizationId: session.user.organizationId,
        deletedAt: null,
      },
    })
    if (!caseRecord) {
      return { error: 'Sagen blev ikke fundet i din organisation' }
    }
  }

  // Validér companyId og adgang
  if (data.companyId) {
    const company = await prisma.company.findFirst({
      where: {
        id: data.companyId,
        organizationId: session.user.organizationId,
        deletedAt: null,
      },
    })
    if (!company) {
      return { error: 'Selskabet blev ikke fundet i din organisation' }
    }
    const hasAccess = await canAccessCompany(session.user.id, data.companyId)
    if (!hasAccess) {
      return { error: 'Du har ikke adgang til dette selskab' }
    }
  }

  // Validér contractId tilhører organisationen
  if (data.contractId) {
    const contract = await prisma.contract.findFirst({
      where: {
        id: data.contractId,
        organizationId: session.user.organizationId,
        deletedAt: null,
      },
    })
    if (!contract) {
      return { error: 'Kontrakten blev ikke fundet i din organisation' }
    }
  }

  // Validér assignedTo tilhører organisationen
  if (data.assignedTo) {
    const assignee = await prisma.user.findFirst({
      where: {
        id: data.assignedTo,
        organizationId: session.user.organizationId,
        deletedAt: null,
      },
    })
    if (!assignee) {
      return { error: 'Den tildelte bruger blev ikke fundet i din organisation' }
    }
  }

  try {
    const task = await prisma.task.create({
      data: {
        organizationId: session.user.organizationId,
        title: data.title,
        description: data.description ?? null,
        status: data.status,
        priority: data.priority,
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        assignedTo: data.assignedTo ?? null,
        caseId: data.caseId ?? null,
        companyId: data.companyId ?? null,
        contractId: data.contractId ?? null,
        createdBy: session.user.id,
      },
    })

    revalidatePath('/tasks')
    if (data.caseId) revalidatePath(`/cases/${data.caseId}`)

    return { data: task }
  } catch (error) {
    console.error('createTask error:', error)
    return { error: 'Opgaven kunne ikke oprettes — prøv igen eller kontakt support' }
  }
}

// ==================== HENT OPGAVE ====================

export async function getTask(
  input: z.infer<typeof getTaskSchema>
): Promise<ActionResult<TaskWithAssignee>> {
  const session = await auth()
  if (!session?.user) return { error: 'Ikke autoriseret' }

  const hasModuleAccess = await canAccessModule(session.user.id, 'tasks')
  if (!hasModuleAccess) return { error: 'Du har ikke adgang til opgavemodulet' }

  const parsed = getTaskSchema.safeParse(input)
  if (!parsed.success) return { error: 'Ugyldigt opgave-ID' }

  const { taskId } = parsed.data

  const accessResult = await verifyTaskAccess(
    taskId,
    session.user.id,
    session.user.organizationId
  )
  if (!accessResult.ok) return { error: accessResult.error }

  try {
    const task = await prisma.task.findFirst({
      where: {
        id: taskId,
        organizationId: session.user.organizationId,
        deletedAt: null,
      },
      include: {
        assignee: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
        case: {
          select: { id: true, title: true },
        },
      },
    })

    if (!task) return { error: 'Opgaven blev ikke fundet' }

    return { data: task as TaskWithAssignee }
  } catch (error) {
    console.error('getTask error:', error)
    return { error: 'Opgaven kunne ikke hentes — prøv igen' }
  }
}

// ==================== LIST OPGAVER ====================

export async function listTasks(
  input: z.infer<typeof listTasksSchema> = {
    page: 1,
    pageSize: 25,
    sortBy: 'createdAt',
    sortDir: 'desc',
  }
): Promise<ActionResult<TaskListResult>> {
  const session = await auth()
  if (!session?.user) return { error: 'Ikke autoriseret' }

  const hasModuleAccess = await canAccessModule(session.user.id, 'tasks')
  if (!hasModuleAccess) return { error: 'Du har ikke adgang til opgavemodulet' }

  const parsed = listTasksSchema.safeParse(input)
  if (!parsed.success) return { error: 'Ugyldigt filter-input' }

  const {
    status,
    priority,
    assignedTo,
    caseId,
    companyId,
    search,
    page,
    pageSize,
    sortBy,
    sortDir,
    dueBefore,
    dueAfter,
  } = parsed.data

  // Validér company-adgang hvis filtreret
  if (companyId) {
    const hasAccess = await canAccessCompany(session.user.id, companyId)
    if (!hasAccess) {
      return { error: 'Du har ikke adgang til dette selskab' }
    }
  }

  const where: Prisma.TaskWhereInput = {
    organizationId: session.user.organizationId,
    deletedAt: null,
    ...(status && { status }),
    ...(priority && { priority }),
    ...(assignedTo && { assignedTo }),
    ...(caseId && { caseId }),
    ...(companyId && { companyId }),
  }

  // Dato-interval filter
  if (dueBefore || dueAfter) {
    where.dueDate = {
      ...(dueAfter && { gte: new Date(dueAfter) }),
      ...(dueBefore && { lte: new Date(dueBefore) }),
    }
  }

  // Søgning
  if (search && search.trim()) {
    where.OR = [
      { title: { contains: search.trim(), mode: 'insensitive' } },
      { description: { contains: search.trim(), mode: 'insensitive' } },
    ]
  }

  const skip = (page - 1) * pageSize
  const orderBy: Prisma.TaskOrderByWithRelationInput = { [sortBy]: sortDir }

  try {
    const [tasks, total] = await Promise.all([
      prisma.task.findMany({
        where,
        include: {
          assignee: {
            select: { id: true, name: true, email: true, avatarUrl: true },
          },
          case: {
            select: { id: true, title: true },
          },
        },
        orderBy,
        take: pageSize,
        skip,
      }),
      prisma.task.count({ where }),
    ])

    return { data: { tasks: tasks as TaskWithAssignee[], total } }
  } catch (error) {
    console.error('listTasks error:', error)
    return { error: 'Opgaver kunne ikke hentes — prøv igen' }
  }
}

// ==================== OPDATER OPGAVE ====================

export async function updateTask(
  input: z.infer<typeof updateTaskSchema>
): Promise<ActionResult<Task>> {
  const session = await auth()
  if (!session?.user) return { error: 'Ikke autoriseret' }

  const hasModuleAccess = await canAccessModule(session.user.id, 'tasks')
  if (!hasModuleAccess) return { error: 'Du har ikke adgang til opgavemodulet' }

  const parsed = updateTaskSchema.safeParse(input)
  if (!parsed.success) {
    const firstError = parsed.error.errors[0]
    return { error: firstError?.message ?? 'Ugyldigt input' }
  }

  const { taskId, ...updateData } = parsed.data

  const accessResult = await verifyTaskAccess(
    taskId,
    session.user.id,
    session.user.organizationId
  )
  if (!accessResult.ok) return { error: accessResult.error }

  // Validér ny assignedTo
  if (updateData.assignedTo) {
    const assignee = await prisma.user.findFirst({
      where: {
        id: updateData.assignedTo,
        organizationId: session.user.organizationId,
        deletedAt: null,
      },
    })
    if (!assignee) {
      return { error: 'Den tildelte bruger blev ikke fundet i din organisation' }
    }
  }

  // Validér ny companyId og adgang
  if (updateData.companyId) {
    const company = await prisma.company.findFirst({
      where: {
        id: updateData.companyId,
        organizationId: session.user.organizationId,
        deletedAt: null,
      },
    })
    if (!company) {
      return { error: 'Selskabet blev ikke fundet i din organisation' }
    }
    const hasAccess = await canAccessCompany(session.user.id, updateData.companyId)
    if (!hasAccess) {
      return { error: 'Du har ikke adgang til dette selskab' }
    }
  }

  try {
    const updated = await prisma.task.update({
      where: {
        id: taskId,
        organizationId: session.user.organizationId,
      },
      data: {
        ...(updateData.title !== undefined && { title: updateData.title }),
        ...(updateData.description !== undefined && {
          description: updateData.description ?? null,
        }),
        ...(updateData.status !== undefined && { status: updateData.status }),
        ...(updateData.priority !== undefined && { priority: updateData.priority }),
        ...(updateData.dueDate !== undefined && {
          dueDate: updateData.dueDate ? new Date(updateData.dueDate) : null,
        }),
        ...(updateData.assignedTo !== undefined && {
          assignedTo: updateData.assignedTo ?? null,
        }),
        ...(updateData.caseId !== undefined && {
          caseId: updateData.caseId ?? null,
        }),
        ...(updateData.companyId !== undefined && {
          companyId: updateData.companyId ?? null,
        }),
        ...(updateData.contractId !== undefined && {
          contractId: updateData.contractId ?? null,
        }),
      },
    })

    revalidatePath('/tasks')
    if (updated.caseId) revalidatePath(`/cases/${updated.caseId}`)

    return { data: updated }
  } catch (error) {
    console.error('updateTask error:', error)
    return { error: 'Opgaven kunne ikke opdateres — prøv igen eller kontakt support' }
  }
}

// ==================== OPDATER STATUS ====================

export async function updateTaskStatus(
  input: z.infer<typeof updateTaskStatusSchema>
): Promise<ActionResult<Task>> {
  const session = await auth()
  if (!session?.user) return { error: 'Ikke autoriseret' }

  const hasModuleAccess = await canAccessModule(session.user.id, 'tasks')
  if (!hasModuleAccess) return { error: 'Du har ikke adgang til opgavemodulet' }

  const parsed = updateTaskStatusSchema.safeParse(input)
  if (!parsed.success) {
    const firstError = parsed.error.errors[0]
    return { error: firstError?.message ?? 'Ugyldigt input' }
  }

  const { taskId, status } = parsed.data

  const accessResult = await verifyTaskAccess(
    taskId,
    session.user.id,
    session.user.organizationId
  )
  if (!accessResult.ok) return { error: accessResult.error }

  try {
    const updated = await prisma.task.update({
      where: {
        id: taskId,
        organizationId: session.user.organizationId,
      },
      data: { status },
    })

    revalidatePath('/tasks')
    if (updated.caseId) revalidatePath(`/cases/${updated.caseId}`)

    return { data: updated }
  } catch (error) {
    console.error('updateTaskStatus error:', error)
    return { error: 'Status kunne ikke opdateres — prøv igen' }
  }
}

// ==================== SLET OPGAVE ====================

export async function deleteTask(
  input: z.infer<typeof deleteTaskSchema>
): Promise<ActionResult<{ id: string }>> {
  const session = await auth()
  if (!session?.user) return { error: 'Ikke autoriseret' }

  const hasModuleAccess = await canAccessModule(session.user.id, 'tasks')
  if (!hasModuleAccess) return { error: 'Du har ikke adgang til opgavemodulet' }

  const parsed = deleteTaskSchema.safeParse(input)
  if (!parsed.success) return { error: 'Ugyldigt opgave-ID' }

  const { taskId } = parsed.data

  const accessResult = await verifyTaskAccess(
    taskId,
    session.user.id,
    session.user.organizationId
  )
  if (!accessResult.ok) return { error: accessResult.error }

  try {
    const task = accessResult.task

    await prisma.task.update({
      where: {
        id: taskId,
        organizationId: session.user.organizationId,
      },
      data: { deletedAt: new Date() },
    })

    revalidatePath('/tasks')
    if (task.caseId) revalidatePath(`/cases/${task.caseId}`)

    return { data: { id: taskId } }
  } catch (error) {
    console.error('deleteTask error:', error)
    return { error: 'Opgaven kunne ikke slettes — prøv igen eller kontakt support' }
  }
}

// ==================== HENT OPGAVER TIL DIGEST ====================

/**
 * Intern funktion — bruges af cron job til daglig digest
 * Returnerer opgaver der udløber inden for 7 dage, grupperet pr. ansvarlig bruger
 */
export async function getTasksForDigest(): Promise<
  Map<string, { user: { id: string; name: string; email: string }; tasks: Task[] }>
> {
  const now = new Date()
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

  const tasks = await prisma.task.findMany({
    where: {
      deletedAt: null,
      status: { notIn: ['LUKKET'] },
      assignedTo: { not: null },
      dueDate: {
        gte: now,
        lte: sevenDaysFromNow,
      },
    },
    include: {
      assignee: {
        select: { id: true, name: true, email: true },
      },
    },
    orderBy: { dueDate: 'asc' },
  })

  const grouped = new Map<
    string,
    { user: { id: string; name: string; email: string }; tasks: Task[] }
  >()

  for (const task of tasks) {
    if (!task.assignee || !task.assignedTo) continue
    const userId = task.assignedTo
    if (!grouped.has(userId)) {
      grouped.set(userId, {
        user: task.assignee as { id: string; name: string; email: string },
        tasks: [],
      })
    }
    grouped.get(userId)!.tasks.push(task)
  }

  return grouped
}