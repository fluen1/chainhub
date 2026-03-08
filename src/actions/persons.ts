'use server'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { canAccessCompany } from '@/lib/permissions'
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
import type { Person, CompanyPerson } from '@prisma/client'

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
        email: email || null,
        phone: phone || null,
        notes: notes || null,
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

    // Tjek adgang til mindst ét af personens selskaber ELLER om brugeren
    // er GROUP-niveau (de har adgang til alle personer i org)
    // Person tilhører organisationen — bekræft tenant match
    if (person.organizationId !== session.user.organizationId) {
      return { error: 'Du har ikke adgang til denne person' }
    }

    // Tjek adgang til mindst ét tilknyttet selskab hvis personen har selskaber
    if (person.companyPersons.length > 0) {
      const companyIds = person.companyPersons.map((cp) => cp.companyId)
      const accessChecks = await Promise.all(
        companyIds.map((cid) => canAccessCompany(session.user.id, cid))
      )
      const hasAnyAccess = accessChecks.some(Boolean)
      if (!hasAnyAccess) {
        return { error: 'Du har ikke adgang til denne person' }
      }
    }

    await prisma.auditLog.create({
      data: {
        organizationId: session.user.organizationId,
        userId: session.user.id,
        action: 'VIEW',
        resourceType: 'person',
        resourceId: person.id,
      },
    })

    return { data: person as PersonWithCompanies }
  } catch (error) {
    console.error('getPerson error:', error)
    return { error: 'Personen kunne ikke hentes — prøv igen' }
  }
}

