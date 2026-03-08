import { z } from 'zod'
import { 
  ContractSystemType, 
  ContractStatus, 
  SensitivityLevel, 
  DeadlineType, 
  VersionSource,
  ChangeType,
  RelationType,
} from '@prisma/client'

// ==================== SYSTEM TYPE CONFIG ====================

// Minimum sensitivity per kontrakttype
const SYSTEM_TYPE_MIN_SENSITIVITY: Record<ContractSystemType, SensitivityLevel> = {
  EJERAFTALE: 'STRENGT_FORTROLIG',
  DIREKTOERKONTRAKT: 'STRENGT_FORTROLIG',
  OVERDRAGELSESAFTALE: 'FORTROLIG',
  AKTIONERLAN: 'FORTROLIG',
  PANTSAETNING: 'FORTROLIG',
  VEDTAEGTER: 'INTERN',
  ANSAETTELSE_FUNKTIONAER: 'FORTROLIG',
  ANSAETTELSE_IKKE_FUNKTIONAER: 'FORTROLIG',
  VIKARAFTALE: 'INTERN',
  UDDANNELSESAFTALE: 'INTERN',
  FRATRAEDELSESAFTALE: 'FORTROLIG',
  KONKURRENCEKLAUSUL: 'FORTROLIG',
  PERSONALEHÅNDBOG: 'INTERN',
  LEJEKONTRAKT_ERHVERV: 'INTERN',
  LEASINGAFTALE: 'INTERN',
  LEVERANDOERKONTRAKT: 'STANDARD',
  SAMARBEJDSAFTALE: 'INTERN',
  NDA: 'FORTROLIG',
  IT_SYSTEMAFTALE: 'INTERN',
  DBA: 'FORTROLIG',
  FORSIKRING: 'INTERN',
  GF_REFERAT: 'INTERN',
  BESTYRELSESREFERAT: 'FORTROLIG',
  FORRETNINGSORDEN: 'INTERN',
  DIREKTIONSINSTRUKS: 'FORTROLIG',
  VOA: 'FORTROLIG',
  INTERN_SERVICEAFTALE: 'FORTROLIG',
  ROYALTY_LICENS: 'FORTROLIG',
  OPTIONSAFTALE: 'STRENGT_FORTROLIG',
  TILTRAEDELSESDOKUMENT: 'STRENGT_FORTROLIG',
  KASSEKREDIT: 'FORTROLIG',
  CASH_POOL: 'FORTROLIG',
  INTERCOMPANY_LAN: 'FORTROLIG',
  SELSKABSGARANTI: 'FORTROLIG',
}

// Sensitivity rangering (højere index = mere restriktiv)
const SENSITIVITY_ORDER: SensitivityLevel[] = [
  'PUBLIC',
  'STANDARD',
  'INTERN',
  'FORTROLIG',
  'STRENGT_FORTROLIG',
]

export function getMinSensitivity(systemType: ContractSystemType): SensitivityLevel {
  return SYSTEM_TYPE_MIN_SENSITIVITY[systemType] || 'STANDARD'
}

export function meetsMinimumSensitivity(
  provided: SensitivityLevel,
  minimum: SensitivityLevel
): boolean {
  const providedIndex = SENSITIVITY_ORDER.indexOf(provided)
  const minimumIndex = SENSITIVITY_ORDER.indexOf(minimum)
  return providedIndex >= minimumIndex
}

// ==================== STATUS TRANSITIONS ====================

export const VALID_STATUS_TRANSITIONS: Record<ContractStatus, ContractStatus[]> = {
  UDKAST: ['TIL_REVIEW', 'ARKIVERET'],
  TIL_REVIEW: ['UDKAST', 'TIL_UNDERSKRIFT', 'ARKIVERET'],
  TIL_UNDERSKRIFT: ['TIL_REVIEW', 'AKTIV', 'ARKIVERET'],
  AKTIV: ['OPSAGT', 'UDLOEBET', 'FORNYET', 'ARKIVERET'],
  UDLOEBET: ['FORNYET', 'ARKIVERET'],
  OPSAGT: ['ARKIVERET'],
  FORNYET: ['AKTIV', 'OPSAGT', 'ARKIVERET'],
  ARKIVERET: [],
}

export function isValidStatusTransition(
  from: ContractStatus,
  to: ContractStatus
): boolean {
  return VALID_STATUS_TRANSITIONS[from]?.includes(to) || false
}

// ==================== SCHEMAS ====================

export const createContractSchema = z.object({
  companyId: z.string().uuid('Ugyldigt selskabs-ID'),
  systemType: z.nativeEnum(ContractSystemType, {
    errorMap: () => ({ message: 'Ugyldig kontrakttype' }),
  }),
  displayName: z.string()
    .min(1, 'Navn er påkrævet')
    .max(255, 'Navn må ikke overstige 255 tegn'),
  sensitivity: z.nativeEnum(SensitivityLevel).optional(),
  deadlineType: z.nativeEnum(DeadlineType).optional(),
  versionSource: z.nativeEnum(VersionSource).optional(),
  collectiveAgreement: z.string().max(255).optional().nullable(),
  parentContractId: z.string().uuid().optional().nullable(),
  triggeredById: z.string().uuid().optional().nullable(),
  effectiveDate: z.coerce.date().optional().nullable(),
  expiryDate: z.coerce.date().optional().nullable(),
  signedDate: z.coerce.date().optional().nullable(),
  noticePeriodDays: z.number().int().min(0).optional().nullable(),
  terminationDate: z.coerce.date().optional().nullable(),
  anciennityStart: z.coerce.date().optional().nullable(),
  reminder90Days: z.boolean().optional(),
  reminder30Days: z.boolean().optional(),
  reminder7Days: z.boolean().optional(),
  reminderRecipients: z.array(z.string().uuid()).optional(),
  mustRetainUntil: z.coerce.date().optional().nullable(),
  typeData: z.record(z.unknown()).optional().nullable(),
  notes: z.string().max(10000).optional().nullable(),
})

