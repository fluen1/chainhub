'use server'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { canAccessCompany, canAccessModule, canEdit } from '@/lib/permissions'
import { revalidatePath } from 'next/cache'
import {
  createCompanySchema,
  updateCompanySchema,
  createOwnershipSchema,
  updateOwnershipSchema,
  createCompanyPersonSchema,
  updateCompanyPersonSchema,
  CreateCompanyInput,
  UpdateCompanyInput,
  CreateOwnershipInput,
  UpdateOwnershipInput,
  CreateCompanyPersonInput,
  UpdateCompanyPersonInput,
} from '@/lib/validations/company'
import { ActionResult, CompanyWithCounts, CompanyWithRelations, OwnershipWithRelations, CompanyPersonWithRelations } from '@/types/company'
import { Company, Ownership, CompanyPerson } from '@prisma/client'

// ==================== SELSKABER ====================

export async function createCompany(
  input: CreateCompanyInput
): Promise<ActionResult<Company>> {
  const session = await auth()
  if (!session?.user?.id || !session?.user?.organizationId) {
    return { error: 'Ikke autoriseret' }
  }

  const canAccess = await canAccessModule(session.user.id, 'companies')
  if (!canAccess) {
    return { error: 'Du har ikke adgang til selskabsmodulet' }
  }

  const canEditData = await canEdit(session.user.id)
  if (!canEditData) {
    return { error: 'Du har ikke rettigheder til at oprette selskaber' }
  }

  const parsed = createCompanySchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message || 'Ugyldigt input' }
  }

  try {
    const company = await prisma.company.create({
      data: {
        ...parsed.data,
        organizationId: session.user.organizationId,
        createdBy: session.user.id,
      },
    })

    // Log aktivitet
    await prisma.auditLog.create({
      data: {
        organizationId: session.user.organizationId,
        userId: session.user.id,
        action: 'CREATE',
        resourceType: 'company',
        resourceId: company.id,
      },
    })

    revalidatePath('/companies')
    return { data: company }
  } catch (error) {
    console.error('Fejl ved oprettelse af selskab:', error)
    return { error: 'Selskabet kunne ikke oprettes — prøv igen' }
  }
}

export async function updateCompany(
  input: UpdateCompanyInput
): Promise<ActionResult<Company>> {
  const session = await auth()
  if (!session?.user?.id || !session?.user?.organizationId) {
    return { error: 'Ikke autoriseret' }
  }

  const parsed = updateCompanySchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message || 'Ugyldigt input' }
  }

  const { id, ...data } = parsed.data

  const hasAccess = await canAccessCompany(session.user.id, id)
  if (!hasAccess) {
    return { error: 'Du har ikke adgang til dette selskab' }
  }

  const canEditData = await canEdit(session.user.id)
  if (!canEditData) {
    return { error: 'Du har ikke rettigheder til at redigere selskaber' }
  }

  try {
    const company = await prisma.company.update({
      where: {
        id,
        organizationId: session.user.organizationId,
        deletedAt: null,
      },
      data,
    })

    await prisma.auditLog.create({
      data: {
        organizationId: session.user.organizationId,
        userId: session.user.id,
        action: 'UPDATE',
        resourceType: 'company',
        resourceId: company.id,
        changes: data as object,
      },
    })

    revalidatePath(`/companies/${id}`)
    revalidatePath('/companies')
    return { data: company }
  } catch (error) {
    console.error('Fejl ved opdatering af selskab:', error)
    return { error: 'Selskabet kunne ikke opdateres — prøv igen' }
  }
}

export async function deleteCompany(companyId: string): Promise<ActionResult<{ success: true }>> {
  const session = await auth()
  if (!session?.user?.id || !session?.user?.organizationId) {
    return { error: 'Ikke autoriseret' }
  }

  const hasAccess = await canAccessCompany(session.user.id, companyId)
  if (!hasAccess) {
    return { error: 'Du har ikke adgang til dette selskab' }
  }

  const canEditData = await canEdit(session.user.id)
  if (!canEditData) {
    return { error: 'Du har ikke rettigheder til at slette selskaber' }
  }

  try {
    await prisma.company.update({
      where: {
        id: companyId,
        organizationId: session.user.organizationId,
        deletedAt: null,
      },
      data: {
        deletedAt: new Date(),
      },
    })

    await prisma.auditLog.create({
      data: {
        organizationId: session.user.organizationId,
        userId: session.user.id,
        action: 'DELETE',
        resourceType: 'company',
        resourceId: companyId,
      },
    })

    revalidatePath('/companies')
    return { data: { success: true } }
  } catch (error) {
    console.error('Fejl ved sletning af selskab:', error)
    return { error: 'Selskabet kunne ikke slettes — prøv igen' }
  }
}

