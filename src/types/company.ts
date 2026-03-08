import { Company, Ownership, CompanyPerson, Contract, Person } from '@prisma/client'

export type ActionResult<T> =
  | { data: T; error?: never }
  | { error: string; data?: never }

export type CompanyWithCounts = Company & {
  _count: {
    contracts: number
    caseCompanies: number
    ownerships: number
    companyPersons: number
  }
}

export type CompanyWithRelations = Company & {
  ownerships: (Ownership & {
    ownerPerson: Person | null
    contract: Contract | null
  })[]
  companyPersons: (CompanyPerson & {
    person: Person
    contract: Contract | null
  })[]
  contracts: {
    id: string
    displayName: string
    systemType: string
    status: string
  }[]
}

export type OwnershipWithRelations = Ownership & {
  ownerPerson: Person | null
  contract: Contract | null
  company: Company
}

export type CompanyPersonWithRelations = CompanyPerson & {
  person: Person
  company: Company
  contract: Contract | null
}