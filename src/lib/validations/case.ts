import { z } from 'zod'

export const CASE_TYPE_LABELS: Record<string, string> = {
  TRANSAKTION: 'Transaktion',
  TVIST: 'Tvist',
  COMPLIANCE: 'Compliance',
  KONTRAKT: 'Kontrakt',
  GOVERNANCE: 'Governance',
  ANDET: 'Andet',
}

export const CASE_SUBTYPE_BY_TYPE: Record<string, { value: string; label: string }[]> = {
  TRANSAKTION: [
    { value: 'VIRKSOMHEDSKOB', label: 'Virksomhedskøb' },
    { value: 'VIRKSOMHEDSSALG', label: 'Virksomhedssalg' },
    { value: 'FUSION', label: 'Fusion' },
    { value: 'OMSTRUKTURERING', label: 'Omstrukturering' },
    { value: 'STIFTELSE', label: 'Stiftelse' },
  ],
  TVIST: [
    { value: 'RETSSAG', label: 'Retssag' },
    { value: 'VOLDGIFT', label: 'Voldgift' },
    { value: 'FORHANDLING_MED_MODPART', label: 'Forhandling med modpart' },
    { value: 'INKASSO', label: 'Inkasso' },
  ],
  COMPLIANCE: [
    { value: 'GDPR', label: 'GDPR' },
    { value: 'ARBEJDSMILJOE', label: 'Arbejdsmiljø' },
    { value: 'MYNDIGHEDSPAABUUD', label: 'Myndighedspåbud' },
    { value: 'SKATTEMASSIG', label: 'Skattemæssig' },
  ],
  KONTRAKT: [
    { value: 'FORHANDLING', label: 'Forhandling' },
    { value: 'OPSIGELSE', label: 'Opsigelse' },
    { value: 'FORNYELSE', label: 'Fornyelse' },
    { value: 'MISLIGHOLDELSE', label: 'Misligholdelse' },
  ],
  GOVERNANCE: [
    { value: 'GENERALFORSAMLING', label: 'Generalforsamling' },
    { value: 'BESTYRELSESMOED', label: 'Bestyrelsesmøde' },
    { value: 'VEDTAEGTSAENDRING', label: 'Vedtægtsændring' },
    { value: 'DIREKTOERSKIFTE', label: 'Direktørskifte' },
  ],
  ANDET: [],
}

export const PRIORITY_LABELS: Record<string, string> = {
  LAV: 'Lav',
  MELLEM: 'Mellem',
  HOEJ: 'Høj',
  KRITISK: 'Kritisk',
}

export const PRIORITY_STYLES: Record<string, string> = {
  LAV: 'bg-gray-100 text-gray-600',
  MELLEM: 'bg-blue-50 text-blue-700',
  HOEJ: 'bg-orange-50 text-orange-700',
  KRITISK: 'bg-red-100 text-red-700',
}

export const createCaseSchema = z.object({
  title: z.string().min(1, 'Titel er påkrævet').max(255),
  caseType: z.string().min(1, 'Sagstype er påkrævet'),
  caseSubtype: z.string().optional(),
  companyIds: z.array(z.string().min(1)).min(1, 'Mindst ét selskab skal angives'),
  assignedTo: z.string().min(1).optional(),
  sensitivity: z.enum(['PUBLIC', 'STANDARD', 'INTERN', 'FORTROLIG', 'STRENGT_FORTROLIG']).default('INTERN'),
  description: z.string().optional(),
  notes: z.string().optional(),
})

export const updateCaseStatusSchema = z.object({
  caseId: z.string().min(1),
  status: z.enum(['NY', 'AKTIV', 'AFVENTER_EKSTERN', 'AFVENTER_KLIENT', 'LUKKET', 'ARKIVERET']),
})

export const createTaskSchema = z.object({
  title: z.string().min(1, 'Titel er påkrævet').max(255),
  description: z.string().optional(),
  assignedTo: z.string().min(1).optional(),
  dueDate: z.string().optional(),
  priority: z.enum(['LAV', 'MELLEM', 'HOEJ', 'KRITISK']).default('MELLEM'),
  caseId: z.string().min(1).optional(),
  companyId: z.string().min(1).optional(),
})

export const updateTaskStatusSchema = z.object({
  taskId: z.string().min(1),
  status: z.enum(['NY', 'AKTIV_TASK', 'AFVENTER', 'LUKKET']),
})

export const updateTaskPrioritySchema = z.object({
  taskId: z.string().min(1),
  priority: z.enum(['LAV', 'MELLEM', 'HOEJ', 'KRITISK']),
})

export const updateTaskAssigneeSchema = z.object({
  taskId: z.string().min(1),
  assignedTo: z.string().min(1).nullable(),
})

export const updateTaskDueDateSchema = z.object({
  taskId: z.string().min(1),
  dueDate: z.string().nullable(),
})

export type CreateCaseInput = z.infer<typeof createCaseSchema>
export type UpdateCaseStatusInput = z.infer<typeof updateCaseStatusSchema>
export type CreateTaskInput = z.infer<typeof createTaskSchema>
export type UpdateTaskStatusInput = z.infer<typeof updateTaskStatusSchema>
export type UpdateTaskPriorityInput = z.infer<typeof updateTaskPrioritySchema>
export type UpdateTaskAssigneeInput = z.infer<typeof updateTaskAssigneeSchema>
export type UpdateTaskDueDateInput = z.infer<typeof updateTaskDueDateSchema>