export async function getCompany(
  companyId: string
): Promise<ActionResult<CompanyWithRelations>> {
  const session = await auth()
  if (!session?.user?.id || !session?.user?.organizationId) {
    return { error: 'Ikke autoriseret' }
  }

  const hasAccess = await canAccessCompany(session.user.id, companyId)
  if (!hasAccess) {
    return { error: 'Du har ikke adgang til dette selskab' }
  }

  try {
    const company = await prisma.company.findUnique({
      where: {
        id: companyId,
        organizationId: session.user.organizationId,
        deletedAt: null,
      },
      include: {
        ownerships: {
          include: {
            ownerPerson: true,
            contract: true,
          },
          orderBy: { ownershipPct: 'desc' },
        },
        companyPersons: {
          include: {
            person: true,
            contract: true,
          },
          orderBy: { role: 'asc' },
        },
        contracts: {
          where: { deletedAt: null },
          select: {
            id: true,
            displayName: true,
            systemType: true,
            status: true,
          },
          take: 10,
          orderBy: { updatedAt: 'desc' },
        },
      },
    })

    if (!company) {
      return { error: 'Selskabet blev ikke fundet' }
    }

    // Log visning
    await prisma.auditLog.create({
      data: {
        organizationId: session.user.organizationId,
        userId: session.user.id,
        action: 'VIEW',
        resourceType: 'company',
        resourceId: companyId,
      },
    })

    return { data: company }
  } catch (error) {
    console.error('Fejl ved hentning af selskab:', error)
    return { error: 'Selskabet kunne ikke hentes — prøv igen' }
  }
}

