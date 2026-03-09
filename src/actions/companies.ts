'use server'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { canAccessCompany, canWrite } from '@/lib/permissions'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import {
  createCompanySchema,
  updateCompanySchema,
  deleteCompanySchema,
  createOwnershipSchema,
  updateOwnershipSchema,
  deleteOwnershipSchema,
  createCompanyPersonSchema,
  updateCompanyPersonSchema,
  deleteCompanyPersonSchema,
  getCompanySchema,
  listOwnershipsSchema,
  listCompanyPersonsSchema,
  getActivityLogSchema,
} from '@/lib/validations/company'
import type {
  ActionResult,
  CompanyWithCounts,
  CompanyWithRelations,
  OwnershipWithPerson,
  CompanyPersonWithPerson,
  ActivityLogEntry,
} from '@/types/company'
import type { Company, Ownership, CompanyPerson } from '@prisma/client'

// ==================== SELSKAB CRUD ====================

export async function createCompany(
  input: z.infer<typeof createCompanySchema>
): Promise<ActionResult<Company>> {
  const session = await auth()
  if (!session?.user) return { error: 'Ikke autoriseret' }

  const hasWriteAccess = await canWrite(session.user.id)
  if (!hasWriteAccess) return { error: 'Du har ikke skriveadgang' }

  const parsed = createCompanySchema.safeParse(input)
  if (!parsed.success) {
    const firstError = parsed.error.errors[0]
    return { error: firstError?.message ?? 'Ugyldigt input' }
  }

  const { name, cvr, companyType, address, city, postalCode, foundedDate, status, notes } =
    parsed.data

  try {
    const company = await prisma.company.create({
      data: {
        organizationId: session.user.organizationId,
        name,
        cvr: cvr || null,
        companyType: companyType || null,
        address: address || null,
        city: city || null,
        postalCode: postalCode || null,
        foundedDate: foundedDate ? new Date(foundedDate) : null,
        status: status ?? 'aktiv',
        notes: notes || null,
        createdBy: session.user.id,
      },
    })

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
    console.error('createCompany error:', error)
    return { error: 'Selskabet kunne ikke oprettes — prøv igen eller kontakt support' }
  }
}

export async function getCompany(
  input: z.infer<typeof getCompanySchema>
): Promise<ActionResult<CompanyWithRelations>> {
  const session = await auth()
  if (!session?.user) return { error: 'Ikke autoriseret' }

  const parsed = getCompanySchema.safeParse(input)
  if (!parsed.success) return { error: 'Ugyldigt selskabs-ID' }

  const { companyId } = parsed.data

  const hasAccess = await canAccessCompany(session.user.id, companyId)
  if (!hasAccess) return { error: 'Adgang nægtet' }

  try {
    const company = await prisma.company.findFirst({
      where: {
        id: companyId,
        organizationId: session.user.organizationId,
        deletedAt: null,
      },
      include: {
        ownerships: {
          where: { deletedAt: null },
          include: { person: true },
          orderBy: { ownershipPct: 'desc' },
        },
        companyPersons: {
          where: { deletedAt: null },
          include: { person: true },
          orderBy: { createdAt: 'desc' },
        },
        _count: {
          select: {
            contracts: true,
            cases: true,
            documents: true,
          },
        },
      },
    })

    if (!company) return { error: 'Selskab ikke fundet' }

    return { data: company as unknown as CompanyWithRelations }
  } catch (error) {
    console.error('getCompany error:', error)
    return { error: 'Selskabet kunne ikke hentes' }
  }
}

