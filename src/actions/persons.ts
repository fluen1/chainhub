'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import {
  createPersonSchema,
  updatePersonSchema,
  createCompanyPersonSchema,
  updateCompanyPersonSchema,
  type CreatePersonInput,
  type UpdatePersonInput,
  type CreateCompanyPersonInput,
  type UpdateCompanyPersonInput,
} from '@/lib/validations/person'

type ActionResult<T = void> = { data?: T; error?: string }

// ── GET PERSONS ──────────────────────────────────────────────────────────────

export async function getPersons(): Promise<
  ActionResult<{ id: string; firstName: string; lastName: string; email: string | null; phone: string | null; createdAt: Date }[]>
> {
  try {
    const user = await getCurrentUser()
    if (!user) return { error: 'Ikke logget ind' }

    const persons = await prisma.person.findMany({
      where: { organizationId: user.organizationId },
      orderBy: { lastName: 'asc' },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        createdAt: true,
      },
    })

    return { data: persons }
  } catch (err) {
    console.error('getPersons error:', err)
    return { error: 'Kunne ikke hente personer' }
  }
}

// ── GET PERSON ───────────────────────────────────────────────────────────────

export async function getPerson(input: { id: string }): Promise<
  ActionResult<{
    id: string
    firstName: string
    lastName: string
    email: string | null
    phone: string | null
    address: string | null
    city: string | null
    postalCode: string | null
    birthDate: string | null
    nationality: string | null
    notes: string | null
    createdAt: Date
    updatedAt: Date
    companyPersons: {
      id: string
      role: string
      employmentType: string | null
      startDate: string | null
      endDate: string | null
      anciennityStart: string | null
      contractId: string | null
      company: {
        id: string
        name: string
      }
    }[]
  }>
> {
  try {
    const user = await getCurrentUser()
    if (!user) return { error: 'Ikke logget ind' }

    const person = await prisma.person.findFirst({
      where: {
        id: input.id,
        organizationId: user.organizationId,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        address: true,
        city: true,
        postalCode: true,
        birthDate: true,
        nationality: true,
        notes: true,
        createdAt: true,
        updatedAt: true,
        companyPersons: {
          where: { endDate: null },
          select: {
            id: true,
            role: true,
            employmentType: true,
            startDate: true,
            endDate: true,
            anciennityStart: true,
            contractId: true,
            company: {
              select: { id: true, name: true },
            },
          },
        },
      },
    })

    if (!person) return { error: 'Person ikke fundet' }
    return { data: person as any }
  } catch (err) {
    console.error('getPerson error:', err)
    return { error: 'Kunne ikke hente person' }
  }
}

// ── CREATE PERSON ─────────────────────────────────────────────────────────────

export async function createPerson(input: CreatePersonInput): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await getCurrentUser()
    if (!user) return { error: 'Ikke logget ind' }

    const parsed = createPersonSchema.safeParse(input)
    if (!parsed.success) return { error: parsed.error.errors[0].message }

    const { firstName, lastName, email, phone, address, city, postalCode, birthDate, nationality, notes } = parsed.data

    const person = await prisma.person.create({
      data: {
        firstName,
        lastName,
        email: email ?? null,
        phone: phone ?? null,
        address: address ?? null,
        city: city ?? null,
        postalCode: postalCode ?? null,
        birthDate: birthDate ?? null,
        nationality: nationality ?? null,
        notes: notes ?? null,
        organizationId: user.organizationId,
      },
      select: { id: true },
    })

    revalidatePath('/persons')
    return { data: person }
  } catch (err) {
    console.error('createPerson error:', err)
    return { error: 'Kunne ikke oprette person' }
  }
}

// ── UPDATE PERSON ─────────────────────────────────────────────────────────────

export async function updatePerson(input: UpdatePersonInput): Promise<ActionResult> {
  try {
    const user = await getCurrentUser()
    if (!user) return { error: 'Ikke logget ind' }

    const parsed = updatePersonSchema.safeParse(input)
    if (!parsed.success) return { error: parsed.error.errors[0].message }

    const { id, firstName, lastName, email, phone, address, city, postalCode, birthDate, nationality, notes } = parsed.data

    await prisma.person.update({
      where: { id, organizationId: user.organizationId },
      data: {
        firstName,
        lastName,
        email: email ?? null,
        phone: phone ?? null,
        address: address ?? null,
        city: city ?? null,
        postalCode: postalCode ?? null,
        birthDate: birthDate ?? null,
        nationality: nationality ?? null,
        notes: notes ?? null,
      },
    })

    revalidatePath('/persons')
    revalidatePath(`/persons/${id}`)
    return {}
  } catch (err) {
    console.error('updatePerson error:', err)
    return { error: 'Kunne ikke opdatere person' }
  }
}

