'use server'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { canAccessCompany, canAccessModule, canEdit, getAccessibleCompanies } from '@/lib/permissions'
import { revalidatePath } from 'next/cache'
import {
  createPersonSchema,
  updatePersonSchema,
  personSearchSchema,
  linkPersonToCompanySchema,
  updatePersonCompanyLinkSchema,
  importOutlookContactsSchema,
  CreatePersonInput,
  UpdatePersonInput,
  PersonSearchInput,
  LinkPersonToCompanyInput,
  UpdatePersonCompanyLinkInput,
  ImportOutlookContactsInput,
} from '@/lib/validations/person'
import {
  ActionResult,
  PersonWithCompanies,
  PersonListItem,
  CompanyPersonWithDetails,
  OutlookImportResult,
} from '@/types/person'
import { Person, CompanyPerson } from '@prisma/client'

// ==================== PERSONER ====================

export async function createPerson(
  input: CreatePersonInput
): Promise<ActionResult<Person>> {
  const session = await auth()
  if (!session?.user?.id || !session?.user?.organizationId) {
    return { error: 'Ikke autoriseret' }
  }

  const canAccess = await canAccessModule(session.user.id, 'persons')
  if (!canAccess) {
    return { error: 'Du har ikke adgang til personmodulet' }
  }

  const canEditData = await canEdit(session.user.id)
  if (!canEditData) {
    return { error: 'Du har ikke rettigheder til at oprette personer' }
  }

  const parsed = createPersonSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message || 'Ugyldigt input' }
  }

  // Konverter tom streng til null for email
  const email = parsed.data.email === '' ? null : parsed.data.email

  try {
    const person = await prisma.person.create({
      data: {
        firstName: parsed.data.firstName,
        lastName: parsed.data.lastName,
        email,
        phone: parsed.data.phone,
        notes: parsed.data.notes,
        microsoftContactId: parsed.data.microsoftContactId,
        organizationId: session.user.organizationId,
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
    console.error('Fejl ved oprettelse af person:', error)
    return { error: 'Personen kunne ikke oprettes — prøv igen' }
  }
}

export async function updatePerson(
  input: UpdatePersonInput
): Promise<ActionResult<Person>> {
  const session = await auth()
  if (!session?.user?.id || !session?.user?.organizationId) {
    return { error: 'Ikke autoriseret' }
  }

  const parsed = updatePersonSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message || 'Ugyldigt input' }
  }

  const { id, ...data } = parsed.data

  // Verificer at personen eksisterer i samme organisation
  const existing = await prisma.person.findFirst({
    where: {
      id,
      organizationId: session.user.organizationId,
      deletedAt: null,
    },
  })

  if (!existing) {
    return { error: 'Personen blev ikke fundet' }
  }

  const canEditData = await canEdit(session.user.id)
  if (!canEditData) {
    return { error: 'Du har ikke rettigheder til at redigere personer' }
  }

  // Konverter tom streng til null for email
  const updateData = {
    ...data,
    email: data.email === '' ? null : data.email,
  }

  try {
    const person = await prisma.person.update({
      where: { id },
      data: updateData,
    })

    await prisma.auditLog.create({
      data: {
        organizationId: session.user.organizationId,
        userId: session.user.id,
        action: 'UPDATE',
        resourceType: 'person',
        resourceId: person.id,
        changes: updateData as object,
      },
    })

    revalidatePath(`/persons/${id}`)
    revalidatePath('/persons')
    return { data: person }
  } catch (error) {
    console.error('Fejl ved opdatering af person:', error)
    return { error: 'Personen kunne ikke opdateres — prøv igen' }
  }
}

export async function deletePerson(
  personId: string
): Promise<ActionResult<{ success: true }>> {
  const session = await auth()
  if (!session?.user?.id || !session?.user?.organizationId) {
    return { error: 'Ikke autoriseret' }
  }

  const existing = await prisma.person.findFirst({
    where: {
      id: personId,
      organizationId: session.user.organizationId,
      deletedAt: null,
    },
    include: {
      _count: {
        select: {
          companyPersons: true,
          ownerships: true,
          contractParties: true,
        },
      },
    },
  })

  if (!existing) {
    return { error: 'Personen blev ikke fundet' }
  }

  const canEditData = await canEdit(session.user.id)
  if (!canEditData) {
    return { error: 'Du har ikke rettigheder til at slette personer' }
  }

  // Advar hvis personen har tilknytninger
  const totalLinks =
    existing._count.companyPersons +
    existing._count.ownerships +
    existing._count.contractParties

  if (totalLinks > 0) {
    // Soft delete - personen bevares men markeres som slettet
    // Tilknytningerne bevares for historik
  }

  try {
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
    return { data: { success: true } }
  } catch (error) {
    console.error('Fejl ved sletning af person:', error)
    return { error: 'Personen kunne ikke slettes — prøv igen' }
  }
}

