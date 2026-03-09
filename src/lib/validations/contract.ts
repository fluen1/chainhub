import { z } from 'zod'

// ==================== ENUM DEFINITIONS ====================
// Vi definerer enum-værdierne som string literals for at undgå
// direkte afhængighed af Prisma-genererede navne med special chars

export const ContractSystemTypeValues = [
  // Lag 1 — Universelle
  'EJERAFTALE',
  'DIREKTØRKONTRAKT',
  'OVERDRAGELSESAFTALE',
  'AKTIONÆRLÅN',
  'PANTSÆTNING',
  'VEDTÆGTER',
  'ANSÆTTELSE_FUNKTIONÆR',
  'ANSÆTTELSE_IKKE_FUNKTIONÆR',
  'VIKARAFTALE',
  'UDDANNELSESAFTALE',
  'FRATRÆDELSESAFTALE',
  'KONKURRENCEKLAUSUL',
  'PERSONALEHÅNDBOG',
  'LEJEKONTRAKT_ERHVERV',
  'LEASINGAFTALE',
  'LEVERANDØRKONTRAKT',
  'SAMARBEJDSAFTALE',
  'NDA',
  'IT_SYSTEMAFTALE',
  'DBA',
  'FORSIKRING',
  'GF_REFERAT',
  'BESTYRELSESREFERAT',
  'FORRETNINGSORDEN',
  'DIREKTIONSINSTRUKS',
  'VOA',
  // Lag 2 — Strukturtyper
  'INTERN_SERVICEAFTALE',
  'ROYALTY_LICENS',
  'OPTIONSAFTALE',
  'TILTRÆDELSESDOKUMENT',
  'KASSEKREDIT',
  'CASH_POOL',
  'INTERCOMPANY_LÅN',
  'SELSKABSGARANTI',
] as const

export type ContractSystemType = (typeof ContractSystemTypeValues)[number]

export const ContractStatusValues = [
  'UDKAST',
  'TIL_REVIEW',
  'TIL_UNDERSKRIFT',
  'AKTIV',
  'UDLØBET',
  'OPSAGT',
  'FORNYET',
  'ARKIVERET',
] as const

export type ContractStatus = (typeof ContractStatusValues)[number]

export const SensitivityLevelValues = [
  'PUBLIC',
  'STANDARD',
  'INTERN',
  'FORTROLIG',
  'STRENGT_FORTROLIG',
] as const

export type SensitivityLevel = (typeof SensitivityLevelValues)[number]

export const DeadlineTypeValues = ['ABSOLUT', 'OPERATIONEL', 'INGEN'] as const
export type DeadlineType = (typeof DeadlineTypeValues)[number]

export const VersionSourceValues = [
  'BRANCHESTANDARD',
  'INTERNT',
  'EKSTERNT_STANDARD',
  'CUSTOM',
] as const
export type VersionSource = (typeof VersionSourceValues)[number]

export const ChangeTypeValues = ['NY', 'REVISION', 'ALLONGE', 'OPSIGELSE'] as const
export type ChangeType = (typeof ChangeTypeValues)[number]

export const RelationTypeValues = [
  'UDLOESES_AF',
  'ERSTATTES_AF',
  'TILLÆG_TIL',
  'RELATERET_TIL',
] as const
export type RelationType = (typeof RelationTypeValues)[number]

// ==================== STATUS-FLOW ====================

export const VALID_STATUS_TRANSITIONS: Record<ContractStatus, ContractStatus[]> = {
  UDKAST: ['TIL_REVIEW'],
  TIL_REVIEW: ['TIL_UNDERSKRIFT', 'UDKAST'],
  TIL_UNDERSKRIFT: ['AKTIV', 'TIL_REVIEW'],
  AKTIV: ['UDLØBET', 'OPSAGT', 'FORNYET', 'ARKIVERET'],
  UDLØBET: ['ARKIVERET'],
  OPSAGT: ['ARKIVERET'],
  FORNYET: ['AKTIV', 'ARKIVERET'],
  ARKIVERET: [],
}