// ── DELETE PERSON ─────────────────────────────────────────────────────────────

export async function deletePerson(input: { id: string }): Promise<ActionResult> {
  try {
    const user = await getCurrentUser()
    if (!user) return { error: 'Ikke logget ind' }

    // Slet tilknytninger først
    await prisma.companyPerson.deleteMany({
      where: {
        personId: input.id,
        company: { organizationId: user.organizationId },
      },
    })

    await prisma.person.delete({
      where: { id: input.id, organizationId: user.organizationId },
    })

    revalidatePath('/persons')
    return {}
  } catch (err) {
    console.error('deletePerson error:', err)
    return { error: 'Kunne ikke slette person' }
  }
}

// ── CREATE COMPANY PERSON ─────────────────────────────────────────────────────

export async function createCompanyPerson(input: CreateCompanyPersonInput): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await getCurrentUser()
    if (!user) return { error: 'Ikke logget ind' }

    const parsed = createCompanyPersonSchema.safeParse(input)
    if (!parsed.success) return { error: parsed.error.errors[0].message }

    const { role, companyId, personId, anciennityStart, contractId, employmentType, startDate, endDate } = parsed.data

    // Verificer at selskabet tilhører organisationen
    const company = await prisma.company.findFirst({
      where: { id: companyId, organizationId: user.organizationId },
      select: { id: true },
    })
    if (!company) return { error: 'Selskab ikke fundet' }

    const companyPerson = await prisma.companyPerson.create({
      data: {
        role,
        companyId,
        personId,
        anciennityStart: anciennityStart ?? null,
        contractId: contractId ?? null,
        employmentType: employmentType ?? null,
        startDate: startDate ?? null,
        endDate: endDate ?? null,
      },
      select: { id: true },
    })

    revalidatePath(`/persons/${personId}`)
    revalidatePath(`/companies/${companyId}`)
    return { data: companyPerson }
  } catch (err) {
    console.error('createCompanyPerson error:', err)
    return { error: 'Kunne ikke oprette tilknytning' }
  }
}

// ── UPDATE COMPANY PERSON ─────────────────────────────────────────────────────

export async function updateCompanyPerson(input: UpdateCompanyPersonInput): Promise<ActionResult> {
  try {
    const user = await getCurrentUser()
    if (!user) return { error: 'Ikke logget ind' }

    const parsed = updateCompanyPersonSchema.safeParse(input)
    if (!parsed.success) return { error: parsed.error.errors[0].message }

    const { companyPersonId, companyId, role, anciennityStart, employmentType, startDate, endDate } = parsed.data

    // Verificer adgang
    const existing = await prisma.companyPerson.findFirst({
      where: {
        id: companyPersonId,
        company: { organizationId: user.organizationId },
      },
      select: { id: true, personId: true },
    })
    if (!existing) return { error: 'Tilknytning ikke fundet' }

    await prisma.companyPerson.update({
      where: { id: companyPersonId },
      data: {
        role: role ?? undefined,
        anciennityStart: anciennityStart ?? null,
        employmentType: employmentType ?? null,
        startDate: startDate ?? undefined,
        endDate: endDate ?? null,
      },
    })

    revalidatePath(`/persons/${existing.personId}`)
    revalidatePath(`/companies/${companyId}`)
    return {}
  } catch (err) {
    console.error('updateCompanyPerson error:', err)
    return { error: 'Kunne ikke opdatere tilknytning' }
  }
}

// ── DELETE COMPANY PERSON ─────────────────────────────────────────────────────

export async function deleteCompanyPerson(input: { companyPersonId: string; personId: string; companyId: string }): Promise<ActionResult> {
  try {
    const user = await getCurrentUser()
    if (!user) return { error: 'Ikke logget ind' }

    // Verificer adgang
    const existing = await prisma.companyPerson.findFirst({
      where: {
        id: input.companyPersonId,
        company: { organizationId: user.organizationId },
      },
      select: { id: true },
    })
    if (!existing) return { error: 'Tilknytning ikke fundet' }

    await prisma.companyPerson.delete({
      where: { id: input.companyPersonId },
    })

    revalidatePath(`/persons/${input.personId}`)
    revalidatePath(`/companies/${input.companyId}`)
    return {}
  } catch (err) {
    console.error('deleteCompanyPerson error:', err)
    return { error: 'Kunne ikke slette tilknytning' }
  }
}