export async function listCompanies(): Promise<ActionResult<CompanyWithCounts[]>> {
  const session = await auth()
  if (!session?.user?.id || !session?.user?.organizationId) {
    return { error: 'Ikke autoriseret' }
  }

  const canAccess = await canAccessModule(session.user.id, 'companies')
  if (!canAccess) {
    return { error: 'Du har ikke adgang til selskabsmodulet' }
  }

  try {
    // Brug getAccessibleCompanies fra permissions for at respektere scope
    const { getAccessibleCompanies } = await import('@/lib/permissions')
    const accessibleCompanies = await getAccessibleCompanies(session.user.id)
    
    if (accessibleCompanies.length === 0) {
      return { data: [] }
    }

    const companyIds = accessibleCompanies.map((c) => c.id)

    const companies = await prisma.company.findMany({
      where: {
        id: { in: companyIds },
        organizationId: session.user.organizationId,
        deletedAt: null,
      },
      include: {
        _count: {
          select: {
            contracts: { where: { deletedAt: null } },
            caseCompanies: true,
            ownerships: true,
            companyPersons: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    })

    return { data: companies }
  } catch (error) {
    console.error('Fejl ved hentning af selskaber:', error)
    return { error: 'Selskaberne kunne ikke hentes — prøv igen' }
  }
}

// ==================== EJERSKAB ====================

export async function createOwnership(
  input: CreateOwnershipInput
): Promise<ActionResult<Ownership>> {
  const session = await auth()
  if (!session?.user?.id || !session?.user?.organizationId) {
    return { error: 'Ikke autoriseret' }
  }

  const parsed = createOwnershipSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message || 'Ugyldigt input' }
  }

  const hasAccess = await canAccessCompany(session.user.id, parsed.data.companyId)
  if (!hasAccess) {
    return { error: 'Du har ikke adgang til dette selskab' }
  }

  const canEditData = await canEdit(session.user.id)
  if (!canEditData) {
    return { error: 'Du har ikke rettigheder til at tilføje ejerskab' }
  }

  // Tjek at ejer-person/selskab eksisterer i samme organisation
  if (parsed.data.ownerPersonId) {
    const person = await prisma.person.findFirst({
      where: {
        id: parsed.data.ownerPersonId,
        organizationId: session.user.organizationId,
        deletedAt: null,
      },
    })
    if (!person) {
      return { error: 'Ejerpersonen blev ikke fundet' }
    }
  }

  if (parsed.data.ownerCompanyId) {
    const ownerCompany = await prisma.company.findFirst({
      where: {
        id: parsed.data.ownerCompanyId,
        organizationId: session.user.organizationId,
        deletedAt: null,
      },
    })
    if (!ownerCompany) {
      return { error: 'Ejerselskabet blev ikke fundet' }
    }
  }

  try {
    const { ownerType, ...ownershipData } = parsed.data
    
    const ownership = await prisma.ownership.create({
      data: {
        ...ownershipData,
        organizationId: session.user.organizationId,
        createdBy: session.user.id,
      },
    })

    await prisma.auditLog.create({
      data: {
        organizationId: session.user.organizationId,
        userId: session.user.id,
        action: 'CREATE',
        resourceType: 'ownership',
        resourceId: ownership.id,
      },
    })

    revalidatePath(`/companies/${parsed.data.companyId}`)
    return { data: ownership }
  } catch (error) {
    console.error('Fejl ved oprettelse af ejerskab:', error)
    return { error: 'Ejerskabet kunne ikke oprettes — prøv igen' }
  }
}

export async function updateOwnership(
  input: UpdateOwnershipInput
): Promise<ActionResult<Ownership>> {
  const session = await auth()
  if (!session?.user?.id || !session?.user?.organizationId) {
    return { error: 'Ikke autoriseret' }
  }

  const parsed = updateOwnershipSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message || 'Ugyldigt input' }
  }

  const { id, ...data } = parsed.data

  // Hent ejerskab for at verificere adgang
  const existing = await prisma.ownership.findFirst({
    where: {
      id,
      organizationId: session.user.organizationId,
    },
  })

  if (!existing) {
    return { error: 'Ejerskabet blev ikke fundet' }
  }

  const hasAccess = await canAccessCompany(session.user.id, existing.companyId)
  if (!hasAccess) {
    return { error: 'Du har ikke adgang til dette selskab' }
  }

  const canEditData = await canEdit(session.user.id)
  if (!canEditData) {
    return { error: 'Du har ikke rettigheder til at redigere ejerskab' }
  }

  try {
    const ownership = await prisma.ownership.update({
      where: { id },
      data,
    })

    await prisma.auditLog.create({
      data: {
        organizationId: session.user.organizationId,
        userId: session.user.id,
        action: 'UPDATE',
        resourceType: 'ownership',
        resourceId: ownership.id,
        changes: data as object,
      },
    })

    revalidatePath(`/companies/${existing.companyId}`)
    return { data: ownership }
  } catch (error) {
    console.error('Fejl ved opdatering af ejerskab:', error)
    return { error: 'Ejerskabet kunne ikke opdateres — prøv igen' }
  }
}

export async function deleteOwnership(
  ownershipId: string
): Promise<ActionResult<{ success: true }>> {
  const session = await auth()
  if (!session?.user?.id || !session?.user?.organizationId) {
    return { error: 'Ikke autoriseret' }
  }

  const existing = await prisma.ownership.findFirst({
    where: {
      id: ownershipId,
      organizationId: session.user.organizationId,
    },
  })

  if (!existing) {
    return { error: 'Ejerskabet blev ikke fundet' }
  }

  const hasAccess = await canAccessCompany(session.user.id, existing.companyId)
  if (!hasAccess) {
    return { error: 'Du har ikke adgang til dette selskab' }
  }

  const canEditData = await canEdit(session.user.id)
  if (!canEditData) {
    return { error: 'Du har ikke rettigheder til at slette ejerskab' }
  }

  try {
    await prisma.ownership.delete({
      where: { id: ownershipId },
    })

    await prisma.auditLog.create({
      data: {
        organizationId: session.user.organizationId,
        userId: session.user.id,
        action: 'DELETE',
        resourceType: 'ownership',
        resourceId: ownershipId,
      },
    })

    revalidatePath(`/companies/${existing.companyId}`)
    return { data: { success: true } }
  } catch (error) {
    console.error('Fejl ved sletning af ejerskab:', error)
    return { error: 'Ejerskabet kunne ikke slettes — prøv igen' }
  }
}

