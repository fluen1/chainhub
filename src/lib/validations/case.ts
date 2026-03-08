import { z } from 'zod'
import { SagsType, SagsSubtype, CaseStatus, SensitivityLevel, TaskStatus, Prioritet } from '@prisma/client'
import { VALID_SUBTYPES_FOR_TYPE } from '@/types/case'

// ==================== SAG ====================

export const createCaseSchema = z
  .object({
    title: z
      .string()
      .min(1, 'Titel er påkrævet')
      .max(255, 'Titel må maks. være 255 tegn'),
    caseType: z.nativeEnum(SagsType, {
      errorMap: () => ({ message: 'Ugyldig sagstype' }),
    }),
    caseSubtype: z.nativeEnum(SagsSubtype).optional().nullable(),
    sensitivity: z.nativeEnum(SensitivityLevel, {
      errorMap: () => ({ message: 'Ugyldigt sensitivitetsniveau' }),
    }),
    description: z.string().max(5000, 'Beskrivelse må maks. være 5.000 tegn').optional().nullable(),
    responsibleId: z.string().uuid('Ugyldigt bruger-ID').optional().nullable(),
    dueDate: z.string().datetime().optional().nullable(),
    // Tilknytninger — kan tilføjes ved oprettelse
    companyIds: z.array(z.string().uuid()).optional().default([]),
    contractIds: z.array(z.string().uuid()).optional().default([]),
    personIds: z
      .array(
        z.object({
          personId: z.string().uuid(),
          role: z.string().max(100).optional().nullable(),
        })
      )
      .optional()
      .default([]),
  })
  .refine(
    (data) => {
      // caseSubtype påkrævet medmindre caseType = ANDET
      if (data.caseType !== 'ANDET' && !data.caseSubtype) {
        return false
      }
      return true
    },
    {
      message: 'Undertype er påkrævet for denne sagstype',
      path: ['caseSubtype'],
    }
  )
  .refine(
    (data) => {
      // Valider at subtype matcher type
      if (!data.caseSubtype) return true
      if (data.caseType === 'ANDET') return true
      const validSubtypes = VALID_SUBTYPES_FOR_TYPE[data.caseType]
      return validSubtypes.includes(data.caseSubtype)
    },
    {
      message: 'Undertypes matcher ikke den valgte sagstype',
      path: ['caseSubtype'],
    }
  )

export const updateCaseSchema = z
  .object({
    caseId: z.string().uuid('Ugyldigt sags-ID'),
    title: z
      .string()
      .min(1, 'Titel er påkrævet')
      .max(255, 'Titel må maks. være 255 tegn')
      .optional(),
    caseType: z.nativeEnum(SagsType).optional(),
    caseSubtype: z.nativeEnum(SagsSubtype).optional().nullable(),
    sensitivity: z.nativeEnum(SensitivityLevel).optional(),
    description: z.string().max(5000).optional().nullable(),
    responsibleId: z.string().uuid('Ugyldigt bruger-ID').optional().nullable(),
    dueDate: z.string().datetime().optional().nullable(),
  })
  .refine(
    (data) => {
      if (data.caseType && data.caseType !== 'ANDET' && data.caseSubtype === null) {
        return false
      }
      return true
    },
    {
      message: 'Undertype kan ikke fjernes fra denne sagstype',
      path: ['caseSubtype'],
    }
  )

export const updateCaseStatusSchema = z.object({
  caseId: z.string().uuid('Ugyldigt sags-ID'),
  newStatus: z.nativeEnum(CaseStatus, {
    errorMap: () => ({ message: 'Ugyldig sagsstatus' }),
  }),
  note: z.string().max(1000).optional().nullable(),
})

export const deleteCaseSchema = z.object({
  caseId: z.string().uuid('Ugyldigt sags-ID'),
})

export const getCaseSchema = z.object({
  caseId: z.string().uuid('Ugyldigt sags-ID'),
})