export function isValidStatusTransition(
  from: ContractStatus,
  to: ContractStatus
): boolean {
  const allowed = VALID_STATUS_TRANSITIONS[from]
  return allowed.includes(to)
}

// ==================== SENSITIVITY MINIMUM ====================

const SENSITIVITY_ORDER: SensitivityLevel[] = [
  'PUBLIC',
  'STANDARD',
  'INTERN',
  'FORTROLIG',
  'STRENGT_FORTROLIG',
]

export const SENSITIVITY_MINIMUM: Record<ContractSystemType, SensitivityLevel> = {
  // STRENGT_FORTROLIG
  EJERAFTALE: 'STRENGT_FORTROLIG',
  DIREKTØRKONTRAKT: 'STRENGT_FORTROLIG',
  OVERDRAGELSESAFTALE: 'STRENGT_FORTROLIG',
  AKTIONÆRLÅN: 'STRENGT_FORTROLIG',
  PANTSÆTNING: 'STRENGT_FORTROLIG',
  VOA: 'STRENGT_FORTROLIG',
  INTERN_SERVICEAFTALE: 'STRENGT_FORTROLIG',
  ROYALTY_LICENS: 'STRENGT_FORTROLIG',
  OPTIONSAFTALE: 'STRENGT_FORTROLIG',
  TILTRÆDELSESDOKUMENT: 'STRENGT_FORTROLIG',
  CASH_POOL: 'STRENGT_FORTROLIG',
  'INTERCOMPANY_LÅN': 'STRENGT_FORTROLIG',
  SELSKABSGARANTI: 'STRENGT_FORTROLIG',

  // FORTROLIG
  'ANSÆTTELSE_FUNKTIONÆR': 'FORTROLIG',
  'ANSÆTTELSE_IKKE_FUNKTIONÆR': 'FORTROLIG',
  SAMARBEJDSAFTALE: 'FORTROLIG',
  NDA: 'FORTROLIG',
  GF_REFERAT: 'FORTROLIG',
  BESTYRELSESREFERAT: 'FORTROLIG',
  FORRETNINGSORDEN: 'FORTROLIG',
  DIREKTIONSINSTRUKS: 'FORTROLIG',
  'FRATRÆDELSESAFTALE': 'FORTROLIG',
  KONKURRENCEKLAUSUL: 'FORTROLIG',
  KASSEKREDIT: 'FORTROLIG',

  // INTERN
  LEJEKONTRAKT_ERHVERV: 'INTERN',
  LEASINGAFTALE: 'INTERN',
  'LEVERANDØRKONTRAKT': 'INTERN',
  IT_SYSTEMAFTALE: 'INTERN',
  DBA: 'INTERN',
  'VEDTÆGTER': 'INTERN',
  FORSIKRING: 'INTERN',
  'PERSONALEHÅNDBOG': 'INTERN',

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
  'TILTRÆDELSESDOKUMENT',
  'KASSEKREDIT',
  'CASH_POOL',
  'INTERCOMPANY_LÅN',
  'SELSKABSGARANTI',
]

export function isLag2Type(systemType: ContractSystemType): boolean {
  return LAG2_TYPES.includes(systemType)
}

// ==================== ZOD SCHEMAS ====================

export const createContractSchema = z.object({
  companyId: z.string().uuid('Ugyldigt selskab-ID'),
  systemType: z.enum(ContractSystemTypeValues),
  displayName: z.string().min(1, 'Navn er påkrævet').max(255),
  sensitivity: z.enum(SensitivityLevelValues),
  deadlineType: z.enum(DeadlineTypeValues),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  signedDate: z.string().optional(),
  terminationDate: z.string().optional(),
  terminationNoticeDays: z.number().int().min(0).optional(),
  mustRetainUntil: z.string().optional(),
  autoRetain: z.boolean().optional(),
  parentContractId: z.string().uuid().optional(),
  triggeredById: z.string().uuid().optional(),
  versionSource: z.enum(VersionSourceValues).optional(),
  notes: z.string().optional(),
  counterpartyName: z.string().optional(),
  counterpartyOrgNumber: z.string().optional(),
  counterpartyContactName: z.string().optional(),
  counterpartyContactEmail: z.string().email().optional().or(z.literal('')),
})

