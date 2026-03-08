'use server'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { canAccessCompany } from '@/lib/permissions'
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

    // Audit log
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
  if (!hasAccess) return { error: 'Du har ikke adgang til dette selskab' }

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
          },
          orderBy: { createdAt: 'desc' },
        },
        companyPersons: {
          include: {
            person: true,
            contract: true,
          },
          orderBy: { createdAt: 'desc' },
        },
        _count: {
          select: {
            contracts: true,
            caseCompanies: true,
          },
        },
      },
    })

    if (!company) return { error: 'Selskabet blev ikke fundet' }

    // Audit log — VIEW
    await prisma.auditLog.create({
      data: {
        organizationId: session.user.organizationId,
        userId: session.user.id,
        action: 'VIEW',
        resourceType: 'company',
        resourceId: company.id,
      },
    })

    return { data: company as CompanyWithRelations }
  } catch (error) {
    console.error('getCompany error:', error)
    return { error: 'Selskabet kunne ikke hentes — prøv igen' }
  }
}

export async function listCompanies(): Promise<ActionResult<CompanyWithCounts[]>> {
  const session = await auth()
  if (!session?.user) return { error: 'Ikke autoriseret' }

  try {
    const companies = await prisma.company.findMany({
      where: {
        organizationId: session.user.organizationId,
        deletedAt: null,
      },
      include: {
        _count: {
          select: {
            contracts: true,
            caseCompanies: true,
            companyPersons: true,
            ownerships: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    })

    return { data: companies as CompanyWithCounts[] }
  } catch (error) {
    console.error('listCompanies error:', error)
    return { error: 'Selskaberne kunne ikke hentes — prøv igen' }
  }
}

export async function updateCompany(
  input: z.infer<typeof updateCompanySchema>
): Promise<ActionResult<Company>> {
  const session = await auth()
  if (!session?.user) return { error: 'Ikke autoriseret' }

  const parsed = updateCompanySchema.safeParse(input)
  if (!parsed.success) {
    const firstError = parsed.error.errors[0]
    return { error: firstError?.message ?? 'Ugyldigt input' }
  }

  const { companyId, ...updateData } = parsed.data

  const hasAccess = await canAccessCompany(session.user.id, companyId)
  if (!hasAccess) return { error: 'Du har ikke adgang til dette selskab' }

  try {
    // Hent eksisterende data til audit
    const existing = await prisma.company.findUnique({
      where: {
        id: companyId,
        organizationId: session.user.organizationId,
        deletedAt: null,
      },
    })
    if (!existing) return { error: 'Selskabet blev ikke fundet' }

    const company = await prisma.company.update({
      where: {
        id: companyId,
        organizationId: session.user.organizationId,
      },
      data: {
        ...updateData,
        cvr: updateData.cvr !== undefined ? updateData.cvr || null : undefined,
        companyType: updateData.companyType || undefined,
        address: updateData.address !== undefined ? updateData.address || null : undefined,
        city: updateData.city !== undefined ? updateData.city || null : undefined,
        postalCode: updateData.postalCode !== undefined ? updateData.postalCode || null : undefined,
        foundedDate:
          updateData.foundedDate !== undefined
            ? updateData.foundedDate
              ? new Date(updateData.foundedDate)
              : null
            : undefined,
        notes: updateData.notes !== undefined ? updateData.notes || null : undefined,
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

    revalidatePath(`/companies/${companyId}`)
    revalidatePath('/companies')
    return { data: company }
  } catch (error) {
    console.error('updateCompany error:', error)
    return { error: 'Selskabet kunne ikke opdateres — prøv igen eller kontakt support' }
  }
}

export async function deleteCompany(
  input: z.infer<typeof deleteCompanySchema>
): Promise<ActionResult<{ id: string }>> {
  const session = await auth()
  if (!session?.user) return { error: 'Ikke autoriseret' }

  const parsed = deleteCompanySchema.safeParse(input)
  if (!parsed.success) return { error: 'Ugyldigt selskabs-ID' }

  const { companyId } = parsed.data

  const hasAccess = await canAccessCompany(session.user.id, companyId)
  if (!hasAccess) return { error: 'Du har ikke adgang til dette selskab' }

  try {
    await prisma.company.update({
      where: {
        id: companyId,
        organizationId: session.user.organizationId,
      },
      data: { deletedAt: new Date() },
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
    return { error: 'Selskabet kunne ikke slettes — prøv igen eller kontakt support' }
  }
}

// ==================== EJERSKAB ====================

export async function createOwnership(
  input: z.infer<typeof createOwnershipSchema>
): Promise<ActionResult<Ownership>> {
  const session = await auth()
  if (!session?.user) return { error: 'Ikke autoriseret' }

  const parsed = createOwnershipSchema.safeParse(input)
  if (!parsed.success) {
    const firstError = parsed.error.errors[0]
    return { error: firstError?.message ?? 'Ugyldigt input' }
  }

  const { companyId, ownerType, ownerPersonId, ownerCompanyId, ownershipPct, shareClass, effectiveDate } =
    parsed.data

  const hasAccess = await canAccessCompany(session.user.id, companyId)
  if (!hasAccess) return { error: 'Du har ikke adgang til dette selskab' }

  // Validér at ejer-ID tilhører organisationen
  if (ownerType === 'person' && ownerPersonId) {
    const person = await prisma.person.findUnique({
      where: {
        id: ownerPersonId,
        organizationId: session.user.organizationId,
        deletedAt: null,
      },
    })
    if (!person) return { error: 'Person ikke fundet i din organisation' }
  }

  // Tjek at total ejerandel ikke overstiger 100%
  try {
    const existingOwnerships = await prisma.ownership.findMany({
      where: {
        companyId,
        organizationId: session.user.organizationId,
      },
    })

    const totalExisting = existingOwnerships.reduce(
      (sum, o) => sum + Number(o.ownershipPct),
      0
    )
    if (totalExisting + ownershipPct > 100) {
      return {
        error: `Samlet ejerandel vil overstige 100% (nuværende: ${totalExisting.toFixed(2)}%)`,
      }
    }

    const ownership = await prisma.ownership.create({
      data: {
        organizationId: session.user.organizationId,
        companyId,
        ownerPersonId: ownerType === 'person' ? ownerPersonId : null,
        ownerCompanyId: ownerType === 'company' ? ownerCompanyId : null,
        ownershipPct,
        shareClass: shareClass || null,
        effectiveDate: effectiveDate ? new Date(effectiveDate) : null,
        createdBy: session.user.id,
      },
    })

    revalidatePath(`/companies/${companyId}`)
    return { data: ownership }
  } catch (error) {
    console.error('createOwnership error:', error)
    return { error: 'Ejerskab kunne ikke oprettes — prøv igen eller kontakt support' }
  }
}

export async function updateOwnership(
  input: z.infer<typeof updateOwnershipSchema>
): Promise<ActionResult<Ownership>> {
  const session = await auth()
  if (!session?.user) return { error: 'Ikke autoriseret' }

  const parsed = updateOwnershipSchema.safeParse(input)
  if (!parsed.success) {
    const firstError = parsed.error.errors[0]
    return { error: firstError?.message ?? 'Ugyldigt input' }
  }

  const { ownershipId, companyId, ownershipPct, shareClass, effectiveDate } = parsed.data

  const hasAccess = await canAccessCompany(session.user.id, companyId)
  if (!hasAccess) return { error: 'Du har ikke adgang til dette selskab' }

  try {
    const existing = await prisma.ownership.findFirst({
      where: {
        id: ownershipId,
        companyId,
        organizationId: session.user.organizationId,
      },
    })
    if (!existing) return { error: 'Ejerskab ikke fundet' }

    // Tjek total ejerandel ved opdatering
    if (ownershipPct !== undefined) {
      const otherOwnerships = await prisma.ownership.findMany({
        where: {
          companyId,
          organizationId: session.user.organizationId,
          id: { not: ownershipId },
        },
      })
      const totalOthers = otherOwnerships.reduce((sum, o) => sum + Number(o.ownershipPct), 0)
      if (totalOthers + ownershipPct > 100) {
        return {
          error: `Samlet ejerandel vil overstige 100% (øvrige ejeres andel: ${totalOthers.toFixed(2)}%)`,
        }
      }
    }

    const updated = await prisma.ownership.update({
      where: { id: ownershipId },
      data: {
        ownershipPct: ownershipPct ?? undefined,
        shareClass: shareClass !== undefined ? shareClass || null : undefined,
        effectiveDate:
          effectiveDate !== undefined
            ? effectiveDate
              ? new Date(effectiveDate)
              : null
            : undefined,
      },
    })

    revalidatePath(`/companies/${companyId}`)
    return { data: updated }
  } catch (error) {
    console.error('updateOwnership error:', error)
    return { error: 'Ejerskab kunne ikke opdateres — prøv igen' }
  }
}

export async function deleteOwnership(
  input: z.infer<typeof deleteOwnershipSchema>
): Promise<ActionResult<{ id: string }>> {
  const session = await auth()
  if (!session?.user) return { error: 'Ikke autoriseret' }

  const parsed = deleteOwnershipSchema.safeParse(input)
  if (!parsed.success) return { error: 'Ugyldigt input' }

  const { ownershipId, companyId } = parsed.data

  const hasAccess = await canAccessCompany(session.user.id, companyId)
  if (!hasAccess) return { error: 'Du har ikke adgang til dette selskab' }

  try {
    const existing = await prisma.ownership.findFirst({
      where: {
        id: ownershipId,
        companyId,
        organizationId: session.user.organizationId,
      },
    })
    if (!existing) return { error: 'Ejerskab ikke fundet' }

    await prisma.ownership.delete({
      where: { id: ownershipId },
    })

    revalidatePath(`/companies/${companyId}`)
    return { data: { id: ownershipId } }
  } catch (error) {
    console.error('deleteOwnership error:', error)
    return { error: 'Ejerskab kunne ikke slettes — prøv igen' }
  }
}

export async function listOwnerships(
  input: z.infer<typeof listOwnershipsSchema>
): Promise<ActionResult<OwnershipWithPerson[]>> {
  const session = await auth()
  if (!session?.user) return { error: 'Ikke autoriseret' }

  const parsed = listOwnershipsSchema.safeParse(input)
  if (!parsed.success) return { error: 'Ugyldigt selskabs-ID' }

  const { companyId } = parsed.data

  const hasAccess = await canAccessCompany(session.user.id, companyId)
  if (!hasAccess) return { error: 'Du har ikke adgang til dette selskab' }

  try {
    const ownerships = await prisma.ownership.findMany({
      where: {
        companyId,
        organizationId: session.user.organizationId,
      },
      include: {
        ownerPerson: true,
      },
      orderBy: { ownershipPct: 'desc' },
    })

    return { data: ownerships as OwnershipWithPerson[] }
  } catch (error) {
    console.error('listOwnerships error:', error)
    return { error: 'Ejerskaber kunne ikke hentes — prøv igen' }
  }
}

// ==================== GOVERNANCE / COMPANY PERSONS ====================

export async function createCompanyPerson(
  input: z.infer<typeof createCompanyPersonSchema>
): Promise<ActionResult<CompanyPerson>> {
  const session = await auth()
  if (!session?.user) return { error: 'Ikke autoriseret' }

  const parsed = createCompanyPersonSchema.safeParse(input)
  if (!parsed.success) {
    const firstError = parsed.error.errors[0]
    return { error: firstError?.message ?? 'Ugyldigt input' }
  }

  const { companyId, personId, role, employmentType, startDate, endDate, anciennityStart, contractId } =
    parsed.data

  const hasAccess = await canAccessCompany(session.user.id, companyId)
  if (!hasAccess) return { error: 'Du har ikke adgang til dette selskab' }

  // Validér at person tilhører organisationen
  const person = await prisma.person.findUnique({
    where: {
      id: personId,
      organizationId: session.user.organizationId,
      deletedAt: null,
    },
  })
  if (!person) return { error: 'Person ikke fundet i din organisation' }

  try {
    const companyPerson = await prisma.companyPerson.create({
      data: {
        organizationId: session.user.organizationId,
        companyId,
        personId,
        role,
        employmentType: employmentType || null,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        anciennityStart: anciennityStart ? new Date(anciennityStart) : null,
        contractId: contractId || null,
        createdBy: session.user.id,
      },
    })

    revalidatePath(`/companies/${companyId}`)
    return { data: companyPerson }
  } catch (error) {
    console.error('createCompanyPerson error:', error)
    return { error: 'Tilknytning kunne ikke oprettes — prøv igen eller kontakt support' }
  }
}

export async function updateCompanyPerson(
  input: z.infer<typeof updateCompanyPersonSchema>
): Promise<ActionResult<CompanyPerson>> {
  const session = await auth()
  if (!session?.user) return { error: 'Ikke autoriseret' }

  const parsed = updateCompanyPersonSchema.safeParse(input)
  if (!parsed.success) {
    const firstError = parsed.error.errors[0]
    return { error: firstError?.message ?? 'Ugyldigt input' }
  }

  const { companyPersonId, companyId, role, employmentType, startDate, endDate, anciennityStart } =
    parsed.data

  const hasAccess = await canAccessCompany(session.user.id, companyId)
  if (!hasAccess) return { error: 'Du har ikke adgang til dette selskab' }

  try {
    const existing = await prisma.companyPerson.findFirst({
      where: {
        id: companyPersonId,
        companyId,
        organizationId: session.user.organizationId,
      },
    })
    if (!existing) return { error: 'Tilknytning ikke fundet' }

    const updated = await prisma.companyPerson.update({
      where: { id: companyPersonId },
      data: {
        role: role ?? undefined,
        employmentType: employmentType !== undefined ? employmentType || null : undefined,
        startDate:
          startDate !== undefined ? (startDate ? new Date(startDate) : null) : undefined,
        endDate:
          endDate !== undefined ? (endDate ? new Date(endDate) : null) : undefined,
        anciennityStart:
          anciennityStart !== undefined
            ? anciennityStart
              ? new Date(anciennityStart)
              : null
            : undefined,
      },
    })

    revalidatePath(`/companies/${companyId}`)
    return { data: updated }
  } catch (error) {
    console.error('updateCompanyPerson error:', error)
    return { error: 'Tilknytning kunne ikke opdateres — prøv igen' }
  }
}

export async function deleteCompanyPerson(
  input: z.infer<typeof deleteCompanyPersonSchema>
): Promise<ActionResult<{ id: string }>> {
  const session = await auth()
  if (!session?.user) return { error: 'Ikke autoriseret' }

  const parsed = deleteCompanyPersonSchema.safeParse(input)
  if (!parsed.success) return { error: 'Ugyldigt input' }

  const { companyPersonId, companyId } = parsed.data

  const hasAccess = await canAccessCompany(session.user.id, companyId)
  if (!hasAccess) return { error: 'Du har ikke adgang til dette selskab' }

  try {
    const existing = await prisma.companyPerson.findFirst({
      where: {
        id: companyPersonId,
        companyId,
        organizationId: session.user.organizationId,
      },
    })
    if (!existing) return { error: 'Tilknytning ikke fundet' }

    await prisma.companyPerson.delete({
      where: { id: companyPersonId },
    })

    revalidatePath(`/companies/${companyId}`)
    return { data: { id: companyPersonId } }
  } catch (error) {
    console.error('deleteCompanyPerson error:', error)
    return { error: 'Tilknytning kunne ikke slettes — prøv igen' }
  }
}

export async function listCompanyPersons(
  input: z.infer<typeof listCompanyPersonsSchema>
): Promise<ActionResult<CompanyPersonWithPerson[]>> {
  const session = await auth()
  if (!session?.user) return { error: 'Ikke autoriseret' }

  const parsed = listCompanyPersonsSchema.safeParse(input)
  if (!parsed.success) return { error: 'Ugyldigt selskabs-ID' }

  const { companyId, role } = parsed.data

  const hasAccess = await canAccessCompany(session.user.id, companyId)
  if (!hasAccess) return { error: 'Du har ikke adgang til dette selskab' }

  try {
    const persons = await prisma.companyPerson.findMany({
      where: {
        companyId,
        organizationId: session.user.organizationId,
        ...(role ? { role } : {}),
      },
      include: {
        person: true,
        contract: true,
      },
      orderBy: [{ role: 'asc' }, { createdAt: 'desc' }],
    })

    return { data: persons as CompanyPersonWithPerson[] }
  } catch (error) {
    console.error('listCompanyPersons error:', error)
    return { error: 'Tilknytninger kunne ikke hentes — prøv igen' }
  }
}

// ==================== AKTIVITETSLOG ====================

export async function getActivityLog(
  input: z.infer<typeof getActivityLogSchema>
): Promise<ActionResult<{ entries: ActivityLogEntry[]; total: number }>> {
  const session = await auth()
  if (!session?.user) return { error: 'Ikke autoriseret' }

  const parsed = getActivityLogSchema.safeParse(input)
  if (!parsed.success) return { error: 'Ugyldigt input' }

  const { companyId, limit, offset } = parsed.data

  const hasAccess = await canAccessCompany(session.user.id, companyId)
  if (!hasAccess) return { error: 'Du har ikke adgang til dette selskab' }

  try {
    const [entries, total] = await Promise.all([
      prisma.auditLog.findMany({
        where: {
          organizationId: session.user.organizationId,
          resourceType: 'company',
          resourceId: companyId,
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.auditLog.count({
        where: {
          organizationId: session.user.organizationId,
          resourceType: 'company',
          resourceId: companyId,
        },
      }),
    ])

    return { data: { entries, total } }
  } catch (error) {
    console.error('getActivityLog error:', error)
    return { error: 'Aktivitetslog kunne ikke hentes — prøv igen' }
  }
}

// ==================== HJÆLPEFUNKTIONER ====================

export async function getPersonsForOrganization(): Promise<
  ActionResult<{ id: string; firstName: string; lastName: string; email: string | null }[]>
> {
  const session = await auth()
  if (!session?.user) return { error: 'Ikke autoriseret' }

  try {
    const persons = await prisma.person.findMany({
      where: {
        organizationId: session.user.organizationId,
        deletedAt: null,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    })

    return { data: persons }
  } catch (error) {
    console.error('getPersonsForOrganization error:', error)
    return { error: 'Personer kunne ikke hentes — prøv igen' }
  }
}