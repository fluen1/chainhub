import type {
  Contract,
  ContractParty,
  ContractVersion,
  ContractAttachment,
  ContractRelation,
  ContractSystemType,
  ContractStatus,
  SensitivityLevel,
  DeadlineType,
  VersionSource,
  ChangeType,
  RelationType,
  Person,
  Company,
} from '@prisma/client'

// Fælles return type for alle actions
export type ActionResult<T> =
  | { data: T; error?: never }
  | { error: string; data?: never }

// Kontrakt med relationer
export type ContractWithRelations = Contract & {
  company: Company
  parties: (ContractParty & {
    person: Person | null
  })[]
  versions: ContractVersion[]
  attachments: ContractAttachment[]
  relationsFrom: (ContractRelation & {
    toContract: Contract
  })[]
  relationsTo: (ContractRelation & {
    fromContract: Contract
  })[]
  parentContract: Contract | null
  childContracts: Contract[]
  _count: {
    parties: number
    versions: number
    attachments: number
  }
}

// Kontrakt med tæller (til lister)
export type ContractWithCounts = Contract & {
  company: Pick<Company, 'id' | 'name'>
  _count: {
    parties: number
    versions: number
    attachments: number
  }
}

// Upload URL response til fil-upload
export interface UploadUrlResponse {
  uploadUrl: string
  fileKey: string
  fileUrl: string
}

// Status-transition type
export type ValidStatusTransition = {
  from: ContractStatus
  to: ContractStatus[]
}

// Sensitivity minimum per type
export type SensitivityMinimumMap = Record<ContractSystemType, SensitivityLevel>

// Filter til liste-queries
export interface ContractListFilter {
  companyId?: string
  status?: ContractStatus
  systemType?: ContractSystemType
  sensitivity?: SensitivityLevel
  search?: string
  page?: number
  pageSize?: number
}

// Relation input
export interface CreateRelationInput {
  fromContractId: string
  toContractId: string
  relationType: RelationType
}

// Part input
export interface ContractPartyInput {
  personId?: string
  isSigner?: boolean
  counterpartyName?: string
  roleInContract?: string
}

// Version upload input
export interface ContractVersionUploadInput {
  contractId: string
  fileKey: string
  fileName: string
  fileSizeBytes: number
  changeType: ChangeType
  changeNote?: string
  amendsClause?: string
  versionNumber: number
}