export const updateContractSchema = z.object({
  id: z.string().uuid('Ugyldigt kontrakt-ID'),
  displayName: z.string()
    .min(1, 'Navn er påkrævet')
    .max(255, 'Navn må ikke overstige 255 tegn')
    .optional(),
  sensitivity: z.nativeEnum(SensitivityLevel).optional(),
  deadlineType: z.nativeEnum(DeadlineType).optional(),
  versionSource: z.nativeEnum(VersionSource).optional(),
  collectiveAgreement: z.string().max(255).optional().nullable(),
  parentContractId: z.string().uuid().optional().nullable(),
  triggeredById: z.string().uuid().optional().nullable(),
  effectiveDate: z.coerce.date().optional().nullable(),
  expiryDate: z.coerce.date().optional().nullable(),
  signedDate: z.coerce.date().optional().nullable(),
  noticePeriodDays: z.number().int().min(0).optional().nullable(),
  terminationDate: z.coerce.date().optional().nullable(),
  anciennityStart: z.coerce.date().optional().nullable(),
  reminder90Days: z.boolean().optional(),
  reminder30Days: z.boolean().optional(),
  reminder7Days: z.boolean().optional(),
  reminderRecipients: z.array(z.string().uuid()).optional(),
  mustRetainUntil: z.coerce.date().optional().nullable(),
  typeData: z.record(z.unknown()).optional().nullable(),
  notes: z.string().max(10000).optional().nullable(),
})

export const updateContractStatusSchema = z.object({
  id: z.string().uuid('Ugyldigt kontrakt-ID'),
  status: z.nativeEnum(ContractStatus, {
    errorMap: () => ({ message: 'Ugyldig status' }),
  }),
})

export const createContractPartySchema = z.object({
  contractId: z.string().uuid('Ugyldigt kontrakt-ID'),
  personId: z.string().uuid().optional().nullable(),
  isSigner: z.boolean().optional(),
  counterpartyName: z.string().max(255).optional().nullable(),
  roleInContract: z.string().max(100).optional().nullable(),
}).refine(
  data => data.personId || data.counterpartyName,
  { message: 'Enten person eller ekstern modpart skal angives' }
)

export const updateContractPartySchema = z.object({
  id: z.string().uuid('Ugyldigt part-ID'),
  isSigner: z.boolean().optional(),
  counterpartyName: z.string().max(255).optional().nullable(),
  roleInContract: z.string().max(100).optional().nullable(),
})

export const createContractVersionSchema = z.object({
  contractId: z.string().uuid('Ugyldigt kontrakt-ID'),
  fileUrl: z.string().url('Ugyldig fil-URL'),
  fileName: z.string().min(1, 'Filnavn er påkrævet').max(255),
  fileSizeBytes: z.number().int().min(1, 'Filstørrelse skal være positiv'),
  isCurrent: z.boolean().optional(),
  changeType: z.nativeEnum(ChangeType).optional(),
  changeNote: z.string().max(1000).optional().nullable(),
  amendsClause: z.string().max(500).optional().nullable(),
})

export const createContractAttachmentSchema = z.object({
  contractId: z.string().uuid('Ugyldigt kontrakt-ID'),
  fileUrl: z.string().url('Ugyldig fil-URL'),
  fileName: z.string().min(1, 'Filnavn er påkrævet').max(255),
  fileSizeBytes: z.number().int().min(1, 'Filstørrelse skal være positiv'),
  description: z.string().max(1000).optional().nullable(),
})

export const createContractRelationSchema = z.object({
  fromContractId: z.string().uuid('Ugyldigt fra-kontrakt-ID'),
  toContractId: z.string().uuid('Ugyldigt til-kontrakt-ID'),
  relationType: z.nativeEnum(RelationType, {
    errorMap: () => ({ message: 'Ugyldig relationstype' }),
  }),
}).refine(
  data => data.fromContractId !== data.toContractId,
  { message: 'En kontrakt kan ikke relateres til sig selv' }
)

export const listContractsFilterSchema = z.object({
  companyId: z.string().uuid().optional(),
  systemType: z.nativeEnum(ContractSystemType).optional(),
  status: z.nativeEnum(ContractStatus).optional(),
  sensitivity: z.nativeEnum(SensitivityLevel).optional(),
  search: z.string().max(255).optional(),
  limit: z.number().int().min(1).max(100).optional(),
  offset: z.number().int().min(0).optional(),
})

// ==================== TYPE EXPORTS ====================

export type CreateContractInput = z.infer<typeof createContractSchema>
export type UpdateContractInput = z.infer<typeof updateContractSchema>
export type UpdateContractStatusInput = z.infer<typeof updateContractStatusSchema>
export type CreateContractPartyInput = z.infer<typeof createContractPartySchema>
export type UpdateContractPartyInput = z.infer<typeof updateContractPartySchema>
export type CreateContractVersionInput = z.infer<typeof createContractVersionSchema>
export type CreateContractAttachmentInput = z.infer<typeof createContractAttachmentSchema>
export type CreateContractRelationInput = z.infer<typeof createContractRelationSchema>
export type ListContractsFilter = z.infer<typeof listContractsFilterSchema>