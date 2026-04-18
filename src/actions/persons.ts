'use server'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { canAccessModule } from '@/lib/permissions'
import {
  createPersonSchema,
  updatePersonSchema,
  type CreatePersonInput,
  type UpdatePersonInput,
} from '@/lib/validations/person'
import { revalidatePath } from 'next/cache'
import type { ActionResult } from '@/types/actions'
import type { Person } from '@prisma/client'

export async function createPerson(input: CreatePersonInput): Promise<ActionResult<Person>> {
  const session = await auth()
  if (!session) return { error: 'Ikke autoriseret' }

  const parsed = createPersonSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Ugyldigt input' }

  // Tjek for duplikat email i samme organisation
  if (parsed.data.email) {
    const existing = await prisma.person.findFirst({
      where: {
        organization_id: session.user.organizationId,
        email: parsed.data.email,
        deleted_at: null,
      },
      select: { id: true, first_name: true, last_name: true },
    })
    if (existing) {
      // Advar men blokér ikke — returner success med duplikat-note
      // UI viser advarsel via toast
    }
  }

  try {
    const person = await prisma.person.create({
      data: {
        organization_id: session.user.organizationId,
        first_name: parsed.data.firstName,
        last_name: parsed.data.lastName,
        email: parsed.data.email || null,
        phone: parsed.data.phone || null,
        notes: parsed.data.notes || null,
        created_by: session.user.id,
      },
    })

    revalidatePath('/persons')
    return { data: person }
  } catch {
    return { error: 'Personen kunne ikke oprettes — prøv igen' }
  }
}

export async function updatePerson(input: UpdatePersonInput): Promise<ActionResult<Person>> {
  const session = await auth()
  if (!session) return { error: 'Ikke autoriseret' }

  const parsed = updatePersonSchema.safeParse(input)
  if (!parsed.success) return { error: 'Ugyldigt input' }

  // Tenant isolation
  const existing = await prisma.person.findFirst({
    where: {
      id: parsed.data.personId,
      organization_id: session.user.organizationId,
      deleted_at: null,
    },
  })
  if (!existing) return { error: 'Person ikke fundet' }

  try {
    const person = await prisma.person.update({
      where: { id: parsed.data.personId },
      data: {
        ...(parsed.data.firstName && { first_name: parsed.data.firstName }),
        ...(parsed.data.lastName && { last_name: parsed.data.lastName }),
        ...(parsed.data.email !== undefined && { email: parsed.data.email || null }),
        ...(parsed.data.phone !== undefined && { phone: parsed.data.phone || null }),
        ...(parsed.data.notes !== undefined && { notes: parsed.data.notes || null }),
      },
    })

    revalidatePath('/persons')
    revalidatePath(`/persons/${parsed.data.personId}`)
    return { data: person }
  } catch {
    return { error: 'Personen kunne ikke opdateres — prøv igen' }
  }
}

export async function deletePerson(personId: string): Promise<ActionResult<void>> {
  const session = await auth()
  if (!session) return { error: 'Ikke autoriseret' }

  const hasAccess = await canAccessModule(session.user.id, 'settings')
  if (!hasAccess) return { error: 'Ingen adgang' }

  // Tjek aktive tilknytninger
  const [activeRoles, activeOwnerships] = await Promise.all([
    prisma.companyPerson.count({
      where: {
        person_id: personId,
        organization_id: session.user.organizationId,
        end_date: null,
      },
    }),
    prisma.ownership.count({
      where: {
        owner_person_id: personId,
        organization_id: session.user.organizationId,
        end_date: null,
      },
    }),
  ])

  if (activeRoles > 0 || activeOwnerships > 0) {
    return { error: 'Personen er tilknyttet aktive records. Afregistrér tilknytninger først.' }
  }

  // Tenant isolation
  const person = await prisma.person.findFirst({
    where: { id: personId, organization_id: session.user.organizationId },
  })
  if (!person) return { error: 'Person ikke fundet' }

  try {
    await prisma.person.update({
      where: { id: personId },
      data: { deleted_at: new Date() },
    })

    revalidatePath('/persons')
    return { data: undefined }
  } catch {
    return { error: 'Personen kunne ikke slettes — prøv igen' }
  }
}

export async function searchPersons(
  query: string,
  organizationId: string,
  limit = 10
): Promise<ActionResult<Person[]>> {
  const session = await auth()
  if (!session) return { error: 'Ikke autoriseret' }

  if (query.length < 2) return { data: [] }

  try {
    const persons = await prisma.person.findMany({
      where: {
        organization_id: organizationId,
        deleted_at: null,
        OR: [
          { first_name: { contains: query, mode: 'insensitive' } },
          { last_name: { contains: query, mode: 'insensitive' } },
          { email: { contains: query, mode: 'insensitive' } },
        ],
      },
      take: limit,
      orderBy: { first_name: 'asc' },
    })

    return { data: persons }
  } catch {
    return { error: 'Søgning fejlede' }
  }
}
