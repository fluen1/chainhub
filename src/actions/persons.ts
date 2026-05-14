'use server'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { canAccessCompany, canAccessModule, canAccessSensitivity } from '@/lib/permissions'
import {
  createPersonSchema,
  updatePersonSchema,
  type CreatePersonInput,
  type UpdatePersonInput,
} from '@/lib/validations/person'
import { revalidatePath } from 'next/cache'
import type { ActionResult } from '@/types/actions'
import type { CompanyPerson, Ownership, Person } from '@prisma/client'
import { captureError } from '@/lib/logger'
import { recordAuditEvent } from '@/lib/audit'
import { z } from 'zod'

// ─── Zod schemas for nye actions ───────────────────────────────────────────

const addPersonRoleSchema = z.object({
  personId: z.string().min(1),
  companyId: z.string().min(1),
  role: z.string().min(1),
  startDate: z.string().optional(),
  note: z.string().optional(),
})

const addPersonOwnershipSchema = z.object({
  personId: z.string().min(1),
  companyId: z.string().min(1),
  sharePercent: z.coerce.number().min(0.01).max(100),
  acquiredDate: z.string().optional(),
  note: z.string().optional(),
})

export type AddPersonRoleInput = z.infer<typeof addPersonRoleSchema>
export type AddPersonOwnershipInput = z.infer<typeof addPersonOwnershipSchema>

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
  } catch (err) {
    captureError(err, {
      namespace: 'action:createPerson',
      extra: { firstName: parsed.data.firstName, lastName: parsed.data.lastName },
    })
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
  } catch (err) {
    captureError(err, {
      namespace: 'action:updatePerson',
      extra: { personId: parsed.data.personId },
    })
    return { error: 'Personen kunne ikke opdateres — prøv igen' }
  }
}

export async function deletePerson(personId: string): Promise<ActionResult<void>> {
  const session = await auth()
  if (!session) return { error: 'Ikke autoriseret' }

  const hasAccess = await canAccessModule(session.user.id, 'settings', session.user.organizationId)
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
  } catch (err) {
    captureError(err, {
      namespace: 'action:deletePerson',
      extra: { personId },
    })
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
  } catch (err) {
    captureError(err, {
      namespace: 'action:searchPersons',
      extra: { query },
    })
    return { error: 'Søgning fejlede' }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// addPersonRole — tilknyt person til selskab med en bestemt rolle.
// ─────────────────────────────────────────────────────────────────────────────

export async function addPersonRole(
  input: AddPersonRoleInput
): Promise<ActionResult<CompanyPerson>> {
  const session = await auth()
  if (!session) return { error: 'Ikke autoriseret' }

  const parsed = addPersonRoleSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Ugyldigt input' }

  // Tjek selskabsadgang
  const hasCompanyAccess = await canAccessCompany(
    session.user.id,
    parsed.data.companyId,
    session.user.organizationId
  )
  if (!hasCompanyAccess) return { error: 'Ingen adgang til dette selskab' }

  // Verificér at personen tilhører organisationen
  const person = await prisma.person.findFirst({
    where: {
      id: parsed.data.personId,
      organization_id: session.user.organizationId,
      deleted_at: null,
    },
    select: { id: true },
  })
  if (!person) return { error: 'Person ikke fundet' }

  try {
    const companyPerson = await prisma.companyPerson.create({
      data: {
        organization_id: session.user.organizationId,
        company_id: parsed.data.companyId,
        person_id: parsed.data.personId,
        role: parsed.data.role,
        start_date: parsed.data.startDate ? new Date(parsed.data.startDate) : new Date(),
        created_by: session.user.id,
      },
    })

    await recordAuditEvent({
      organizationId: session.user.organizationId,
      userId: session.user.id,
      action: 'CREATE',
      resourceType: 'company_person',
      resourceId: companyPerson.id,
      resourceCompanyId: parsed.data.companyId,
      sensitivity: 'STANDARD',
      changes: {
        personId: parsed.data.personId,
        companyId: parsed.data.companyId,
        role: parsed.data.role,
      },
    })

    revalidatePath(`/persons/${parsed.data.personId}`)
    revalidatePath(`/companies/${parsed.data.companyId}`)
    return { data: companyPerson }
  } catch (err) {
    captureError(err, {
      namespace: 'action:addPersonRole',
      extra: { personId: parsed.data.personId, companyId: parsed.data.companyId },
    })
    return { error: 'Rolle kunne ikke tilføjes — prøv igen' }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// addPersonOwnership — registrér ejerskab for person i selskab.
// ─────────────────────────────────────────────────────────────────────────────

export async function addPersonOwnership(
  input: AddPersonOwnershipInput
): Promise<ActionResult<Ownership>> {
  const session = await auth()
  if (!session) return { error: 'Ikke autoriseret' }

  const parsed = addPersonOwnershipSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Ugyldigt input' }

  // Ejerskab kræver selskabsadgang
  const hasCompanyAccess = await canAccessCompany(
    session.user.id,
    parsed.data.companyId,
    session.user.organizationId
  )
  if (!hasCompanyAccess) return { error: 'Ingen adgang til dette selskab' }

  // Ejerskab er STRENGT_FORTROLIG
  const hasSensitivityAccess = await canAccessSensitivity(
    session.user.id,
    'STRENGT_FORTROLIG',
    session.user.organizationId
  )
  if (!hasSensitivityAccess) return { error: 'Du har ikke adgang til at registrere ejerskab' }

  // Verificér at personen tilhører organisationen
  const person = await prisma.person.findFirst({
    where: {
      id: parsed.data.personId,
      organization_id: session.user.organizationId,
      deleted_at: null,
    },
    select: { id: true },
  })
  if (!person) return { error: 'Person ikke fundet' }

  try {
    const ownership = await prisma.ownership.create({
      data: {
        organization_id: session.user.organizationId,
        company_id: parsed.data.companyId,
        owner_person_id: parsed.data.personId,
        ownership_pct: parsed.data.sharePercent,
        effective_date: parsed.data.acquiredDate ? new Date(parsed.data.acquiredDate) : null,
        created_by: session.user.id,
      },
    })

    await recordAuditEvent({
      organizationId: session.user.organizationId,
      userId: session.user.id,
      action: 'CREATE',
      resourceType: 'ownership',
      resourceId: ownership.id,
      resourceCompanyId: parsed.data.companyId,
      sensitivity: 'STRENGT_FORTROLIG',
      changes: {
        personId: parsed.data.personId,
        companyId: parsed.data.companyId,
        ownershipPct: parsed.data.sharePercent,
      },
    })

    revalidatePath(`/persons/${parsed.data.personId}`)
    revalidatePath(`/companies/${parsed.data.companyId}`)
    return { data: ownership }
  } catch (err) {
    captureError(err, {
      namespace: 'action:addPersonOwnership',
      extra: { personId: parsed.data.personId, companyId: parsed.data.companyId },
    })
    return { error: 'Ejerskab kunne ikke registreres — prøv igen' }
  }
}
