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

// Alle 34 system types fra CONTRACT-TYPES.md
export const contractSystemTypeSchema = z.nativeEnum(ContractSystemType)

export const contractStatusSchema = z.nativeEnum(ContractStatus)

export const sensitivityLevelSchema = z.nativeEnum(SensitivityLevel)

export const deadlineTypeSchema = z.nativeEnum(DeadlineType)

export const versionSourceSchema = z.nativeEnum(VersionSource)

export const changeTypeSchema = z.nativeEnum(ChangeType)

export const relationTypeSchema = z.nativeEnum(RelationType)

// Minimum sensitivity pr. kontrakttype (fra CONTRACT-TYPES.md)
export const MINIMUM_SENSITIVITY: Record<ContractSystemType, SensitivityLevel> = {
  // STRENGT_FORTROLIG minimum
  EJERAFTALE: 'STRENGT_FORTROLIG',
  DIREKTOERKONTRAKT: 'STRENGT_FORTROLIG',
  OVERDRAGELSESAFTALE: 'STRENGT_FORTROLIG',
  AKTIONERLAN: 'STRENGT_FORTROLIG',
  PANTSAETNING: 'STRENGT_FORTROLIG',
  VOA: 'STRENGT_FORTROLIG',
  INTERN_SERVICEAFTALE: 'STRENGT_FORTROLIG',
  ROYALTY_LICENS: 'STRENGT_FORTROLIG',
  OPTIONSAFTALE: 'STRENGT_FORTROLIG',
  TILTRAEDELSESDOKUMENT: 'STRENGT_FORTROLIG',
  CASH_POOL: 'STRENGT_FORTROLIG',
  INTERCOMPANY_LAN: 'STRENGT_FORTROLIG',
  SELSKABSGARANTI: 'STRENGT_FORTROLIG',
  
  // FORTROLIG minimum
  ANSAETTELSE_FUNKTIONAER: 'FORTROLIG',
  ANSAETTELSE_IKKE_FUNKTIONAER: 'FORTROLIG',
  SAMARBEJDSAFTALE: 'FORTROLIG',
  NDA: 'FORTROLIG',
  GF_REFERAT: 'FORTROLIG',
  BESTYRELSESREFERAT: 'FORTROLIG',
  FORRETNINGSORDEN: 'FORTROLIG',
  DIREKTIONSINSTRUKS: 'FORTROLIG',
  FRATRAEDELSESAFTALE: 'FORTROLIG',
  KONKURRENCEKLAUSUL: 'FORTROLIG',
  KASSEKREDIT: 'FORTROLIG',
  
  // INTERN minimum
  LEJEKONTRAKT_ERHVERV: 'INTERN',
  LEASINGAFTALE: 'INTERN',
  LEVERANDOERKONTRAKT: 'INTERN',
  IT_SYSTEMAFTALE: 'INTERN',
  DBA: 'INTERN',
  VEDTAEGTER: 'INTERN',
  FORSIKRING: 'INTERN',
  PERSONALEHÅNDBOG: 'INTERN',
  
  // STANDARD minimum
  VIKARAFTALE: 'STANDARD',
  UDDANNELSESAFTALE: 'STANDARD',
}

// Sensitivitets-hierarki for sammenligning
const SENSITIVITY_ORDER: SensitivityLevel[] = [
  'PUBLIC',
  'STANDARD',
  'INTERN',
  'FORTROLIG',
  'STRENGT_FORTROLIG',
]

export function getSensitivityIndex(level: SensitivityLevel): number {
  return SENSITIVITY_ORDER.indexOf(level)
}

export function meetsMinimumSensitivity(
  provided: SensitivityLevel,
  minimum: SensitivityLevel
): boolean {
  return getSensitivityIndex(provided) >= getSensitivityIndex(minimum)
}

export function getMinSensitivity(systemType: ContractSystemType): SensitivityLevel {
  return MINIMUM_SENSITIVITY[systemType]
}

// Gyldige status-transitioner (fra CONTRACT-TYPES.md)
export const VALID_STATUS_TRANSITIONS: Record<ContractStatus, ContractStatus[]> = {
  UDKAST: ['TIL_REVIEW'],
  TIL_REVIEW: ['UDKAST', 'TIL_UNDERSKRIFT'],
  TIL_UNDERSKRIFT: ['TIL_REVIEW', 'AKTIV'],
  AKTIV: ['UDLOEBET', 'OPSAGT', 'FORNYET', 'ARKIVERET'],
  UDLOEBET: ['ARKIVERET'],
  OPSAGT: ['ARKIVERET'],
  FORNYET: ['AKTIV', 'ARKIVERET'],
  ARKIVERET: [],
}

export function isValidStatusTransition(
  from: ContractStatus,
  to: ContractStatus
): boolean {
  return VALID_STATUS_TRANSITIONS[from].includes(to)
}

