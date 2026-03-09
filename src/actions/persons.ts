'use server'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import {
  createPersonSchema,
  updatePersonSchema,
  deletePersonSchema,
  getPersonSchema,
  listPersonsSchema,
  addPersonToCompanySchema,
  removePersonFromCompanySchema,
  updatePersonCompanyRoleSchema,
  importOutlookContactsBatchSchema,
} from '@/lib/validations/person'
import type {
  ActionResult,
  PersonWithCompanies,
  PersonSummary,
  OutlookImportResult,
} from '@/types/person'
import type { Person } from '@prisma/client'

// ==================== PERSON CRUD ====================

export async function createPerson(
  input: z.infer<typeof createPersonSchema>
): Promise<ActionResult<Person>> {
  const session = await auth()
  if (!session?.user) return { error: 'Ikke autoriseret' }

  const parsed = createPersonSchema.safeParse(input)
  if (!parsed.success) {
    const firstError = parsed.error.errors[0]
    return { error: firstError?.message ?? 'Ugyldigt input' }
  }

  const { firstName, lastName, email, phone, notes } = parsed.data

  try {
    const person = await prisma.person.create({
      data: {
        organizationId: session.user.organizationId,
        firstName,
        lastName,
        email: email ?? null,
        phone: phone ?? null,
        notes: notes ?? null,
        createdBy: session.user.id,
      },
    })

    await prisma.auditLog.create({
      data: {
        organizationId: session.user.organizationId,
        userId: session.user.id,
        action: 'CREATE',
        resourceType: 'person',
        resourceId: person.id,
      },
    })

    revalidatePath('/persons')
    return { data: person }
  } catch (error) {
    console.error('createPerson error:', error)
    return { error: 'Personen kunne ikke oprettes — prøv igen eller kontakt support' }
  }
}

export async function getPerson(
  input: z.infer<typeof getPersonSchema>
): Promise<ActionResult<PersonWithCompanies>> {
  const session = await auth()
  if (!session?.user) return { error: 'Ikke autoriseret' }

  const parsed = getPersonSchema.safeParse(input)
  if (!parsed.success) return { error: 'Ugyldigt person-ID' }

  const { personId } = parsed.data

  try {
    const person = await prisma.person.findUnique({
      where: {
        id: personId,
        organizationId: session.user.organizationId,
        deletedAt: null,
      },
      include: {
        companyPersons: {
          include: {
            company: true,
            contract: true,
          },
          orderBy: { createdAt: 'desc' },
        },
        _count: {
          select: {
            companyPersons: true,
            contractParties: true,
            ownerships: true,
          },
        },
      },
    })

    if (!person) return { error: 'Personen blev ikke fundet' }

    return { data: person as unknown as PersonWithCompanies }
  } catch (error) {
    console.error('getPerson error:', error)
    return { error: 'Personen kunne ikke hentes' }
  }
}