export async function listCompanies(): Promise<ActionResult<CompanyWithCounts[]>> {
  const session = await auth()
  if (!session?.user) return { error: 'Ikke autoriseret' }

  try {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { scope: true, assignedCompanyIds: true },
    })

    const whereClause: Record<string, unknown> = {
      organizationId: session.user.organizationId,
      deletedAt: null,
    }

    if (user?.scope === 'ASSIGNED' && user.assignedCompanyIds?.length) {
      whereClause.id = { in: user.assignedCompanyIds }
    } else if (user?.scope === 'OWN' && user.assignedCompanyIds?.length) {
      whereClause.id = user.assignedCompanyIds[0]
    }

    const companies = await prisma.company.findMany({
      where: whereClause,
      include: {
        _count: {
          select: {
            contracts: true,
            cases: true,
            documents: true,
            ownerships: true,
            companyPersons: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    })

    return { data: companies as unknown as CompanyWithCounts[] }
  } catch (error) {
    console.error('listCompanies error:', error)
    return { error: 'Selskaber kunne ikke hentes' }
  }
}

export async function updateCompany(
  input: z.infer<typeof updateCompanySchema>
): Promise<ActionResult<Company>> {
  const session = await auth()
  if (!session?.user) return { error: 'Ikke autoriseret' }

  const hasWriteAccess = await canWrite(session.user.id)
  if (!hasWriteAccess) return { error: 'Du har ikke skriveadgang' }

  const parsed = updateCompanySchema.safeParse(input)
  if (!parsed.success) {
    const firstError = parsed.error.errors[0]
    return { error: firstError?.message ?? 'Ugyldigt input' }
  }

  const { companyId, name, cvr, companyType, address, city, postalCode, foundedDate, status, notes } =
    parsed.data

  const hasAccess = await canAccessCompany(session.user.id, companyId)
  if (!hasAccess) return { error: 'Adgang nægtet' }

  try {
    const company = await prisma.company.update({
      where: {
        id: companyId,
        organizationId: session.user.organizationId,
      },
      data: {
        ...(name !== undefined && { name }),
        ...(cvr !== undefined && { cvr }),
        ...(companyType !== undefined && { companyType }),
        ...(address !== undefined && { address }),
        ...(city !== undefined && { city }),
        ...(postalCode !== undefined && { postalCode }),
        ...(foundedDate !== undefined && { foundedDate: foundedDate ? new Date(foundedDate) : null }),
        ...(status !== undefined && { status }),
        ...(notes !== undefined && { notes }),
        // FIX: fjernet 'updatedBy' — feltet eksisterer ikke i Prisma-typen
      },
    })

    await prisma.auditLog.create({
      data: {
        organizationId: session.user.organizationId,
        userId: session.user.id,
        action: 'UPDATE',
        resourceType: 'company',
        resourceId: company.id,
      },
    })

    revalidatePath('/companies')
    revalidatePath(`/companies/${companyId}`)
    return { data: company }
  } catch (error) {
    console.error('updateCompany error:', error)
    return { error: 'Selskabet kunne ikke opdateres' }
  }
}

export async function deleteCompany(
  input: z.infer<typeof deleteCompanySchema>
): Promise<ActionResult<{ id: string }>> {
  const session = await auth()
  if (!session?.user) return { error: 'Ikke autoriseret' }

  const hasWriteAccess = await canWrite(session.user.id)
  if (!hasWriteAccess) return { error: 'Du har ikke skriveadgang' }

  const parsed = deleteCompanySchema.safeParse(input)
  if (!parsed.success) return { error: 'Ugyldigt selskabs-ID' }

  const { companyId } = parsed.data

  const hasAccess = await canAccessCompany(session.user.id, companyId)
  if (!hasAccess) return { error: 'Adgang nægtet' }

  try {
    await prisma.company.update({
      where: {
        id: companyId,
        organizationId: session.user.organizationId,
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
    return { data: { id: companyId } }
  } catch (error) {
    console.error('deleteCompany error:', error)
    return { error: 'Selskabet kunne ikke slettes' }
  }
}

// ==================== EJERSKAB ====================

export async function listOwnerships(
  input: z.infer<typeof listOwnershipsSchema>
): Promise<ActionResult<OwnershipWithPerson[]>> {
  const session = await auth()
  if (!session?.user) return { error: 'Ikke autoriseret' }

  const parsed = listOwnershipsSchema.safeParse(input)
  if (!parsed.success) return { error: 'Ugyldigt selskabs-ID' }

  const { companyId } = parsed.data

  const hasAccess = await canAccessCompany(session.user.id, companyId)
  if (!hasAccess) return { error: 'Adgang nægtet' }

  try {
    const ownerships = await prisma.ownership.findMany({
      where: {
        companyId,
        organizationId: session.user.organizationId,
        deletedAt: null,
      },
      include: {
        person: true,
      },
      orderBy: { ownershipPct: 'desc' },
    })

    return { data: ownerships as unknown as OwnershipWithPerson[] }
  } catch (error) {
    console.error('listOwnerships error:', error)
    return { error: 'Ejerskaber kunne ikke hentes' }
  }
}

export async function createOwnership(
  input: z.infer<typeof createOwnershipSchema>
): Promise<ActionResult<Ownership>> {
  const session = await auth()
  if (!session?.user) return { error: 'Ikke autoriseret' }

  const hasWriteAccess = await canWrite(session.user.id)
  if (!hasWriteAccess) return { error: 'Du har ikke skriveadgang' }

  const parsed = createOwnershipSchema.safeParse(input)
  if (!parsed.success) {
    const firstError = parsed.error.errors[0]
    return { error: firstError?.message ?? 'Ugyldigt input' }
  }

  const { companyId, personId, ownershipPct, shareClass, votingRights, notes } = parsed.data

  const hasAccess = await canAccessCompany(session.user.id, companyId)
  if (!hasAccess) return { error: 'Adgang nægtet' }

  try {
    const ownership = await prisma.ownership.create({
      data: {
        organizationId: session.user.organizationId,
        companyId,
        personId: personId ?? null,
        ownershipPct,
        shareClass: shareClass ?? null,
        votingRights: votingRights ?? null,
        notes: notes ?? null,
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

    revalidatePath(`/companies/${companyId}`)
    return { data: ownership }
  } catch (error) {
    console.error('createOwnership error:', error)
    return { error: 'Ejerskab kunne ikke oprettes' }
  }
}

export async function updateOwnership(
  input: z.infer<typeof updateOwnershipSchema>
): Promise<ActionResult<Ownership>> {
  const session = await auth()
  if (!session?.user) return { error: 'Ikke autoriseret' }

  const hasWriteAccess = await canWrite(session.user.id)
  if (!hasWriteAccess) return { error: 'Du har ikke skriveadgang' }

  const parsed = updateOwnershipSchema.safeParse(input)
  if (!parsed.success) {
    const firstError = parsed.error.errors[0]
    return { error: firstError?.message ?? 'Ugyldigt input' }
  }

  const { ownershipId, companyId, personId, ownershipPct, shareClass, votingRights, notes } =
    parsed.data

  const hasAccess = await canAccessCompany(session.user.id, companyId)
  if (!hasAccess) return { error: 'Adgang nægtet' }

  try {
    const ownership = await prisma.ownership.update({
      where: {
        id: ownershipId,
        organizationId: session.user.organizationId,
      },
      data: {
        ...(personId !== undefined && { personId }),
        ...(ownershipPct !== undefined && { ownershipPct }),
        ...(shareClass !== undefined && { shareClass }),
        ...(votingRights !== undefined && { votingRights }),
        ...(notes !== undefined && { notes }),
        // FIX: fjernet 'updatedBy' — feltet eksisterer ikke i Prisma-typen
      },
    })

    await prisma.auditLog.create({
      data: {
        organizationId: session.user.organizationId,
        userId: session.user.id,
        action: 'UPDATE',
        resourceType: 'ownership',
        resourceId: ownership.id,
      },
    })

    revalidatePath(`/companies/${companyId}`)
    return { data: ownership }
  } catch (error) {
    console.error('updateOwnership error:', error)
    return { error: 'Ejerskab kunne ikke opdateres' }
  }
}

export async function deleteOwnership(
  input: z.infer<typeof deleteOwnershipSchema>
): Promise<ActionResult<{ id: string }>> {
  const session = await auth()
  if (!session?.user) return { error: 'Ikke autoriseret' }

  const hasWriteAccess = await canWrite(session.user.id)
  if (!hasWriteAccess) return { error: 'Du har ikke skriveadgang' }

  const parsed = deleteOwnershipSchema.safeParse(input)
  if (!parsed.success) return { error: 'Ugyldigt input' }

  // FIX: korrekt destructuring — deleteOwnershipSchema returnerer ownershipId + companyId
  const { ownershipId, companyId } = parsed.data

  const hasAccess = await canAccessCompany(session.user.id, companyId)
  if (!hasAccess) return { error: 'Adgang nægtet' }

  try {
    await prisma.ownership.update({
      where: {
        id: ownershipId,
        organizationId: session.user.organizationId,
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
        resourceType: 'ownership',
        resourceId: ownershipId,
      },
    })

    revalidatePath(`/companies/${companyId}`)
    return { data: { id: ownershipId } }
  } catch (error) {
    console.error('deleteOwnership error:', error)
    return { error: 'Ejerskab kunne ikke slettes' }
  }
}

// ==================== TILKNYTTEDE PERSONER ====================

export async function listCompanyPersons(
  input: z.infer<typeof listCompanyPersonsSchema>
): Promise<ActionResult<CompanyPersonWithPerson[]>> {
  const session = await auth()
  if (!session?.user) return { error: 'Ikke autoriseret' }

  const parsed = listCompanyPersonsSchema.safeParse(input)
  if (!parsed.success) return { error: 'Ugyldigt selskabs-ID' }

  const { companyId } = parsed.data

  const hasAccess = await canAccessCompany(session.user.id, companyId)
  if (!hasAccess) return { error: 'Adgang nægtet' }

  try {
    const companyPersons = await prisma.companyPerson.findMany({
      where: {
        companyId,
        organizationId: session.user.organizationId,
        deletedAt: null,
      },
      include: {
        person: true,
      },
      orderBy: { createdAt: 'desc' },
    })

    return { data: companyPersons as unknown as CompanyPersonWithPerson[] }
  } catch (error) {
    console.error('listCompanyPersons error:', error)
    return { error: 'Tilknyttede personer kunne ikke hentes' }
  }
}

export async function createCompanyPerson(
  input: z.infer<typeof createCompanyPersonSchema>
): Promise<ActionResult<CompanyPerson>> {
  const session = await auth()
  if (!session?.user) return { error: 'Ikke autoriseret' }

  const hasWriteAccess = await canWrite(session.user.id)
  if (!hasWriteAccess) return { error: 'Du har ikke skriveadgang' }

  const parsed = createCompanyPersonSchema.safeParse(input)
  if (!parsed.success) {
    const firstError = parsed.error.errors[0]
    return { error: firstError?.message ?? 'Ugyldigt input' }
  }

  const { companyId, personId, role, employmentType, startDate, endDate, anciennityStart, contractId } =
    parsed.data

  const hasAccess = await canAccessCompany(session.user.id, companyId)
  if (!hasAccess) return { error: 'Adgang nægtet' }

  // FIX: companyId er garanteret string her (required i createCompanyPersonSchema)
  const resolvedCompanyId: string = companyId

  try {
    const companyPerson = await prisma.companyPerson.create({
      data: {
        organizationId: session.user.organizationId,
        companyId: resolvedCompanyId,
        personId: personId ?? null,
        role: role ?? null,
        employmentType: employmentType ?? null,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        anciennityStart: anciennityStart ? new Date(anciennityStart) : null,
        contractId: contractId ?? null,
        createdBy: session.user.id,
      },
    })

    await prisma.auditLog.create({
      data: {
        organizationId: session.user.organizationId,
        userId: session.user.id,
        action: 'CREATE',
        resourceType: 'companyPerson',
        resourceId: companyPerson.id,
      },
    })

    revalidatePath(`/companies/${resolvedCompanyId}`)
    return { data: companyPerson }
  } catch (error) {
    console.error('createCompanyPerson error:', error)
    return { error: 'Tilknyttet person kunne ikke oprettes' }
  }
}

export async function updateCompanyPerson(
  input: z.infer<typeof updateCompanyPersonSchema>
): Promise<ActionResult<CompanyPerson>> {
  const session = await auth()
  if (!session?.user) return { error: 'Ikke autoriseret' }

  const hasWriteAccess = await canWrite(session.user.id)
  if (!hasWriteAccess) return { error: 'Du har ikke skriveadgang' }

  const parsed = updateCompanyPersonSchema.safeParse(input)
  if (!parsed.success) {
    const firstError = parsed.error.errors[0]
    return { error: firstError?.message ?? 'Ugyldigt input' }
  }

  const { companyPersonId, companyId, personId, role, employmentType, startDate, endDate, anciennityStart, contractId } =
    parsed.data

  const hasAccess = await canAccessCompany(session.user.id, companyId)
  if (!hasAccess) return { error: 'Adgang nægtet' }

  try {
    const companyPerson = await prisma.companyPerson.update({
      where: {
        id: companyPersonId,
        organizationId: session.user.organizationId,
      },
      data: {
        ...(personId !== undefined && { personId }),
        ...(role !== undefined && { role }),
        ...(employmentType !== undefined && { employmentType }),
        ...(startDate !== undefined && { startDate: startDate ? new Date(startDate) : null }),
        ...(endDate !== undefined && { endDate: endDate ? new Date(endDate) : null }),
        ...(anciennityStart !== undefined && { anciennityStart: anciennityStart ? new Date(anciennityStart) : null }),
        ...(contractId !== undefined && { contractId }),
        // FIX: fjernet 'updatedBy' — feltet eksisterer ikke i Prisma-typen
      },
    })

    await prisma.auditLog.create({
      data: {
        organizationId: session.user.organizationId,
        userId: session.user.id,
        action: 'UPDATE',
        resourceType: 'companyPerson',
        resourceId: companyPerson.id,
      },
    })

    revalidatePath(`/companies/${companyId}`)
    return { data: companyPerson }
  } catch (error) {
    console.error('updateCompanyPerson error:', error)
    return { error: 'Tilknyttet person kunne ikke opdateres' }
  }
}

export async function deleteCompanyPerson(
  input: z.infer<typeof deleteCompanyPersonSchema>
): Promise<ActionResult<{ id: string }>> {
  const session = await auth()
  if (!session?.user) return { error: 'Ikke autoriseret' }

  const hasWriteAccess = await canWrite(session.user.id)
  if (!hasWriteAccess) return { error: 'Du har ikke skriveadgang' }

  const parsed = deleteCompanyPersonSchema.safeParse(input)
  if (!parsed.success) return { error: 'Ugyldigt input' }

  // FIX: korrekt destructuring — deleteCompanyPersonSchema returnerer companyPersonId + companyId
  const { companyPersonId, companyId } = parsed.data

  const hasAccess = await canAccessCompany(session.user.id, companyId)
  if (!hasAccess) return { error: 'Adgang nægtet' }

  try {
    await prisma.companyPerson.update({
      where: {
        id: companyPersonId,
        organizationId: session.user.organizationId,
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
        resourceType: 'companyPerson',
        resourceId: companyPersonId,
      },
    })

    revalidatePath(`/companies/${companyId}`)
    return { data: { id: companyPersonId } }
  } catch (error) {
    console.error('deleteCompanyPerson error:', error)
    return { error: 'Tilknyttet person kunne ikke slettes' }
  }
}

// ==================== AKTIVITETSLOG ====================

export async function getActivityLog(
  input: z.infer<typeof getActivityLogSchema>
): Promise<ActionResult<ActivityLogEntry[]>> {
  const session = await auth()
  if (!session?.user) return { error: 'Ikke autoriseret' }

  const parsed = getActivityLogSchema.safeParse(input)
  if (!parsed.success) return { error: 'Ugyldigt selskabs-ID' }

  const { companyId, limit } = parsed.data

  const hasAccess = await canAccessCompany(session.user.id, companyId)
  if (!hasAccess) return { error: 'Adgang nægtet' }

  try {
    const logs = await prisma.auditLog.findMany({
      where: {
        organizationId: session.user.organizationId,
        resourceId: companyId,
      },
      // FIX: fjernet 'include: { user: ... }' — AuditLog har ikke user-relation i Prisma-typen
      orderBy: { createdAt: 'desc' },
      take: limit ?? 50,
    })

    return { data: logs as unknown as ActivityLogEntry[] }
  } catch (error) {
    console.error('getActivityLog error:', error)
    return { error: 'Aktivitetslog kunne ikke hentes' }
  }
}