// Create contract schema
export const createContractSchema = z.object({
  companyId: z.string().uuid('Ugyldigt selskabs-ID'),
  systemType: contractSystemTypeSchema,
  displayName: z.string().min(1, 'Navn er påkrævet').max(255, 'Navn må maks være 255 tegn'),
  sensitivity: sensitivityLevelSchema.optional(),
  deadlineType: deadlineTypeSchema.optional(),
  versionSource: versionSourceSchema.optional(),
  collectiveAgreement: z.string().max(255).optional().nullable(),
  parentContractId: z.string().uuid().optional().nullable(),
  triggeredById: z.string().uuid().optional().nullable(),
  
  // Datoer
  effectiveDate: z.coerce.date().optional().nullable(),
  expiryDate: z.coerce.date().optional().nullable(),
  signedDate: z.coerce.date().optional().nullable(),
  noticePeriodDays: z.number().int().min(0).optional().nullable(),
  terminationDate: z.coerce.date().optional().nullable(),
  anciennityStart: z.coerce.date().optional().nullable(),
  
  // Advisering
  reminder90Days: z.boolean().optional(),
  reminder30Days: z.boolean().optional(),
  reminder7Days: z.boolean().optional(),
  reminderRecipients: z.array(z.string().uuid()).optional(),
  
  // Opbevaring
  mustRetainUntil: z.coerce.date().optional().nullable(),
  
  // Type-specifik data
  typeData: z.record(z.any()).optional().nullable(),
  
  notes: z.string().max(5000).optional().nullable(),
})

export type CreateContractInput = z.infer<typeof createContractSchema>

// Update contract schema
export const updateContractSchema = z.object({
  id: z.string().uuid('Ugyldigt kontrakt-ID'),
  displayName: z.string().min(1).max(255).optional(),
  sensitivity: sensitivityLevelSchema.optional(),
  deadlineType: deadlineTypeSchema.optional(),
  versionSource: versionSourceSchema.optional(),
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
  typeData: z.record(z.any()).optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
})

export type UpdateContractInput = z.infer<typeof updateContractSchema>

// Update status schema
export const updateContractStatusSchema = z.object({
  id: z.string().uuid('Ugyldigt kontrakt-ID'),
  status: contractStatusSchema,
})

export type UpdateContractStatusInput = z.infer<typeof updateContractStatusSchema>

// Contract party schemas
export const createContractPartySchema = z.object({
  contractId: z.string().uuid('Ugyldigt kontrakt-ID'),
  personId: z.string().uuid().optional().nullable(),
  isSigner: z.boolean().optional(),
  counterpartyName: z.string().max(255).optional().nullable(),
  roleInContract: z.string().max(100).optional().nullable(),
})

export type CreateContractPartyInput = z.infer<typeof createContractPartySchema>

export const updateContractPartySchema = z.object({
  id: z.string().uuid('Ugyldigt part-ID'),
  isSigner: z.boolean().optional(),
  counterpartyName: z.string().max(255).optional().nullable(),
  roleInContract: z.string().max(100).optional().nullable(),
})

export type UpdateContractPartyInput = z.infer<typeof updateContractPartySchema>

// Contract version schemas
export const createContractVersionSchema = z.object({
  contractId: z.string().uuid('Ugyldigt kontrakt-ID'),
  fileUrl: z.string().url('Ugyldig fil-URL'),
  fileName: z.string().min(1, 'Filnavn er påkrævet').max(255),
  fileSizeBytes: z.number().int().min(0),
  changeType: changeTypeSchema.optional(),
  changeNote: z.string().max(1000).optional().nullable(),
  amendsClause: z.string().max(255).optional().nullable(),
  isCurrent: z.boolean().optional(),
})

export type CreateContractVersionInput = z.infer<typeof createContractVersionSchema>

// Contract attachment schemas
export const createContractAttachmentSchema = z.object({
  contractId: z.string().uuid('Ugyldigt kontrakt-ID'),
  fileUrl: z.string().url('Ugyldig fil-URL'),
  fileName: z.string().min(1, 'Filnavn er påkrævet').max(255),
  fileSizeBytes: z.number().int().min(0),
  description: z.string().max(500).optional().nullable(),
})

export type CreateContractAttachmentInput = z.infer<typeof createContractAttachmentSchema>

// Contract relation schemas
export const createContractRelationSchema = z.object({
  fromContractId: z.string().uuid('Ugyldigt fra-kontrakt-ID'),
  toContractId: z.string().uuid('Ugyldigt til-kontrakt-ID'),
  relationType: relationTypeSchema,
})

export type CreateContractRelationInput = z.infer<typeof createContractRelationSchema>

// List contracts filter schema
export const listContractsFilterSchema = z.object({
  companyId: z.string().uuid().optional(),
  systemType: contractSystemTypeSchema.optional(),
  status: contractStatusSchema.optional(),
  sensitivity: sensitivityLevelSchema.optional(),
  search: z.string().max(100).optional(),
  limit: z.number().int().min(1).max(100).optional(),
  offset: z.number().int().min(0).optional(),
})

export type ListContractsFilter = z.infer<typeof listContractsFilterSchema>