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

// ==================== STATUS-FLOW ====================

// Gyldige status-transitioner jf. spec
export const VALID_STATUS_TRANSITIONS: Record<ContractStatus, ContractStatus[]> = {
  UDKAST: ['TIL_REVIEW'],
  TIL_REVIEW: ['TIL_UNDERSKRIFT', 'UDKAST'], // kan sendes tilbage
  TIL_UNDERSKRIFT: ['AKTIV', 'TIL_REVIEW'],   // kan sendes tilbage
  AKTIV: ['UDLOEBET', 'OPSAGT', 'FORNYET', 'ARKIVERET'],
  UDLOEBET: ['ARKIVERET'],
  OPSAGT: ['ARKIVERET'],
  FORNYET: ['AKTIV', 'ARKIVERET'],
  ARKIVERET: [], // terminal state
}

export function isValidStatusTransition(
  from: ContractStatus,
  to: ContractStatus
): boolean {
  const allowed = VALID_STATUS_TRANSITIONS[from]
  return allowed.includes(to)
}

// ==================== SENSITIVITY MINIMUM ====================

// Sensitivity-hierarki (lavest til højest)
const SENSITIVITY_ORDER: SensitivityLevel[] = [
  'PUBLIC',
  'STANDARD',
  'INTERN',
  'FORTROLIG',
  'STRENGT_FORTROLIG',
]

// Minimum sensitivitet per system_type jf. CONTRACT-TYPES.md
export const SENSITIVITY_MINIMUM: Record<ContractSystemType, SensitivityLevel> = {
  // STRENGT_FORTROLIG
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

  // FORTROLIG
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

  // INTERN
  LEJEKONTRAKT_ERHVERV: 'INTERN',
  LEASINGAFTALE: 'INTERN',
  LEVERANDOERKONTRAKT: 'INTERN',
  IT_SYSTEMAFTALE: 'INTERN',
  DBA: 'INTERN',
  VEDTAEGTER: 'INTERN',
  FORSIKRING: 'INTERN',
  PERSONALEHÅNDBOG: 'INTERN',

  // STANDARD
  VIKARAFTALE: 'STANDARD',
  UDDANNELSESAFTALE: 'STANDARD',
}

export function getMinSensitivity(systemType: ContractSystemType): SensitivityLevel {
  return SENSITIVITY_MINIMUM[systemType] ?? 'STANDARD'
}

export function meetsMinimumSensitivity(
  provided: SensitivityLevel,
  minimum: SensitivityLevel
): boolean {
  const providedIndex = SENSITIVITY_ORDER.indexOf(provided)
  const minimumIndex = SENSITIVITY_ORDER.indexOf(minimum)
  return providedIndex >= minimumIndex
}

// ==================== LAG 2 TYPER ====================

const LAG2_TYPES: ContractSystemType[] = [
  'INTERN_SERVICEAFTALE',
  'ROYALTY_LICENS',
  'OPTIONSAFTALE',
  'TILTRAEDELSESDOKUMENT',
  'KASSEKREDIT',
  'CASH_POOL',
  'INTERCOMPANY_LAN',
  'SELSKABSGARANTI',
]

export function isLag2Type(systemType: ContractSystemType): boolean {
  return LAG2_TYPES.includes(systemType)
}

// ==================== ZOD SCHEMAS ====================

export const createContractSchema = z.object({
  companyId: z.string().uuid({ message: 'Ugyldigt selskabs-ID' }),
  systemType: z.nativeEnum(ContractSystemType, {
    errorMap: () => ({ message: 'Ugyldig kontrakttype' }),
  }),
  displayName: z
    .string()
    .min(1, 'Navn er påkrævet')
    .max(255, 'Navn må højst være 255 tegn'),
  sensitivity: z.nativeEnum(SensitivityLevel, {
    errorMap: () => ({ message: 'Ugyldigt sensitivitetsniveau' }),
  }),
  deadlineType: z.nativeEnum(DeadlineType).optional().default('INGEN'),
  versionSource: z.nativeEnum(VersionSource).optional().default('CUSTOM'),
  collectiveAgreement: z.string().max(255).optional(),
  parentContractId: z.string().uuid().optional(),
  triggeredById: z.string().uuid().optional(),

  // Datoer
  effectiveDate: z.string().datetime().optional(),
  expiryDate: z.string().datetime().optional(),
  signedDate: z.string().datetime().optional(),
  noticePeriodDays: z.number().int().min(0).max(3650).optional(),
  terminationDate: z.string().datetime().optional(),
  anciennityStart: z.string().datetime().optional(),

  // Advisering
  reminder90Days: z.boolean().optional().default(true),
  reminder30Days: z.boolean().optional().default(true),
  reminder7Days: z.boolean().optional().default(true),
  reminderRecipients: z.array(z.string().uuid()).optional().default([]),

  // Typespecifikke data
  typeData: z.record(z.unknown()).optional(),

  notes: z.string().max(10000).optional(),
})

