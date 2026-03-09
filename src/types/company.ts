import { Prisma } from '@prisma/client'

export type ActionResult<T> =
  | { data: T; error?: never }
  | { error: string; data?: never }

export type CompanyWithCounts = Prisma.CompanyGetPayload<{
  include: {
    _count: {
      select: {
        contracts: true
        caseCompanies: true
        companyPersons: true
        ownerships: true
      }
    }
  }
}>

export type CompanyWithRelations = Prisma.CompanyGetPayload<{
  include: {
    ownerships: {
      include: {
        ownerPerson: true
      }
    }
    companyPersons: {
      include: {
        person: true
        contract: true
      }
    }
    _count: {
      select: {
        contracts: true
        caseCompanies: true
      }
    }
  }
}>

export type OwnershipWithPerson = Prisma.OwnershipGetPayload<{
  include: {
    ownerPerson: true
  }
}>

export type CompanyPersonWithPerson = Prisma.CompanyPersonGetPayload<{
  include: {
    person: true
    contract: true
  }
}>

export type ActivityLogEntry = {
  id: string
  action: string
  resourceType: string
  resourceId: string
  userId: string
  createdAt: Date
  sensitivity?: string | null
  changes?: Prisma.JsonValue | null
}

export type CompanyStatus = 'aktiv' | 'inaktiv' | 'under_stiftelse' | 'opløst'

export type OwnerType = 'person' | 'company'