export const updateContractSchema = z.object({
  contractId: z.string().uuid('Ugyldigt kontrakt-ID'),
  displayName: z.string().min(1).max(255).optional(),
  sensitivity: z.enum(SensitivityLevelValues).optional(),
  deadlineType: z.enum(DeadlineTypeValues).optional(),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  signedDate: z.string().optional().nullable(),
  terminationDate: z.string().optional().nullable(),
  terminationNoticeDays: z.number().int().min(0).optional().nullable(),
  mustRetainUntil: z.string().optional().nullable(),
  autoRetain: z.boolean().optional(),
  notes: z.string().optional().nullable(),
  counterpartyName: z.string().optional().nullable(),
  counterpartyOrgNumber: z.string().optional().nullable(),
  counterpartyContactName: z.string().optional().nullable(),
  counterpartyContactEmail: z.string().email().optional().nullable().or(z.literal('')),
})

export const updateContractStatusSchema = z.object({
  contractId: z.string().uuid('Ugyldigt kontrakt-ID'),
  newStatus: z.enum(ContractStatusValues),
  note: z.string().optional(),
})

export const addContractPartySchema = z.object({
  contractId: z.string().uuid(),
  personId: z.string().uuid().optional(),
  isSigner: z.boolean().default(false),
  counterpartyName: z.string().optional(),
  roleInContract: z.string().optional(),
})

export const removeContractPartySchema = z.object({
  partyId: z.string().uuid(),
})

export const addContractRelationSchema = z.object({
  fromContractId: z.string().uuid(),
  toContractId: z.string().uuid(),
  relationType: z.enum(RelationTypeValues),
})

export const removeContractRelationSchema = z.object({
  relationId: z.string().uuid(),
})

export const listContractsSchema = z.object({
  companyId: z.string().uuid().optional(),
  status: z.enum(ContractStatusValues).optional(),
  systemType: z.enum(ContractSystemTypeValues).optional(),
  sensitivity: z.enum(SensitivityLevelValues).optional(),
  search: z.string().optional(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
})

export const getContractSchema = z.object({
  contractId: z.string().uuid(),
})

export const deleteContractSchema = z.object({
  contractId: z.string().uuid(),
})

export const requestUploadUrlSchema = z.object({
  contractId: z.string().uuid(),
  fileName: z.string().min(1),
  fileSizeBytes: z.number().int().min(1),
  mimeType: z.string(),
  uploadPurpose: z.enum(['version', 'attachment']),
  changeType: z.enum(ChangeTypeValues).optional(),
  changeNote: z.string().optional(),
  amendsClause: z.string().optional(),
  versionNumber: z.number().int().min(1).optional(),
})

export const confirmVersionUploadSchema = z.object({
  contractId: z.string().uuid(),
  fileKey: z.string().min(1),
  fileName: z.string().min(1),
  fileSizeBytes: z.number().int().min(1),
  changeType: z.enum(ChangeTypeValues),
  changeNote: z.string().optional(),
  amendsClause: z.string().optional(),
  versionNumber: z.number().int().min(1),
})

export const confirmAttachmentUploadSchema = z.object({
  contractId: z.string().uuid(),
  fileKey: z.string().min(1),
  fileName: z.string().min(1),
  fileSizeBytes: z.number().int().min(1),
  mimeType: z.string().optional(),
  description: z.string().optional(),
})

export const deleteAttachmentSchema = z.object({
  attachmentId: z.string().uuid(),
})

export const deleteVersionSchema = z.object({
  versionId: z.string().uuid(),
})