export async function listOwnerships(
  companyId: string
): Promise<ActionResult<OwnershipWithRelations[]>> {
  const session = await auth()
  if (!session?.user?.id || !session?.user?.organizationId) {
    return { error: 'Ikke autoriseret' }
  }

  const hasAccess = await canAccessCompany(session.user.id, companyId)
  if (!hasAccess) {
    return { error: 'Du har ikke adgang til dette selskab' }
  }

  try {
    const ownerships = await prisma.ownership.findMany({
      where: {
        companyId,
        organizationId: session.user.organizationId,
      },
      include: {
        ownerPerson: true,
        contract: true,
        company: true,
      },
      orderBy: { ownershipPct: 'desc' },
    })

    return { data: ownerships }
  } catch (error) {
    console.error('Fejl ved hentning af ejerskab:', error)
    return { error: 'Ejerskab kunne ikke hentes — prøv igen' }
  }
}

// ==================== GOVERNANCE & ANSATTE ====================

export async function createCompanyPerson(
  input: CreateCompanyPersonInput
): Promise<ActionResult<CompanyPerson>> {
  const session = await auth()
  if (!session?.user?.id || !session?.user?.organizationId) {
    return { error: 'Ikke autoriseret' }
  }

  const parsed = createCompanyPersonSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message || 'Ugyldigt input' }
  }

  const hasAccess = await canAccessCompany(session.user.id, parsed.data.companyId)
  if (!hasAccess) {
    return { error: 'Du har ikke adgang til dette selskab' }
  }

  const canEditData = await canEdit(session.user.id)
  if (!canEditData) {
    return { error: 'Du har ikke rettigheder til at tilføje personer' }
  }

  // Verificer at personen eksisterer
  const person = await prisma.person.findFirst({
    where: {
      id: parsed.data.personId,
      organizationId: session.user.organizationId,
      deletedAt: null,
    },
  })

  if (!person) {
    return { error: 'Personen blev ikke fundet' }
  }

  try {
    const companyPerson = await prisma.companyPerson.create({
      data: {
        ...parsed.data,
        organizationId: session.user.organizationId,
        createdBy: session.user.id,
      },
    })

    await prisma.auditLog.create({
      data: {
        organizationId: session.user.organizationId,
        userId: session.user.id,
        action: 'CREATE',
        resourceType: 'company_person',
        resourceId: companyPerson.id,
      },
    })

    revalidatePath(`/companies/${parsed.data.companyId}`)
    return { data: companyPerson }
  } catch (error) {
    console.error('Fejl ved tilføjelse af person til selskab:', error)
    return { error: 'Personen kunne ikke tilføjes — prøv igen' }
  }
}

export async function updateCompanyPerson(
  input: UpdateCompanyPersonInput
): Promise<ActionResult<CompanyPerson>> {
  const session = await auth()
  if (!session?.user?.id || !session?.user?.organizationId) {
    return { error: 'Ikke autoriseret' }
  }

  const parsed = updateCompanyPersonSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message || 'Ugyldigt input' }
  }

  const { id, ...data } = parsed.data

  const existing = await prisma.companyPerson.findFirst({
    where: {
      id,
      organizationId: session.user.organizationId,
    },
  })

  if (!existing) {
    return { error: 'Tilknytningen blev ikke fundet' }
  }

  const hasAccess = await canAccessCompany(session.user.id, existing.companyId)
  if (!hasAccess) {
    return { error: 'Du har ikke adgang til dette selskab' }
  }

  const canEditData = await canEdit(session.user.id)
  if (!canEditData) {
    return { error: 'Du har ikke rettigheder til at redigere' }
  }

  try {
    const companyPerson = await prisma.companyPerson.update({
      where: { id },
      data,
    })

    await prisma.auditLog.create({
      data: {
        organizationId: session.user.organizationId,
        userId: session.user.id,
        action: 'UPDATE',
        resourceType: 'company_person',
        resourceId: companyPerson.id,
        changes: data as object,
      },
    })

    revalidatePath(`/companies/${existing.companyId}`)
    return { data: companyPerson }
  } catch (error) {
    console.error('Fejl ved opdatering af persontilknytning:', error)
    return { error: 'Tilknytningen kunne ikke opdateres — prøv igen' }
  }
}

