import {
  Contract,
  ContractParty,
  ContractVersion,
  ContractAttachment,
  ContractRelation,
  Company,
  Person,
  ContractStatus,
  ContractSystemType,
  SensitivityLevel,
} from '@prisma/client'

export type ActionResult<T> = 
  | { data: T; error?: never }
  | { error: string; data?: never }

export type ContractWithRelations = Contract & {
  company: Company
  parties: (ContractParty & { person: Person | null })[]
  versions: ContractVersion[]
  attachments: ContractAttachment[]
  relationsFrom: (ContractRelation & { toContract: Contract })[]
  relationsTo: (ContractRelation & { fromContract: Contract })[]
  parentContract: Contract | null
  childContracts: Contract[]
}

export type ContractWithCounts = Contract & {
  company: Company
  _count: {
    parties: number
    versions: number
    attachments: number
  }
}

export type ContractPartyWithPerson = ContractParty & {
  person: Person | null
}

export type ContractVersionWithDetails = ContractVersion & {
  contract: Contract
}

export type ContractAttachmentWithDetails = ContractAttachment & {
  contract: Contract
}

export type ContractRelationWithContracts = ContractRelation & {
  fromContract: Contract
  toContract: Contract
}

export interface ContractListItem {
  id: string
  displayName: string
  systemType: ContractSystemType
  status: ContractStatus
  sensitivity: SensitivityLevel
  companyId: string
  companyName: string
  effectiveDate: Date | null
  expiryDate: Date | null
  updatedAt: Date
}

export interface ContractStatusTransition {
  from: ContractStatus
  to: ContractStatus
  isValid: boolean
}

export interface FileUploadResult {
  fileUrl: string
  fileName: string
  fileSizeBytes: number
}