export async function listPersons(
  input: z.infer<typeof listPersonsSchema>
): Promise<ActionResult<{ persons: PersonSummary[]; total: number }>> {
  const session = await auth()
  if (!session?.user) return { error: 'Ikke autoriseret' }

  const parsed = listPersonsSchema.safeParse(input)
  if (!parsed.success) return { error: 'Ugyldigt input' }

  const { search, companyId, page, pageSize } = parsed.data

  // Hvis companyId angivet — tjek adgang
  if (companyId) {
    const hasAccess = await canAccessCompany(session.user.id, companyId)
    if (!hasAccess) return { error: 'Du har ikke adgang til dette selskab' }
  }

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
                organizationId: session.user.organizationId,
              },
            },
          }
        : {}),
    }

    const [persons, total] = await Promise.all([
      prisma.person.findMany({
        where,
        include: {
          companyPersons: {
            where: {
              organizationId: session.user.organizationId,
            },
            select: {
              role: true,
              companyId: true,
            },
          },
          _count: {
            select: {
              companyPersons: true,
            },
          },
        },
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.person.count({ where }),
    ])

    const summaries: PersonSummary[] = persons.map((p) => ({
      id: p.id,
      firstName: p.firstName,
      lastName: p.lastName,
      email: p.email,
      phone: p.phone,
      companyCount: p._count.companyPersons,
      roles: [...new Set(p.companyPersons.map((cp) => cp.role))],
    }))

    return { data: { persons: summaries, total } }
  } catch (error) {
    console.error('listPersons error:', error)
    return { error: 'Personerne kunne ikke hentes — prøv igen' }
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
    // Bekræft ejerskab via organization_id
    const existing = await prisma.person.findUnique({
      where: {
        id: personId,
        organizationId: session.user.organizationId,
        deletedAt: null,
      },
    })
    if (!existing) return { error: 'Personen blev ikke fundet' }

    const person = await prisma.person.update({
      where: {
        id: personId,
        organizationId: session.user.organizationId,
      },
      data: {
        firstName: firstName ?? undefined,
        lastName: lastName ?? undefined,
        email: email !== undefined ? email || null : undefined,
        phone: phone !== undefined ? phone || null : undefined,
        notes: notes !== undefined ? notes || null : undefined,
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
    return { error: 'Personen kunne ikke opdateres — prøv igen eller kontakt support' }
  }
}

export async function deletePerson(
  input: z.infer<typeof deletePersonSchema>
): Promise<ActionResult<{ id: string }>> {
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
      where: {
        id: personId,
        organizationId: session.user.organizationId,
      },
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
    return { data: { id: personId } }
  } catch (error) {
    console.error('deletePerson error:', error)
    return { error: 'Personen kunne ikke slettes — prøv igen eller kontakt support' }
  }
}

// ==================== PERSON ↔ SELSKAB ====================

export async function addPersonToCompany(
  input: z.infer<typeof addPersonToCompanySchema>
): Promise<ActionResult<CompanyPerson>> {
  const session = await auth()
  if (!session?.user) return { error: 'Ikke autoriseret' }

  const parsed = addPersonToCompanySchema.safeParse(input)
  if (!parsed.success) {
    const firstError = parsed.error.errors[0]
    return { error: firstError?.message ?? 'Ugyldigt input' }
  }

  const { personId, companyId, role, employmentType, startDate, endDate, anciennityStart, contractId } =
    parsed.data

  // Tjek adgang til selskabet
  const hasAccess = await canAccessCompany(session.user.id, companyId)
  if (!hasAccess) return { error: 'Du har ikke adgang til dette selskab' }

  try {
    // Bekræft person tilhører organisationen
    const person = await prisma.person.findUnique({
      where: {
        id: personId,
        organizationId: session.user.organizationId,
        deletedAt: null,
      },
    })
    if (!person) return { error: 'Personen blev ikke fundet i din organisation' }

    // Bekræft selskab tilhører organisationen
    const company = await prisma.company.findUnique({
      where: {
        id: companyId,
        organizationId: session.user.organizationId,
        deletedAt: null,
      },
    })
    if (!company) return { error: 'Selskabet blev ikke fundet' }

    // Tjek om tilknytning allerede eksisterer (samme person, selskab og rolle)
    const existingLink = await prisma.companyPerson.findFirst({
      where: {
        personId,
        companyId,
        organizationId: session.user.organizationId,
        role,
      },
    })
    if (existingLink) {
      return { error: `Personen har allerede rollen "${role}" i dette selskab` }
    }

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

    revalidatePath('/persons')
    revalidatePath(`/persons/${personId}`)
    revalidatePath(`/companies/${companyId}`)
    return { data: companyPerson }
  } catch (error) {
    console.error('addPersonToCompany error:', error)
    return { error: 'Tilknytning til selskab kunne ikke oprettes — prøv igen eller kontakt support' }
  }
}

export async function removePersonFromCompany(
  input: z.infer<typeof removePersonFromCompanySchema>
): Promise<ActionResult<{ id: string }>> {
  const session = await auth()
  if (!session?.user) return { error: 'Ikke autoriseret' }

  const parsed = removePersonFromCompanySchema.safeParse(input)
  if (!parsed.success) return { error: 'Ugyldigt input' }

  const { companyPersonId, companyId } = parsed.data

  // Tjek adgang til selskabet
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
    if (!existing) return { error: 'Tilknytningen blev ikke fundet' }

    await prisma.companyPerson.delete({
      where: { id: companyPersonId },
    })

    revalidatePath('/persons')
    revalidatePath(`/persons/${existing.personId}`)
    revalidatePath(`/companies/${companyId}`)
    return { data: { id: companyPersonId } }
  } catch (error) {
    console.error('removePersonFromCompany error:', error)
    return { error: 'Tilknytning til selskab kunne ikke fjernes — prøv igen' }
  }
}

export async function updatePersonCompanyRole(
  input: z.infer<typeof updatePersonCompanyRoleSchema>
): Promise<ActionResult<CompanyPerson>> {
  const session = await auth()
  if (!session?.user) return { error: 'Ikke autoriseret' }

  const parsed = updatePersonCompanyRoleSchema.safeParse(input)
  if (!parsed.success) {
    const firstError = parsed.error.errors[0]
    return { error: firstError?.message ?? 'Ugyldigt input' }
  }

  const { companyPersonId, companyId, role, employmentType, startDate, endDate, anciennityStart } =
    parsed.data

  // Tjek adgang til selskabet
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
    if (!existing) return { error: 'Tilknytningen blev ikke fundet' }

    const updated = await prisma.companyPerson.update({
      where: { id: companyPersonId },
      data: {
        role: role ?? undefined,
        employmentType: employmentType !== undefined ? employmentType : undefined,
        startDate:
          startDate !== undefined
            ? startDate
              ? new Date(startDate)
              : null
            : undefined,
        endDate:
          endDate !== undefined
            ? endDate
              ? new Date(endDate)
              : null
            : undefined,
        anciennityStart:
          anciennityStart !== undefined
            ? anciennityStart
              ? new Date(anciennityStart)
              : null
            : undefined,
      },
    })

    revalidatePath('/persons')
    revalidatePath(`/persons/${existing.personId}`)
    revalidatePath(`/companies/${companyId}`)
    return { data: updated }
  } catch (error) {
    console.error('updatePersonCompanyRole error:', error)
    return { error: 'Rollen kunne ikke opdateres — prøv igen' }
  }
}

