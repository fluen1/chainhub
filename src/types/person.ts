import { Person, CompanyPerson, Company, Contract } from '@prisma/client'

// ==================== ACTION RESULT ====================

export type ActionResult<T> =
  | { data: T; error?: never }
  | { error: string; data?: never }

// ==================== PERSON TYPES ====================

export type PersonWithCompanies = Person & {
  companyPersons: (CompanyPerson & {
    company: Company
    contract: Contract | null
  })[]
}

export type PersonWithCounts = Person & {
  _count: {
    companyPersons: number
    contractParties: number
    ownerships: number
  }
}

export type PersonListItem = Person & {
  companyPersons: {
    id: string
    role: string
    company: {
      id: string
      name: string
    }
  }[]
  _count: {
    companyPersons: number
  }
}

export type CompanyPersonWithDetails = CompanyPerson & {
  person: Person
  company: Company
  contract: Contract | null
}

// ==================== OUTLOOK TYPES ====================

export interface OutlookContactResponse {
  id: string
  displayName?: string
  givenName?: string
  surname?: string
  emailAddresses?: {
    address?: string
    name?: string
  }[]
  mobilePhone?: string | null
  businessPhones?: string[]
}

export interface OutlookImportResult {
  imported: number
  skipped: number
  errors: string[]
}