export async function deleteCompanyPerson(
  companyPersonId: string
): Promise<ActionResult<{ success: true }>> {
  const session = await auth()
  if (!session?.user?.id || !session?.user?.organizationId) {
    return { error: 'Ikke autoriseret' }
  }

  const existing = await prisma.companyPerson.findFirst({
    where: {
      id: companyPersonId,
      organizationId: session.user.organizationId,
    },
  })

  if (!existing) {
    return { error: 'Tilknytningen blev ikke fundet' }
  }

  const hasAccess = await canAccessCompany(session.user.id, existing.companyId)
  if (!hasAccess) {
    return { error: 'Du har ikke adgang til dette selskab' }
  }

  const canEditData = await canEdit(session.user.id)
  if (!canEditData) {
    return { error: 'Du har ikke rettigheder til at slette' }
  }

  try {
    await prisma.companyPerson.delete({
      where: { id: companyPersonId },
    })

    await prisma.auditLog.create({
      data: {
        organizationId: session.user.organizationId,
        userId: session.user.id,
        action: 'DELETE',
        resourceType: 'company_person',
        resourceId: companyPersonId,
      },
    })

    revalidatePath(`/companies/${existing.companyId}`)
    return { data: { success: true } }
  } catch (error) {
    console.error('Fejl ved sletning af persontilknytning:', error)
    return { error: 'Tilknytningen kunne ikke slettes — prøv igen' }
  }
}

export async function listCompanyPersons(
  companyId: string,
  filter?: { role?: string }
): Promise<ActionResult<CompanyPersonWithRelations[]>> {
  const session = await auth()
  if (!session?.user?.id || !session?.user?.organizationId) {
    return { error: 'Ikke autoriseret' }
  }

  const hasAccess = await canAccessCompany(session.user.id, companyId)
  if (!hasAccess) {
    return { error: 'Du har ikke adgang til dette selskab' }
  }

  try {
    const where: any = {
      companyId,
      organizationId: session.user.organizationId,
    }

    if (filter?.role) {
      where.role = filter.role
    }

    const companyPersons = await prisma.companyPerson.findMany({
      where,
      include: {
        person: true,
        contract: true,
        company: true,
      },
      orderBy: [
        { role: 'asc' },
        { person: { lastName: 'asc' } },
      ],
    })

    return { data: companyPersons }
  } catch (error) {
    console.error('Fejl ved hentning af personer:', error)
    return { error: 'Personer kunne ikke hentes — prøv igen' }
  }
}

// ==================== AKTIVITETSLOG ====================

export async function getCompanyActivityLog(
  companyId: string,
  limit: number = 50
): Promise<ActionResult<any[]>> {
  const session = await auth()
  if (!session?.user?.id || !session?.user?.organizationId) {
    return { error: 'Ikke autoriseret' }
  }

  const hasAccess = await canAccessCompany(session.user.id, companyId)
  if (!hasAccess) {
    return { error: 'Du har ikke adgang til dette selskab' }
  }

  try {
    const activities = await prisma.auditLog.findMany({
      where: {
        organizationId: session.user.organizationId,
        resourceId: companyId,
        resourceType: 'company',
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })

    // Hent relateret aktivitet (kontrakter, personer tilknyttet selskabet)
    const relatedActivities = await prisma.auditLog.findMany({
      where: {
        organizationId: session.user.organizationId,
        OR: [
          { resourceType: 'ownership' },
          { resourceType: 'company_person' },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })

    // Kombiner og sortér
    const allActivities = [...activities, ...relatedActivities]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit)

    return { data: allActivities }
  } catch (error) {
    console.error('Fejl ved hentning af aktivitetslog:', error)
    return { error: 'Aktivitetslog kunne ikke hentes — prøv igen' }
  }
}