export const updateContractSchema = z.object({
  contractId: z.string().uuid({ message: 'Ugyldigt kontrakt-ID' }),
  displayName: z.string().min(1).max(255).optional(),
  sensitivity: z.nativeEnum(SensitivityLevel).optional(),
  deadlineType: z.nativeEnum(DeadlineType).optional(),
  versionSource: z.nativeEnum(VersionSource).optional(),
  collectiveAgreement: z.string().max(255).optional(),
  parentContractId: z.string().uuid().nullable().optional(),
  triggeredById: z.string().uuid().nullable().optional(),

  // Datoer
  effectiveDate: z.string().datetime().nullable().optional(),
  expiryDate: z.string().datetime().nullable().optional(),
  signedDate: z.string().datetime().nullable().optional(),
  noticePeriodDays: z.number().int().min(0).max(3650).nullable().optional(),
  terminationDate: z.string().datetime().nullable().optional(),
  anciennityStart: z.string().datetime().nullable().optional(),

  // Advisering
  reminder90Days: z.boolean().optional(),
  reminder30Days: z.boolean().optional(),
  reminder7Days: z.boolean().optional(),
  reminderRecipients: z.array(z.string().uuid()).optional(),

  // Typespecifikke data
  typeData: z.record(z.unknown()).nullable().optional(),

  notes: z.string().max(10000).nullable().optional(),
})

export const updateContractStatusSchema = z.object({
  contractId: z.string().uuid({ message: 'Ugyldigt kontrakt-ID' }),
  newStatus: z.nativeEnum(ContractStatus, {
    errorMap: () => ({ message: 'Ugyldig status' }),
  }),
  note: z.string().max(1000).optional(),
})

export const addContractPartySchema = z.object({
  contractId: z.string().uuid(),
  personId: z.string().uuid().optional(),
  isSigner: z.boolean().optional().default(false),
  counterpartyName: z.string().max(255).optional(),
  roleInContract: z.string().max(100).optional(),
})
  .refine(
    (data) => data.personId || data.counterpartyName,
    { message: 'Enten person eller modpartsnavn skal angives' }
  )

export const removeContractPartySchema = z.object({
  contractId: z.string().uuid(),
  partyId: z.string().uuid(),
})

export const addContractRelationSchema = z.object({
  fromContractId: z.string().uuid(),
  toContractId: z.string().uuid(),
  relationType: z.nativeEnum(RelationType, {
    errorMap: () => ({ message: 'Ugyldig relationstype' }),
  }),
})

export const removeContractRelationSchema = z.object({
  relationId: z.string().uuid(),
})

export const listContractsSchema = z.object({
  companyId: z.string().uuid().optional(),
  status: z.nativeEnum(ContractStatus).optional(),
  systemType: z.nativeEnum(ContractSystemType).optional(),
  sensitivity: z.nativeEnum(SensitivityLevel).optional(),
  search: z.string().max(255).optional(),
  page: z.number().int().min(1).optional().default(1),
  pageSize: z.number().int().min(1).max(100).optional().default(20),
})

export const getContractSchema = z.object({
  contractId: z.string().uuid({ message: 'Ugyldigt kontrakt-ID' }),
})

export const deleteContractSchema = z.object({
  contractId: z.string().uuid({ message: 'Ugyldigt kontrakt-ID' }),
})

export const requestUploadUrlSchema = z.object({
  contractId: z.string().uuid(),
  fileName: z.string().min(1).max(255),
  fileType: z.string().min(1).max(100),
  fileSizeBytes: z.number().int().min(1).max(104857600), // max 100 MB
  uploadPurpose: z.enum(['version', 'attachment']),
})

export const confirmVersionUploadSchema = z.object({
  contractId: z.string().uuid(),
  fileKey: z.string().min(1),
  fileName: z.string().min(1).max(255),
  fileSizeBytes: z.number().int().min(1),
  changeType: z.nativeEnum(ChangeType).default('REDAKTIONEL'),
  changeNote: z.string().max(1000).optional(),
  amendsClause: z.string().max(500).optional(),
})

export const confirmAttachmentUploadSchema = z.object({
  contractId: z.string().uuid(),
  fileKey: z.string().min(1),
  fileName: z.string().min(1).max(255),
  fileSizeBytes: z.number().int().min(1),
  description: z.string().max(1000).optional(),
})

export const deleteAttachmentSchema = z.object({
  contractId: z.string().uuid(),
  attachmentId: z.string().uuid(),
})

export const deleteVersionSchema = z.object({
  contractId: z.string().uuid(),
  versionId: z.string().uuid(),
})