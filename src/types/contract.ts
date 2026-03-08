import {
  Contract,
  Company,
  ContractParty,
  ContractVersion,
  ContractAttachment,
  ContractRelation,
  Person,
} from '@prisma/client'

// Action result type
export type ActionResult<T> = 
  | { data: T; error?: never }
  | { error: string; data?: never }

// Contract with all relations loaded
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

// Contract with counts for list views
export type ContractWithCounts = Contract & {
  company: Company
  _count: {
    parties: number
    versions: number
    attachments: number
  }
}

// Contract party with person relation
export type ContractPartyWithPerson = ContractParty & {
  person: Person | null
}