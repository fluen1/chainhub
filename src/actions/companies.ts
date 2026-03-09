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

  // SIKKERHED (PENTEST-001 / DEC-047): Readonly-brugere må ikke oprette
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
          include: {
            ownerPerson: true,
            ownerCompany: true,
          },
        },
        companyPersons: {
          where: { deletedAt: null },
          include: {
            person: true,
          },
        },
      },
    })

    if (!company) return { error: 'Selskabet blev ikke fundet' }

    return { data: company as unknown as CompanyWithRelations }
  } catch (error) {
    console.error('getCompany error:', error)
    return { error: 'Selskabet kunne ikke hentes' }
  }
}

export async function listCompanies(input?: {
  search?: string
  status?: string
  companyType?: string
}): Promise<ActionResult<CompanyWithCounts[]>> {
  const session = await auth()
  if (!session?.user) return { error: 'Ikke autoriseret' }

  try {
    const companies = await prisma.company.findMany({
      where: {
        organizationId: session.user.organizationId,
        deletedAt: null,
        ...(input?.search
          ? {
              OR: [
                { name: { contains: input.search, mode: 'insensitive' } },
                { cvr: { contains: input.search, mode: 'insensitive' } },
              ],
            }
          : {}),
        ...(input?.status ? { status: input.status } : {}),
        ...(input?.companyType ? { companyType: input.companyType } : {}),
      },
      include: {
        _count: {
          select: {
            ownerships: { where: { deletedAt: null } },
            companyPersons: { where: { deletedAt: null } },
          },
        },
      },
      orderBy: { name: 'asc' },
    })

    return { data: companies as unknown as CompanyWithCounts[] }
  } catch (error) {
    console.error('listCompanies error:', error)
    return { error: 'Selskaberne kunne ikke hentes' }
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
        ...(name !== undefined ? { name } : {}),
        ...(cvr !== undefined ? { cvr: cvr || null } : {}),
        ...(companyType !== undefined ? { companyType: companyType || null } : {}),
        ...(address !== undefined ? { address: address || null } : {}),
        ...(city !== undefined ? { city: city || null } : {}),
        ...(postalCode !== undefined ? { postalCode: postalCode || null } : {}),
        ...(foundedDate !== undefined
          ? { foundedDate: foundedDate ? new Date(foundedDate) : null }
          : {}),
        ...(status !== undefined ? { status } : {}),
        ...(notes !== undefined ? { notes: notes || null } : {}),
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
): Promise<ActionResult<void>> {
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
      where: { id: companyId },
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
    return { data: undefined }
  } catch (error) {
    console.error('deleteCompany error:', error)
    return { error: 'Selskabet kunne ikke slettes' }
  }
}

// ==================== OWNERSHIP ====================

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
        ownerPersonId: ownerType === 'person' ? ownerPersonId || null : null,
        ownerCompanyId: ownerType === 'company' ? ownerCompanyId || null : null,
        ownershipPct,
        shareClass: shareClass || null,
        effectiveDate: effectiveDate ? new Date(effectiveDate) : null,
        contractId: contractId || null,
      },
    })

    revalidatePath(`/companies/${companyId}`)
    return { data: ownership }
  } catch (error) {
    console.error('createOwnership error:', error)
    return { error: 'Ejerskabet kunne ikke oprettes' }
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
    if (!existing) return { error: 'Ejerskabet blev ikke fundet' }

    const hasAccess = await canAccessCompany(session.user.id, existing.companyId)
    if (!hasAccess) return { error: 'Adgang nægtet' }

    const ownership = await prisma.ownership.update({
      where: { id },
      data: {
        ...(ownershipPct !== undefined ? { ownershipPct } : {}),
        ...(shareClass !== undefined ? { shareClass: shareClass || null } : {}),
        ...(effectiveDate !== undefined
          ? { effectiveDate: effectiveDate ? new Date(effectiveDate) : null }
          : {}),
        ...(contractId !== undefined ? { contractId: contractId || null } : {}),
      },
    })

    revalidatePath(`/companies/${existing.companyId}`)
    return { data: ownership }
  } catch (error) {
    console.error('updateOwnership error:', error)
    return { error: 'Ejerskabet kunne ikke opdateres' }
  }
}

export async function deleteOwnership(
  id: string
): Promise<ActionResult<void>> {
  const session = await auth()
  if (!session?.user) return { error: 'Ikke autoriseret' }

  const hasWriteAccess = await canWrite(session.user.id)
  if (!hasWriteAccess) return { error: 'Du har ikke skriveadgang' }

  try {
    const existing = await prisma.ownership.findUnique({ where: { id } })
    if (!existing) return { error: 'Ejerskabet blev ikke fundet' }

    const hasAccess = await canAccessCompany(session.user.id, existing.companyId)
    if (!hasAccess) return { error: 'Adgang nægtet' }

    await prisma.ownership.update({
      where: { id },
      data: { deletedAt: new Date() },
    })

    revalidatePath(`/companies/${existing.companyId}`)
    return { data: undefined }
  } catch (error) {
    console.error('deleteOwnership error:', error)
    return { error: 'Ejerskabet kunne ikke slettes' }
  }
}

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
        organizationId: session.user.organizationId,
        deletedAt: null,
      },
      include: {
        ownerPerson: true,
        ownerCompany: true,
      },
    })

    return { data: ownerships as unknown as OwnershipWithPerson[] }
  } catch (error) {
    console.error('listOwnerships error:', error)
    return { error: 'Ejerskaber kunne ikke hentes' }
  }
}