// ==================== OUTLOOK IMPORT ====================

export async function importOutlookContacts(
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

  let imported = 0
  let skipped = 0
  const errors: string[] = []

  for (const contact of contacts) {
    try {
      // Tjek om kontakten allerede er importeret (via microsoftContactId)
      const existing = await prisma.person.findFirst({
        where: {
          organizationId: session.user.organizationId,
          microsoftContactId: contact.microsoftContactId,
          deletedAt: null,
        },
      })

      if (existing) {
        // Opdater eksisterende
        await prisma.person.update({
          where: {
            id: existing.id,
            organizationId: session.user.organizationId,
          },
          data: {
            firstName: contact.firstName,
            lastName: contact.lastName,
            email: contact.email || null,
            phone: contact.phone || null,
          },
        })
        skipped++
        continue
      }

      // Tjek om e-mail allerede bruges
      if (contact.email) {
        const emailExists = await prisma.person.findFirst({
          where: {
            organizationId: session.user.organizationId,
            email: contact.email,
            deletedAt: null,
          },
        })

        if (emailExists) {
          skipped++
          errors.push(
            `${contact.firstName} ${contact.lastName}: E-mail ${contact.email} er allerede i brug`
          )
          continue
        }
      }

      await prisma.person.create({
        data: {
          organizationId: session.user.organizationId,
          firstName: contact.firstName,
          lastName: contact.lastName,
          email: contact.email || null,
          phone: contact.phone || null,
          microsoftContactId: contact.microsoftContactId,
          createdBy: session.user.id,
        },
      })

      imported++
    } catch (error) {
      console.error('importOutlookContacts single contact error:', error)
      errors.push(
        `${contact.firstName} ${contact.lastName}: Kunne ikke importeres`
      )
    }
  }

  revalidatePath('/persons')

  await prisma.auditLog.create({
    data: {
      organizationId: session.user.organizationId,
      userId: session.user.id,
      action: 'CREATE',
      resourceType: 'person',
      resourceId: 'outlook-import-batch',
      changes: { imported, skipped, errors: errors.length },
    },
  })

  return { data: { imported, skipped, errors } }
}

export async function getPersonsForCompany(
  companyId: string
): Promise<
  ActionResult<
    { id: string; firstName: string; lastName: string; email: string | null; role: string }[]
  >
> {
  const session = await auth()
  if (!session?.user) return { error: 'Ikke autoriseret' }

  // Tjek adgang til selskabet
  const hasAccess = await canAccessCompany(session.user.id, companyId)
  if (!hasAccess) return { error: 'Du har ikke adgang til dette selskab' }

  try {
    const companyPersons = await prisma.companyPerson.findMany({
      where: {
        companyId,
        organizationId: session.user.organizationId,
      },
      include: {
        person: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
      orderBy: [{ role: 'asc' }],
    })

    const result = companyPersons.map((cp) => ({
      id: cp.person.id,
      firstName: cp.person.firstName,
      lastName: cp.person.lastName,
      email: cp.person.email,
      role: cp.role,
    }))

    return { data: result }
  } catch (error) {
    console.error('getPersonsForCompany error:', error)
    return { error: 'Personerne kunne ikke hentes — prøv igen' }
  }
}