export async function getPerson(
  personId: string
): Promise<ActionResult<PersonWithCompanies>> {
  const session = await auth()
  if (!session?.user?.id || !session?.user?.organizationId) {
    return { error: 'Ikke autoriseret' }
  }

  const canAccess = await canAccessModule(session.user.id, 'persons')
  if (!canAccess) {
    return { error: 'Du har ikke adgang til personmodulet' }
  }

  try {
    const person = await prisma.person.findFirst({
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
          orderBy: [{ endDate: 'asc' }, { startDate: 'desc' }],
        },
      },
    })

    if (!person) {
      return { error: 'Personen blev ikke fundet' }
    }

    // Filtrer companyPersons baseret på brugerens adgang til selskaber
    const accessibleCompanies = await getAccessibleCompanies(session.user.id)
    const accessibleCompanyIds = new Set(accessibleCompanies.map((c) => c.id))

    const filteredPerson = {
      ...person,
      companyPersons: person.companyPersons.filter((cp) =>
        accessibleCompanyIds.has(cp.companyId)
      ),
    }

    await prisma.auditLog.create({
      data: {
        organizationId: session.user.organizationId,
        userId: session.user.id,
        action: 'VIEW',
        resourceType: 'person',
        resourceId: personId,
      },
    })

    return { data: filteredPerson }
  } catch (error) {
    console.error('Fejl ved hentning af person:', error)
    return { error: 'Personen kunne ikke hentes — prøv igen' }
  }
}

export async function listPersons(
  input?: PersonSearchInput
): Promise<ActionResult<PersonListItem[]>> {
  const session = await auth()
  if (!session?.user?.id || !session?.user?.organizationId) {
    return { error: 'Ikke autoriseret' }
  }

  const canAccess = await canAccessModule(session.user.id, 'persons')
  if (!canAccess) {
    return { error: 'Du har ikke adgang til personmodulet' }
  }

  const parsed = personSearchSchema.safeParse(input || {})
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message || 'Ugyldigt input' }
  }

  const { query, companyId, role, limit, offset } = parsed.data

  try {
    // Hvis companyId er angivet, tjek adgang
    if (companyId) {
      const hasAccess = await canAccessCompany(session.user.id, companyId)
      if (!hasAccess) {
        return { error: 'Du har ikke adgang til dette selskab' }
      }
    }

    // Byg where-clause
    const where: any = {
      organizationId: session.user.organizationId,
      deletedAt: null,
    }

    // Søgefilter
    if (query && query.trim()) {
      const searchTerm = query.trim()
      where.OR = [
        { firstName: { contains: searchTerm, mode: 'insensitive' } },
        { lastName: { contains: searchTerm, mode: 'insensitive' } },
        { email: { contains: searchTerm, mode: 'insensitive' } },
        { phone: { contains: searchTerm, mode: 'insensitive' } },
      ]
    }

    // Selskabsfilter
    if (companyId) {
      where.companyPersons = {
        some: {
          companyId,
        },
      }
    }

    // Rollefilter
    if (role) {
      where.companyPersons = {
        ...where.companyPersons,
        some: {
          ...where.companyPersons?.some,
          role,
        },
      }
    }

    const persons = await prisma.person.findMany({
      where,
      include: {
        companyPersons: {
          include: {
            company: {
              select: {
                id: true,
                name: true,
              },
            },
          },
          take: 5,
        },
        _count: {
          select: {
            companyPersons: true,
          },
        },
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      take: limit,
      skip: offset,
    })

    // Filtrer baseret på brugerens selskabsadgang
    const accessibleCompanies = await getAccessibleCompanies(session.user.id)
    const accessibleCompanyIds = new Set(accessibleCompanies.map((c) => c.id))

    const filteredPersons = persons.map((person) => ({
      ...person,
      companyPersons: person.companyPersons.filter((cp) =>
        accessibleCompanyIds.has(cp.companyId)
      ),
    }))

    return { data: filteredPersons }
  } catch (error) {
    console.error('Fejl ved hentning af personer:', error)
    return { error: 'Personer kunne ikke hentes — prøv igen' }
  }
}