// ==================== COMPANY PERSON ====================

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
        personId: personId || '',
        role: role || '',
        employmentType: employmentType || null,
        startDate: startDate || null,
        endDate: endDate || null,
        anciennityStart: anciennityStart || null,
        contractId: contractId || null,
      },
    })

    revalidatePath(`/companies/${companyId}`)
    return { data: companyPerson }
  } catch (error) {
    console.error('createCompanyPerson error:', error)
    return { error: 'Tilknytningen kunne ikke oprettes' }
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

  const { id, role, employmentType, startDate, endDate, anciennityStart, contractId } = parsed.data

  try {
    const existing = await prisma.companyPerson.findUnique({ where: { id } })
    if (!existing) return { error: 'Tilknytningen blev ikke fundet' }

    const hasAccess = await canAccessCompany(session.user.id, existing.companyId)
    if (!hasAccess) return { error: 'Adgang nægtet' }

    const companyPerson = await prisma.companyPerson.update({
      where: { id },
      data: {
        ...(role !== undefined ? { role } : {}),
        ...(employmentType !== undefined ? { employmentType: employmentType || null } : {}),
        ...(startDate !== undefined ? { startDate: startDate || null } : {}),
        ...(endDate !== undefined ? { endDate: endDate || null } : {}),
        ...(anciennityStart !== undefined ? { anciennityStart: anciennityStart || null } : {}),
        ...(contractId !== undefined ? { contractId: contractId || null } : {}),
      },
    })

    revalidatePath(`/companies/${existing.companyId}`)
    return { data: companyPerson }
  } catch (error) {
    console.error('updateCompanyPerson error:', error)
    return { error: 'Tilknytningen kunne ikke opdateres' }
  }
}

export async function deleteCompanyPerson(
  id: string
): Promise<ActionResult<void>> {
  const session = await auth()
  if (!session?.user) return { error: 'Ikke autoriseret' }

  const hasWriteAccess = await canWrite(session.user.id)
  if (!hasWriteAccess) return { error: 'Du har ikke skriveadgang' }

  try {
    const existing = await prisma.companyPerson.findUnique({ where: { id } })
    if (!existing) return { error: 'Tilknytningen blev ikke fundet' }

    const hasAccess = await canAccessCompany(session.user.id, existing.companyId)
    if (!hasAccess) return { error: 'Adgang nægtet' }

    await prisma.companyPerson.update({
      where: { id },
      data: { deletedAt: new Date() },
    })

    revalidatePath(`/companies/${existing.companyId}`)
    return { data: undefined }
  } catch (error) {
    console.error('deleteCompanyPerson error:', error)
    return { error: 'Tilknytningen kunne ikke slettes' }
  }
}

export async function listCompanyPersons(
  input: z.infer<typeof listCompanyPersonsSchema>
): Promise<ActionResult<CompanyPersonWithPerson[]>> {
  const session = await auth()
  if (!session?.user) return { error: 'Ikke autoriseret' }

  const parsed = listCompanyPersonsSchema.safeParse(input)
  if (!parsed.success) return { error: 'Ugyldigt input' }

  const { companyId, role } = parsed.data

  const hasAccess = await canAccessCompany(session.user.id, companyId)
  if (!hasAccess) return { error: 'Adgang nægtet' }

  try {
    const persons = await prisma.companyPerson.findMany({
      where: {
        companyId,
        organizationId: session.user.organizationId,
        deletedAt: null,
        ...(role ? { role: { contains: role, mode: 'insensitive' } } : {}),
      },
      include: {
        person: true,
      },
    })

    return { data: persons as unknown as CompanyPersonWithPerson[] }
  } catch (error) {
    console.error('listCompanyPersons error:', error)
    return { error: 'Personer kunne ikke hentes' }
  }
}

export async function getActivityLog(
  input: z.infer<typeof getActivityLogSchema>
): Promise<ActionResult<ActivityLogEntry[]>> {
  const session = await auth()
  if (!session?.user) return { error: 'Ikke autoriseret' }

  const parsed = getActivityLogSchema.safeParse(input)
  if (!parsed.success) return { error: 'Ugyldigt input' }

  const { companyId, limit = 50, offset = 0 } = parsed.data

  const hasAccess = await canAccessCompany(session.user.id, companyId)
  if (!hasAccess) return { error: 'Adgang nægtet' }

  try {
    const logs = await prisma.auditLog.findMany({
      where: {
        organizationId: session.user.organizationId,
        resourceType: 'company',
        resourceId: companyId,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    })

    return { data: logs as unknown as ActivityLogEntry[] }
  } catch (error) {
    console.error('getActivityLog error:', error)
    return { error: 'Aktivitetslog kunne ikke hentes' }
  }
}