export const listCasesSchema = z.object({
  status: z.nativeEnum(CaseStatus).optional(),
  caseType: z.nativeEnum(SagsType).optional(),
  sensitivity: z.nativeEnum(SensitivityLevel).optional(),
  responsibleId: z.string().uuid().optional(),
  companyId: z.string().uuid().optional(),
  search: z.string().max(255).optional(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(25),
  sortBy: z.enum(['createdAt', 'updatedAt', 'dueDate', 'title']).default('updatedAt'),
  sortDir: z.enum(['asc', 'desc']).default('desc'),
})

// ==================== TILKNYTNINGER ====================

export const addCaseCompanySchema = z.object({
  caseId: z.string().uuid('Ugyldigt sags-ID'),
  companyId: z.string().uuid('Ugyldigt selskabs-ID'),
})

export const removeCaseCompanySchema = z.object({
  caseId: z.string().uuid('Ugyldigt sags-ID'),
  companyId: z.string().uuid('Ugyldigt selskabs-ID'),
})

export const addCaseContractSchema = z.object({
  caseId: z.string().uuid('Ugyldigt sags-ID'),
  contractId: z.string().uuid('Ugyldigt kontrakt-ID'),
})

export const removeCaseContractSchema = z.object({
  caseId: z.string().uuid('Ugyldigt sags-ID'),
  contractId: z.string().uuid('Ugyldigt kontrakt-ID'),
})

export const addCasePersonSchema = z.object({
  caseId: z.string().uuid('Ugyldigt sags-ID'),
  personId: z.string().uuid('Ugyldigt person-ID'),
  role: z.string().max(100).optional().nullable(),
})

export const removeCasePersonSchema = z.object({
  caseId: z.string().uuid('Ugyldigt sags-ID'),
  personId: z.string().uuid('Ugyldigt person-ID'),
})

export const updateCasePersonRoleSchema = z.object({
  caseId: z.string().uuid('Ugyldigt sags-ID'),
  personId: z.string().uuid('Ugyldigt person-ID'),
  role: z.string().max(100).optional().nullable(),
})

// ==================== OPGAVER ====================

export const createTaskSchema = z.object({
  caseId: z.string().uuid('Ugyldigt sags-ID'),
  title: z.string().min(1, 'Titel er påkrævet').max(255, 'Titel må maks. være 255 tegn'),
  description: z.string().max(5000).optional().nullable(),
  assignedTo: z.string().uuid('Ugyldigt bruger-ID').optional().nullable(),
  dueDate: z.string().datetime().optional().nullable(),
})

export const updateTaskSchema = z.object({
  taskId: z.string().uuid('Ugyldigt opgave-ID'),
  caseId: z.string().uuid('Ugyldigt sags-ID'),
  title: z.string().min(1).max(255).optional(),
  description: z.string().max(5000).optional().nullable(),
  status: z.nativeEnum(TaskStatus).optional(),
  assignedTo: z.string().uuid().optional().nullable(),
  dueDate: z.string().datetime().optional().nullable(),
})

export const deleteTaskSchema = z.object({
  taskId: z.string().uuid('Ugyldigt opgave-ID'),
  caseId: z.string().uuid('Ugyldigt sags-ID'),
})

export const listTasksSchema = z.object({
  caseId: z.string().uuid('Ugyldigt sags-ID'),
  status: z.nativeEnum(TaskStatus).optional(),
  assignedTo: z.string().uuid().optional(),
})

// ==================== FRISTER ====================

export const createDeadlineSchema = z.object({
  caseId: z.string().uuid('Ugyldigt sags-ID'),
  title: z.string().min(1, 'Titel er påkrævet').max(255, 'Titel må maks. være 255 tegn'),
  dueDate: z.string().datetime('Ugyldig fristdato'),
  priority: z.nativeEnum(Prioritet, {
    errorMap: () => ({ message: 'Ugyldig prioritet' }),
  }),
  assignedTo: z.string().uuid('Ugyldigt bruger-ID').optional().nullable(),
  note: z.string().max(2000).optional().nullable(),
  adviseDaysBefore: z.number().int().min(0).max(365).default(3),
})

export const updateDeadlineSchema = z.object({
  deadlineId: z.string().uuid('Ugyldigt frist-ID'),
  caseId: z.string().uuid('Ugyldigt sags-ID'),
  title: z.string().min(1).max(255).optional(),
  dueDate: z.string().datetime().optional(),
  priority: z.nativeEnum(Prioritet).optional(),
  assignedTo: z.string().uuid().optional().nullable(),
  note: z.string().max(2000).optional().nullable(),
  adviseDaysBefore: z.number().int().min(0).max(365).optional(),
  completedAt: z.string().datetime().optional().nullable(),
})

export const deleteDeadlineSchema = z.object({
  deadlineId: z.string().uuid('Ugyldigt frist-ID'),
  caseId: z.string().uuid('Ugyldigt sags-ID'),
})

export const listDeadlinesSchema = z.object({
  caseId: z.string().uuid('Ugyldigt sags-ID'),
  includeCompleted: z.boolean().default(false),
})

// ==================== TIDSREGISTRERING ====================

export const createTimeEntrySchema = z.object({
  caseId: z.string().uuid('Ugyldigt sags-ID'),
  description: z.string().max(500).optional().nullable(),
  minutes: z.number().int().min(1, 'Minimum 1 minut').max(1440, 'Maksimum 24 timer'),
  date: z.string().datetime('Ugyldig dato'),
  billable: z.boolean().default(true),
  hourlyRate: z.number().int().min(0).optional().nullable(),
})

export const listTimeEntriesSchema = z.object({
  caseId: z.string().uuid('Ugyldigt sags-ID'),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(25),
})