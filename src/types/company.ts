import { Prisma } from '@prisma/client'

export type CompanyWithCounts = Prisma.CompanyGetPayload<{
  include: {
    _count: {
      select: {
        contracts: true
        caseCompanies: true
        ownerships: true
        companyPersons: true
      }
    }
  }
}>

export type CompanyWithRelations = Prisma.CompanyGetPayload<{
  include: {
    ownerships: {
      include: {
        ownerPerson: true
        contract: true
      }
    }
    companyPersons: {
      include: {
        person: true
        contract: true
      }
    }
    contracts: {
      select: {
        id: true
        displayName: true
        systemType: true
        status: true
      }
    }
  }
}>

export type OwnershipWithRelations = Prisma.OwnershipGetPayload<{
  include: {
    ownerPerson: true
    contract: true
    company: true
  }
}>

export type CompanyPersonWithRelations = Prisma.CompanyPersonGetPayload<{
  include: {
    person: true
    contract: true
    company: true
  }
}>

export type ActionResult<T> = 
  | { data: T; error?: never }
  | { error: string; data?: never }