export async function listPersons(
  input: z.infer<typeof listPersonsSchema>
): Promise<ActionResult<PersonSummary[]>> {
  const session = await auth()
  if (!session?.user) return { error: 'Ikke autoriseret' }

  const parsed = listPersonsSchema.safeParse(input)
  if (!parsed.success) return { error: 'Ugyldigt input' }

  const { search, companyId, page = 1, pageSize = 50 } = parsed.data

  try {
    const where = {
      organizationId: session.user.organizationId,
      deletedAt: null,
      ...(search
        ? {
            OR: [
              { firstName: { contains: search, mode: 'insensitive' as const } },
              { lastName: { contains: search, mode: 'insensitive' as const } },
              { email: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
      ...(companyId
        ? {
            companyPersons: {
              some: {
                companyId,
                deletedAt: null,
              },
            },
          }
        : {}),
    }

    const persons = await prisma.person.findMany({
      where,
      include: {
        _count: {
          select: { companyPersons: true },
        },
        companyPersons: {
          where: { deletedAt: null },
          include: { company: { select: { id: true, name: true } } },
          take: 3,
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    })

    return { data: persons as unknown as PersonSummary[] }
  } catch (error) {
    console.error('listPersons error:', error)
    return { error: 'Personlisten kunne ikke hentes' }
  }
}

export async function updatePerson(
  input: z.infer<typeof updatePersonSchema>
): Promise<ActionResult<Person>> {
  const session = await auth()
  if (!session?.user) return { error: 'Ikke autoriseret' }

  const parsed = updatePersonSchema.safeParse(input)
  if (!parsed.success) {
    const firstError = parsed.error.errors[0]
    return { error: firstError?.message ?? 'Ugyldigt input' }
  }

  const { personId, firstName, lastName, email, phone, notes } = parsed.data

  try {
    const existing = await prisma.person.findUnique({
      where: {
        id: personId,
        organizationId: session.user.organizationId,
        deletedAt: null,
      },
    })

    if (!existing) return { error: 'Personen blev ikke fundet' }

    const person = await prisma.person.update({
      where: { id: personId },
      data: {
        ...(firstName !== undefined && { firstName }),
        ...(lastName !== undefined && { lastName }),
        ...(email !== undefined && { email: email ?? null }),
        ...(phone !== undefined && { phone: phone ?? null }),
        ...(notes !== undefined && { notes: notes ?? null }),
        updatedAt: new Date(),
      },
    })

    await prisma.auditLog.create({
      data: {
        organizationId: session.user.organizationId,
        userId: session.user.id,
        action: 'UPDATE',
        resourceType: 'person',
        resourceId: person.id,
      },
    })

    revalidatePath('/persons')
    revalidatePath(`/persons/${personId}`)
    return { data: person }
  } catch (error) {
    console.error('updatePerson error:', error)
    return { error: 'Personen kunne ikke opdateres' }
  }
}

export async function deletePerson(
  input: z.infer<typeof deletePersonSchema>
): Promise<ActionResult<{ deleted: boolean }>> {
  const session = await auth()
  if (!session?.user) return { error: 'Ikke autoriseret' }

  const parsed = deletePersonSchema.safeParse(input)
  if (!parsed.success) return { error: 'Ugyldigt person-ID' }

  const { personId } = parsed.data

  try {
    const existing = await prisma.person.findUnique({
      where: {
        id: personId,
        organizationId: session.user.organizationId,
        deletedAt: null,
      },
    })

    if (!existing) return { error: 'Personen blev ikke fundet' }

    await prisma.person.update({
      where: { id: personId },
      data: { deletedAt: new Date() },
    })

    await prisma.auditLog.create({
      data: {
        organizationId: session.user.organizationId,
        userId: session.user.id,
        action: 'DELETE',
        resourceType: 'person',
        resourceId: personId,
      },
    })

    revalidatePath('/persons')
    return { data: { deleted: true } }
  } catch (error) {
    console.error('deletePerson error:', error)
    return { error: 'Personen kunne ikke slettes' }
  }
}

export async function addPersonToCompany(
  input: z.infer<typeof addPersonToCompanySchema>
): Promise<ActionResult<{ id: string }>> {
  const session = await auth()
  if (!session?.user) return { error: 'Ikke autoriseret' }

  const parsed = addPersonToCompanySchema.safeParse(input)
  if (!parsed.success) {
    const firstError = parsed.error.errors[0]
    return { error: firstError?.message ?? 'Ugyldigt input' }
  }

  const { personId, companyId, role, title, startDate, endDate, contractId } = parsed.data

  try {
    // Verificer at selskabet tilhører organisationen
    const company = await prisma.company.findUnique({
      where: {
        id: companyId,
        organizationId: session.user.organizationId,
        deletedAt: null,
      },
    })
    if (!company) return { error: 'Selskabet blev ikke fundet' }

    // Verificer at personen tilhører organisationen
    const person = await prisma.person.findUnique({
      where: {
        id: personId,
        organizationId: session.user.organizationId,
        deletedAt: null,
      },
    })
    if (!person) return { error: 'Personen blev ikke fundet' }

    const companyPerson = await prisma.companyPerson.create({
      data: {
        organizationId: session.user.organizationId,
        personId,
        companyId,
        role,
        title: title ?? null,
        startDate: startDate ?? null,
        endDate: endDate ?? null,
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

    revalidatePath(`/persons/${personId}`)
    revalidatePath(`/companies/${companyId}`)
    return { data: { id: companyPerson.id } }
  } catch (error) {
    console.error('addPersonToCompany error:', error)
    return { error: 'Tilknytningen kunne ikke oprettes' }
  }
}

export async function removePersonFromCompany(
  input: z.infer<typeof removePersonFromCompanySchema>
): Promise<ActionResult<{ removed: boolean }>> {
  const session = await auth()
  if (!session?.user) return { error: 'Ikke autoriseret' }

  const parsed = removePersonFromCompanySchema.safeParse(input)
  if (!parsed.success) return { error: 'Ugyldigt input' }

  const { companyPersonId } = parsed.data

  try {
    const existing = await prisma.companyPerson.findUnique({
      where: {
        id: companyPersonId,
        organizationId: session.user.organizationId,
        deletedAt: null,
      },
    })

    if (!existing) return { error: 'Tilknytningen blev ikke fundet' }

    await prisma.companyPerson.update({
      where: { id: companyPersonId },
      data: { deletedAt: new Date() },
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

    revalidatePath('/persons')
    return { data: { removed: true } }
  } catch (error) {
    console.error('removePersonFromCompany error:', error)
    return { error: 'Tilknytningen kunne ikke fjernes' }
  }
}

export async function updatePersonCompanyRole(
  input: z.infer<typeof updatePersonCompanyRoleSchema>
): Promise<ActionResult<{ id: string }>> {
  const session = await auth()
  if (!session?.user) return { error: 'Ikke autoriseret' }

  const parsed = updatePersonCompanyRoleSchema.safeParse(input)
  if (!parsed.success) {
    const firstError = parsed.error.errors[0]
    return { error: firstError?.message ?? 'Ugyldigt input' }
  }

  const { companyPersonId, role, title, startDate, endDate } = parsed.data

  try {
    const existing = await prisma.companyPerson.findUnique({
      where: {
        id: companyPersonId,
        organizationId: session.user.organizationId,
        deletedAt: null,
      },
    })

    if (!existing) return { error: 'Tilknytningen blev ikke fundet' }

    const updated = await prisma.companyPerson.update({
      where: { id: companyPersonId },
      data: {
        ...(role !== undefined && { role }),
        ...(title !== undefined && { title: title ?? null }),
        ...(startDate !== undefined && { startDate: startDate ?? null }),
        ...(endDate !== undefined && { endDate: endDate ?? null }),
        updatedAt: new Date(),
      },
    })

    await prisma.auditLog.create({
      data: {
        organizationId: session.user.organizationId,
        userId: session.user.id,
        action: 'UPDATE',
        resourceType: 'companyPerson',
        resourceId: companyPersonId,
      },
    })

    revalidatePath('/persons')
    return { data: { id: updated.id } }
  } catch (error) {
    console.error('updatePersonCompanyRole error:', error)
    return { error: 'Rollen kunne ikke opdateres' }
  }
}

export async function importOutlookContactsBatch(
  input: z.infer<typeof importOutlookContactsBatchSchema>
): Promise<ActionResult<OutlookImportResult>> {
  const session = await auth()
  if (!session?.user) return { error: 'Ikke autoriseret' }

  const parsed = importOutlookContactsBatchSchema.safeParse(input)
  if (!parsed.success) {
    const firstError = parsed.error.errors[0]
    return { error: firstError?.message ?? 'Ugyldigt input' }
  }

  const { contacts } = parsed.data

  let created = 0
  let skipped = 0
  let failed = 0
  const errors: string[] = []

  for (const contact of contacts) {
    try {
      // Tjek om personen allerede eksisterer (via email)
      if (contact.email) {
        const existing = await prisma.person.findFirst({
          where: {
            email: contact.email,
            organizationId: session.user.organizationId,
            deletedAt: null,
          },
        })
        if (existing) {
          skipped++
          continue
        }
      }

      await prisma.person.create({
        data: {
          organizationId: session.user.organizationId,
          firstName: contact.firstName,
          lastName: contact.lastName,
          email: contact.email ?? null,
          phone: contact.phone ?? null,
          notes: contact.notes ?? null,
          createdBy: session.user.id,
        },
      })
      created++
    } catch (err) {
      console.error('importOutlookContactsBatch item error:', err)
      failed++
      errors.push(`${contact.firstName} ${contact.lastName}: Import fejlede`)
    }
  }

  await prisma.auditLog.create({
    data: {
      organizationId: session.user.organizationId,
      userId: session.user.id,
      action: 'IMPORT',
      resourceType: 'person',
      resourceId: session.user.organizationId,
      metadata: { created, skipped, failed },
    },
  })

  revalidatePath('/persons')
  return {
    data: {
      created,
      skipped,
      failed,
      errors,
    },
  }
}