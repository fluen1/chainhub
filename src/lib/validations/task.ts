import { z } from 'zod'
import { TaskStatus, Prioritet } from '@prisma/client'

export const createTaskSchema = z.object({
  title: z.string().min(1, 'Titel er påkrævet').max(255, 'Titel må højst være 255 tegn'),
  description: z.string().max(5000, 'Beskrivelse må højst være 5000 tegn').optional(),
  status: z.nativeEnum(TaskStatus).default('NY'),
  priority: z.nativeEnum(Prioritet).default('MELLEM'),
  dueDate: z.string().datetime({ offset: true }).optional().nullable(),
  assignedTo: z.string().uuid('Ugyldigt bruger-ID').optional().nullable(),
  caseId: z.string().uuid('Ugyldigt sags-ID').optional().nullable(),
  companyId: z.string().uuid('Ugyldigt selskabs-ID').optional().nullable(),
  contractId: z.string().uuid('Ugyldigt kontrakt-ID').optional().nullable(),
})

export const updateTaskSchema = z.object({
  taskId: z.string().uuid('Ugyldigt opgave-ID'),
  title: z.string().min(1, 'Titel er påkrævet').max(255).optional(),
  description: z.string().max(5000).optional().nullable(),
  status: z.nativeEnum(TaskStatus).optional(),
  priority: z.nativeEnum(Prioritet).optional(),
  dueDate: z.string().datetime({ offset: true }).optional().nullable(),
  assignedTo: z.string().uuid().optional().nullable(),
  caseId: z.string().uuid().optional().nullable(),
  companyId: z.string().uuid().optional().nullable(),
  contractId: z.string().uuid().optional().nullable(),
})

export const deleteTaskSchema = z.object({
  taskId: z.string().uuid('Ugyldigt opgave-ID'),
})

export const getTaskSchema = z.object({
  taskId: z.string().uuid('Ugyldigt opgave-ID'),
})

export const listTasksSchema = z.object({
  status: z.nativeEnum(TaskStatus).optional(),
  priority: z.nativeEnum(Prioritet).optional(),
  assignedTo: z.string().uuid().optional(),
  caseId: z.string().uuid().optional(),
  companyId: z.string().uuid().optional(),
  search: z.string().max(255).optional(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(25),
  sortBy: z.enum(['createdAt', 'updatedAt', 'dueDate', 'title', 'status', 'priority']).default('createdAt'),
  sortDir: z.enum(['asc', 'desc']).default('desc'),
  dueBefore: z.string().datetime({ offset: true }).optional(),
  dueAfter: z.string().datetime({ offset: true }).optional(),
})

export const updateTaskStatusSchema = z.object({
  taskId: z.string().uuid('Ugyldigt opgave-ID'),
  status: z.nativeEnum(TaskStatus),
})