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
      },
      include: {
        ownerships: {
          where: {
            companyId: companyId,
          },
          include: {
            ownerPerson: true,
          },
          orderBy: { ownershipPct: 'desc' },
        },
        companyPersons: {
          where: {
            companyId: companyId,
          },
          include: {
            person: true,
          },
          orderBy: { role: 'asc' },
        },
      },
    })

    if (!company) return { error: 'Selskab ikke fundet' }

    await prisma.auditLog.create({
      data: {
        organizationId: session.user.organizationId,
        userId: session.user.id,
        action: 'VIEW',
        resourceType: 'company',
        resourceId: companyId,
      },
    })

    return { data: company as CompanyWithRelations }
  } catch (error) {
    console.error('getCompany error:', error)
    return { error: 'Selskab kunne ikke hentes' }
  }
}

export async function listCompanies(): Promise<ActionResult<CompanyWithCounts[]>> {
  const session = await auth()
  if (!session?.user) return { error: 'Ikke autoriseret' }

  try {
    const companies = await prisma.company.findMany({
      where: {
        organizationId: session.user.organizationId,
      },
      include: {
        _count: {
          select: {
            ownerships: true,
            companyPersons: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    })

    return { data: companies as CompanyWithCounts[] }
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
      where: { id: companyId },
      data: {
        name,
        cvr: cvr || null,
        companyType: companyType || null,
        address: address || null,
        city: city || null,
        postalCode: postalCode || null,
        foundedDate: foundedDate ? new Date(foundedDate) : null,
        status,
        notes: notes || null,
        updatedBy: session.user.id,
      },
    })

    await prisma.auditLog.create({
      data: {
        organizationId: session.user.organizationId,
        userId: session.user.id,
        action: 'UPDATE',
        resourceType: 'company',
        resourceId: companyId,
      },
    })

    revalidatePath(`/companies/${companyId}`)
    revalidatePath('/companies')
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
    await prisma.company.delete({
      where: { id: companyId },
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

// ==================== EJERSKAB CRUD ====================

export async function listOwnerships(
  input: z.infer<typeof listOwnershipsSchema>
): Promise<ActionResult<OwnershipWithPerson[]>> {
  const session = await auth()
  if (!session?.user) return { error: 'Ikke autoriseret' }

  const parsed = listOwnershipsSchema.safeParse(input)
  if (!parsed.success) return { error: 'Ugyldigt input' }

  const { companyId } = parsed.data

  const hasAccess = await canAccessCompany(session.user.id, companyId)
  if (!hasAccess) return { error: 'Adgang nægtet' }

  try {
    const ownerships = await prisma.ownership.findMany({
      where: {
        companyId,
      },
      include: {
        ownerPerson: true,
      },
      orderBy: { ownershipPct: 'desc' },
    })

    return { data: ownerships as OwnershipWithPerson[] }
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

  const { companyId, ownerType, ownerPersonId, ownerCompanyId, ownershipPct, shareClass, effectiveDate, contractId } =
    parsed.data

  const hasAccess = await canAccessCompany(session.user.id, companyId)
  if (!hasAccess) return { error: 'Adgang nægtet' }

  try {
    const ownership = await prisma.ownership.create({
      data: {
        organizationId: session.user.organizationId,
        companyId,
        ownerPersonId: ownerType === 'person' ? (ownerPersonId || null) : null,
        ownerCompanyId: ownerType === 'company' ? (ownerCompanyId || null) : null,
        ownershipPct,
        shareClass: shareClass || null,
        effectiveDate: effectiveDate ? new Date(effectiveDate) : null,
        contractId: contractId || null,
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

  const { id, ownershipPct, shareClass, effectiveDate, contractId } = parsed.data

  try {
    const existing = await prisma.ownership.findUnique({ where: { id } })
    if (!existing) return { error: 'Ejerskab ikke fundet' }

    const hasAccess = await canAccessCompany(session.user.id, existing.companyId)
    if (!hasAccess) return { error: 'Adgang nægtet' }

    const ownership = await prisma.ownership.update({
      where: { id },
      data: {
        ...(ownershipPct !== undefined && { ownershipPct }),
        ...(shareClass !== undefined && { shareClass: shareClass || null }),
        ...(effectiveDate !== undefined && { effectiveDate: effectiveDate ? new Date(effectiveDate) : null }),
        ...(contractId !== undefined && { contractId: contractId || null }),
        updatedBy: session.user.id,
      },
    })

    await prisma.auditLog.create({
      data: {
        organizationId: session.user.organizationId,
        userId: session.user.id,
        action: 'UPDATE',
        resourceType: 'ownership',
        resourceId: id,
      },
    })

    revalidatePath(`/companies/${existing.companyId}`)
    return { data: ownership }
  } catch (error) {
    console.error('updateOwnership error:', error)
    return { error: 'Ejerskab kunne ikke opdateres' }
  }
}

export async function deleteOwnership(
  input: z.infer<typeof deleteOwnershipSchema> | string
): Promise<ActionResult<{ id: string }>> {
  const session = await auth()
  if (!session?.user) return { error: 'Ikke autoriseret' }

  const hasWriteAccess = await canWrite(session.user.id)
  if (!hasWriteAccess) return { error: 'Du har ikke skriveadgang' }

  // Support both object input and plain string id
  let ownershipId: string
  let companyId: string | undefined

  if (typeof input === 'string') {
    ownershipId = input
  } else {
    const parsed = deleteOwnershipSchema.safeParse(input)
    if (!parsed.success) return { error: 'Ugyldigt input' }
    ownershipId = parsed.data.ownershipId
    companyId = parsed.data.companyId
  }

  try {
    const existing = await prisma.ownership.findUnique({ where: { id: ownershipId } })
    if (!existing) return { error: 'Ejerskab ikke fundet' }

    const resolvedCompanyId = companyId || existing.companyId
    const hasAccess = await canAccessCompany(session.user.id, resolvedCompanyId)
    if (!hasAccess) return { error: 'Adgang nægtet' }

    await prisma.ownership.delete({ where: { id: ownershipId } })

    await prisma.auditLog.create({
      data: {
        organizationId: session.user.organizationId,
        userId: session.user.id,
        action: 'DELETE',
        resourceType: 'ownership',
        resourceId: ownershipId,
      },
    })

    revalidatePath(`/companies/${resolvedCompanyId}`)
    return { data: { id: ownershipId } }
  } catch (error) {
    console.error('deleteOwnership error:', error)
    return { error: 'Ejerskab kunne ikke slettes' }
  }
}

// ==================== COMPANY PERSON CRUD ====================

export async function listCompanyPersons(
  input: z.infer<typeof listCompanyPersonsSchema>
): Promise<ActionResult<CompanyPersonWithPerson[]>> {
  const session = await auth()
  if (!session?.user) return { error: 'Ikke autoriseret' }

  const parsed = listCompanyPersonsSchema.safeParse(input)
  if (!parsed.success) return { error: 'Ugyldigt input' }

  const { companyId } = parsed.data

  const hasAccess = await canAccessCompany(session.user.id, companyId)
  if (!hasAccess) return { error: 'Adgang nægtet' }

  try {
    const companyPersons = await prisma.companyPerson.findMany({
      where: {
        companyId,
      },
      include: {
        person: true,
      },
      orderBy: { role: 'asc' },
    })

    return { data: companyPersons as CompanyPersonWithPerson[] }
  } catch (error) {
    console.error('listCompanyPersons error:', error)
    return { error: 'Personer kunne ikke hentes' }
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

  try {
    const companyPerson = await prisma.companyPerson.create({
      data: {
        organizationId: session.user.organizationId,
        companyId,
        personId,
        role,
        employmentType: employmentType || null,
        startDate: startDate || null,
        endDate: endDate || null,
        anciennityStart: anciennityStart || null,
        contractId: contractId || null,
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

    revalidatePath(`/companies/${companyId}`)
    return { data: companyPerson }
  } catch (error) {
    console.error('createCompanyPerson error:', error)
    return { error: 'Person kunne ikke tilføjes' }
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

  const { id, role, employmentType, startDate, endDate, anciennityStart, contractId } = parsed.data as any

  try {
    const existing = await prisma.companyPerson.findUnique({ where: { id } })
    if (!existing) return { error: 'Person ikke fundet' }

    const hasAccess = await canAccessCompany(session.user.id, existing.companyId)
    if (!hasAccess) return { error: 'Adgang nægtet' }

    const companyPerson = await prisma.companyPerson.update({
      where: { id },
      data: {
        ...(role !== undefined && { role }),
        ...(employmentType !== undefined && { employmentType: employmentType || null }),
        ...(startDate !== undefined && { startDate: startDate || null }),
        ...(endDate !== undefined && { endDate: endDate || null }),
        ...(anciennityStart !== undefined && { anciennityStart: anciennityStart || null }),
        ...(contractId !== undefined && { contractId: contractId || null }),
        updatedBy: session.user.id,
      },
    })

    await prisma.auditLog.create({
      data: {
        organizationId: session.user.organizationId,
        userId: session.user.id,
        action: 'UPDATE',
        resourceType: 'company_person',
        resourceId: id,
      },
    })

    revalidatePath(`/companies/${existing.companyId}`)
    return { data: companyPerson }
  } catch (error) {
    console.error('updateCompanyPerson error:', error)
    return { error: 'Person kunne ikke opdateres' }
  }
}

export async function deleteCompanyPerson(
  input: z.infer<typeof deleteCompanyPersonSchema> | string
): Promise<ActionResult<{ id: string }>> {
  const session = await auth()
  if (!session?.user) return { error: 'Ikke autoriseret' }

  const hasWriteAccess = await canWrite(session.user.id)
  if (!hasWriteAccess) return { error: 'Du har ikke skriveadgang' }

  // Support both object input and plain string id
  let companyPersonId: string
  let companyId: string | undefined

  if (typeof input === 'string') {
    companyPersonId = input
  } else {
    const parsed = deleteCompanyPersonSchema.safeParse(input)
    if (!parsed.success) return { error: 'Ugyldigt input' }
    companyPersonId = parsed.data.companyPersonId
    companyId = parsed.data.companyId
  }

  try {
    const existing = await prisma.companyPerson.findUnique({ where: { id: companyPersonId } })
    if (!existing) return { error: 'Person ikke fundet' }

    const resolvedCompanyId = companyId || existing.companyId
    const hasAccess = await canAccessCompany(session.user.id, resolvedCompanyId)
    if (!hasAccess) return { error: 'Adgang nægtet' }

    await prisma.companyPerson.delete({ where: { id: companyPersonId } })

    await prisma.auditLog.create({
      data: {
        organizationId: session.user.organizationId,
        userId: session.user.id,
        action: 'DELETE',
        resourceType: 'company_person',
        resourceId: companyPersonId,
      },
    })

    revalidatePath(`/companies/${resolvedCompanyId}`)
    return { data: { id: companyPersonId } }
  } catch (error) {
    console.error('deleteCompanyPerson error:', error)
    return { error: 'Person kunne ikke fjernes' }
  }
}

// ==================== ACTIVITY LOG ====================

export async function getActivityLog(
  input: z.infer<typeof getActivityLogSchema>
): Promise<ActionResult<{ entries: ActivityLogEntry[]; total: number }>> {
  const session = await auth()
  if (!session?.user) return { error: 'Ikke autoriseret' }

  const parsed = getActivityLogSchema.safeParse(input)
  if (!parsed.success) return { error: 'Ugyldigt input' }

  const { companyId, limit, offset } = parsed.data

  const hasAccess = await canAccessCompany(session.user.id, companyId)
  if (!hasAccess) return { error: 'Adgang nægtet' }

  try {
    const [entries, total] = await Promise.all([
      prisma.auditLog.findMany({
        where: {
          organizationId: session.user.organizationId,
          resourceId: companyId,
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        include: {
          user: {
            select: { id: true, name: true, email: true },
          },
        },
      }),
      prisma.auditLog.count({
        where: {
          organizationId: session.user.organizationId,
          resourceId: companyId,
        },
      }),
    ])

    return {
      data: {
        entries: entries as unknown as ActivityLogEntry[],
        total,
      },
    }
  } catch (error) {
    console.error('getActivityLog error:', error)
    return { error: 'Aktivitetslog kunne ikke hentes' }
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
    return { error: 'Personer kunne ikke hentes' }
  }
}