// ==================== PERSON-SELSKAB TILKNYTNINGER ====================

export async function linkPersonToCompany(
  input: LinkPersonToCompanyInput
): Promise<ActionResult<CompanyPerson>> {
  const session = await auth()
  if (!session?.user?.id || !session?.user?.organizationId) {
    return { error: 'Ikke autoriseret' }
  }

  const parsed = linkPersonToCompanySchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message || 'Ugyldigt input' }
  }

  // Tjek adgang til selskabet
  const hasAccess = await canAccessCompany(session.user.id, parsed.data.companyId)
  if (!hasAccess) {
    return { error: 'Du har ikke adgang til dette selskab' }
  }

  const canEditData = await canEdit(session.user.id)
  if (!canEditData) {
    return { error: 'Du har ikke rettigheder til at tilknytte personer' }
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

  // Verificer at selskabet eksisterer
  const company = await prisma.company.findFirst({
    where: {
      id: parsed.data.companyId,
      organizationId: session.user.organizationId,
      deletedAt: null,
    },
  })

  if (!company) {
    return { error: 'Selskabet blev ikke fundet' }
  }

  // Tjek om tilknytningen allerede eksisterer med samme rolle
  const existingLink = await prisma.companyPerson.findFirst({
    where: {
      organizationId: session.user.organizationId,
      personId: parsed.data.personId,
      companyId: parsed.data.companyId,
      role: parsed.data.role,
      endDate: null, // Aktiv tilknytning
    },
  })

  if (existingLink) {
    return { error: 'Personen er allerede tilknyttet dette selskab med denne rolle' }
  }

  try {
    const companyPerson = await prisma.companyPerson.create({
      data: {
        organizationId: session.user.organizationId,
        personId: parsed.data.personId,
        companyId: parsed.data.companyId,
        role: parsed.data.role,
        employmentType: parsed.data.employmentType,
        startDate: parsed.data.startDate,
        endDate: parsed.data.endDate,
        anciennityStart: parsed.data.anciennityStart,
        contractId: parsed.data.contractId,
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

    revalidatePath(`/persons/${parsed.data.personId}`)
    revalidatePath(`/companies/${parsed.data.companyId}`)
    return { data: companyPerson }
  } catch (error) {
    console.error('Fejl ved tilknytning af person til selskab:', error)
    return { error: 'Tilknytningen kunne ikke oprettes — prøv igen' }
  }
}

export async function updatePersonCompanyLink(
  input: UpdatePersonCompanyLinkInput
): Promise<ActionResult<CompanyPerson>> {
  const session = await auth()
  if (!session?.user?.id || !session?.user?.organizationId) {
    return { error: 'Ikke autoriseret' }
  }

  const parsed = updatePersonCompanyLinkSchema.safeParse(input)
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
    return { error: 'Du har ikke rettigheder til at redigere tilknytninger' }
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

    revalidatePath(`/persons/${existing.personId}`)
    revalidatePath(`/companies/${existing.companyId}`)
    return { data: companyPerson }
  } catch (error) {
    console.error('Fejl ved opdatering af tilknytning:', error)
    return { error: 'Tilknytningen kunne ikke opdateres — prøv igen' }
  }
}

export async function unlinkPersonFromCompany(
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
    return { error: 'Du har ikke rettigheder til at fjerne tilknytninger' }
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

    revalidatePath(`/persons/${existing.personId}`)
    revalidatePath(`/companies/${existing.companyId}`)
    return { data: { success: true } }
  } catch (error) {
    console.error('Fejl ved fjernelse af tilknytning:', error)
    return { error: 'Tilknytningen kunne ikke fjernes — prøv igen' }
  }
}

export async function getPersonCompanyRoles(
  personId: string
): Promise<ActionResult<CompanyPersonWithDetails[]>> {
  const session = await auth()
  if (!session?.user?.id || !session?.user?.organizationId) {
    return { error: 'Ikke autoriseret' }
  }

  // Verificer at personen eksisterer
  const person = await prisma.person.findFirst({
    where: {
      id: personId,
      organizationId: session.user.organizationId,
      deletedAt: null,
    },
  })

  if (!person) {
    return { error: 'Personen blev ikke fundet' }
  }

  try {
    const companyPersons = await prisma.companyPerson.findMany({
      where: {
        organizationId: session.user.organizationId,
        personId,
      },
      include: {
        person: true,
        company: true,
        contract: true,
      },
      orderBy: [{ endDate: 'asc' }, { startDate: 'desc' }],
    })

    // Filtrer baseret på brugerens selskabsadgang
    const accessibleCompanies = await getAccessibleCompanies(session.user.id)
    const accessibleCompanyIds = new Set(accessibleCompanies.map((c) => c.id))

    const filteredCompanyPersons = companyPersons.filter((cp) =>
      accessibleCompanyIds.has(cp.companyId)
    )

    return { data: filteredCompanyPersons }
  } catch (error) {
    console.error('Fejl ved hentning af personers roller:', error)
    return { error: 'Roller kunne ikke hentes — prøv igen' }
  }
}

// ==================== OUTLOOK IMPORT ====================

export async function importOutlookContacts(
  input: ImportOutlookContactsInput
): Promise<ActionResult<OutlookImportResult>> {
  const session = await auth()
  if (!session?.user?.id || !session?.user?.organizationId) {
    return { error: 'Ikke autoriseret' }
  }

  const canAccess = await canAccessModule(session.user.id, 'persons')
  if (!canAccess) {
    return { error: 'Du har ikke adgang til personmodulet' }
  }

  const canEditData = await canEdit(session.user.id)
  if (!canEditData) {
    return { error: 'Du har ikke rettigheder til at importere kontakter' }
  }

  const parsed = importOutlookContactsSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message || 'Ugyldigt input' }
  }

  const result: OutlookImportResult = {
    imported: 0,
    skipped: 0,
    errors: [],
  }

  for (const contact of parsed.data.contacts) {
    try {
      // Tjek om kontakten allerede er importeret
      const existing = await prisma.person.findFirst({
        where: {
          organizationId: session.user.organizationId,
          microsoftContactId: contact.microsoftContactId,
          deletedAt: null,
        },
      })

      if (existing) {
        result.skipped++
        continue
      }

      // Udled navn
      let firstName = contact.givenName || ''
      let lastName = contact.surname || ''

      if (!firstName && !lastName && contact.displayName) {
        const nameParts = contact.displayName.split(' ')
        firstName = nameParts[0] || ''
        lastName = nameParts.slice(1).join(' ') || ''
      }

      if (!firstName && !lastName) {
        result.errors.push(`Kontakt uden navn blev sprunget over`)
        result.skipped++
        continue
      }

      // Hent e-mail
      const email = contact.emailAddresses?.[0]?.address || null

      // Hent telefon
      const phone = contact.mobilePhone || contact.businessPhones?.[0] || null

      await prisma.person.create({
        data: {
          firstName,
          lastName,
          email,
          phone,
          microsoftContactId: contact.microsoftContactId,
          organizationId: session.user.organizationId,
          createdBy: session.user.id,
        },
      })

      result.imported++
    } catch (error) {
      console.error('Fejl ved import af kontakt:', error)
      result.errors.push(`Kunne ikke importere kontakt: ${contact.displayName || 'Ukendt'}`)
    }
  }

  if (result.imported > 0) {
    await prisma.auditLog.create({
      data: {
        organizationId: session.user.organizationId,
        userId: session.user.id,
        action: 'CREATE',
        resourceType: 'person',
        resourceId: 'outlook_import',
        changes: {
          imported: result.imported,
          skipped: result.skipped,
        },
      },
    })

    revalidatePath('/persons')
  }

  return { data: result }
}

export async function checkOutlookConnection(): Promise<ActionResult<{ connected: boolean; email?: string }>> {
  const session = await auth()
  if (!session?.user?.id || !session?.user?.organizationId) {
    return { error: 'Ikke autoriseret' }
  }

  // Tjek om brugeren har Microsoft-tilknytning
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { microsoftId: true, email: true },
  })

  if (!user) {
    return { error: 'Bruger ikke fundet' }
  }

  return {
    data: {
      connected: !!user.microsoftId,
      email: user.email,
    },
  }
}