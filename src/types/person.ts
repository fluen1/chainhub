import type { Person, CompanyPerson, Company, ContractParty, Contract } from '@prisma/client'

export type PersonWithCompanies = Person & {
  companyPersons: (CompanyPerson & {
    company: Company
    contract: Contract | null
  })[]
  _count: {
    companyPersons: number
    contractParties: number
    ownerships: number
  }
}

export type PersonSummary = {
  id: string
  firstName: string
  lastName: string
  email: string | null
  phone: string | null
  companyCount: number
  roles: string[]
}

export type CompanyPersonWithDetails = CompanyPerson & {
  person: Person
  company: Company
  contract: Contract | null
}

export type ActionResult<T> =
  | { data: T; error?: never }
  | { error: string; data?: never }

export type OutlookContact = {
  id: string
  givenName: string
  surname: string
  emailAddresses: { address: string; name: string }[]
  mobilePhone: string | null
  businessPhones: string[]
  displayName: string
}

export type OutlookImportResult = {
  imported: number
  skipped: number
  errors: string[]
}