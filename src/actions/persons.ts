'use server'

import type { CompanyPerson, Ownership, Person, Prisma } from '@prisma/client'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { recordAuditEvent } from '@/lib/audit'
import { auth } from '@/lib/auth'
import { formatShortDate } from '@/lib/date-helpers'
import { prisma } from '@/lib/db'
import { getCompanyPersonRoleLabel, getInitials } from '@/lib/labels'
import { captureError } from '@/lib/logger'
import { parsePaginationParams } from '@/lib/pagination'
import {
  canAccessCompany,
  canAccessModule,
  canAccessSensitivity,
  getAccessibleCompanies,
} from '@/lib/permissions'
import { checkActionRateLimit } from '@/lib/rate-limit'
import {
  createPersonSchema,
  updatePersonSchema,
  type CreatePersonInput,
  type UpdatePersonInput,
} from '@/lib/validations/person'
import type { ActionResult } from '@/types/actions'

// ────────────────────────────────────────────────────────────────────────────
// getPersonsPaginated — server-side pagineret liste til /persons
// RBAC-filteret (accessible companies) flyttes ind i WHERE-klausulen
// så paginering tæller korrekt og vi undgår at fetche al data.
// ────────────────────────────────────────────────────────────────────────────

export interface PersonRow {
  id: string
  ini: string
  navn: string
  rolle: string
  rawRole: string | null
  selskab: string
  companyId: string | null
  ansat: string
  ansatSort: number
  status: string
  sens: string
  email: string | null
  phone: string | null
  selskabsCount: number
}

export interface PersonPaginationParams {
  page?: number
  pageSize?: number
  search?: string
  status?: string
  rolle?: string
  company?: string
}

export async function getPersonsPaginated(
  params: PersonPaginationParams
): Promise<{ rows: PersonRow[]; totalCount: number; page: number; pageSize: number }> {
  const session = await auth()
  if (!session) return { rows: [], totalCount: 0, page: 1, pageSize: 15 }

  const orgId = session.user.organizationId
  const userId = session.user.id
  const { page, skip, take } = parsePaginationParams(
    String(params.page ?? 1),
    params.pageSize ?? 15
  )

  const companyIds = await getAccessibleCompanies(userId, orgId)

  // Byg WHERE-klausulen — RBAC-filter i DB, ikke post-fetch
  const where: Prisma.PersonWhereInput = {
    organization_id: orgId,
    deleted_at: null,
    // Person vises hvis: ingen selskabsrelation (orphan) ELLER relation til accessible selskab
    OR: [
      { company_persons: { none: {} } },
      { company_persons: { some: { company_id: { in: companyIds } } } },
    ],
  }

  if (params.search?.trim()) {
    const q = params.search.trim()
    where.AND = [
      {
        OR: [
          { first_name: { contains: q, mode: 'insensitive' } },
          { last_name: { contains: q, mode: 'insensitive' } },
          { email: { contains: q, mode: 'insensitive' } },
        ],
      },
    ]
  }

  const [rawPersons, totalCount] = await Promise.all([
    prisma.person.findMany({
      where,
      include: {
        company_persons: {
          include: { company: { select: { id: true, name: true } } },
          orderBy: { start_date: 'desc' },
        },
      },
      orderBy: [{ first_name: 'asc' }, { last_name: 'asc' }],
      skip,
      take,
    }),
    prisma.person.count({ where }),
  ])

  const rows: PersonRow[] = rawPersons.map((p) => {
    const activeCp = p.company_persons.find((cp) => !cp.end_date) ?? p.company_persons[0]
    const role = activeCp?.role ?? null
    const status = activeCp == null ? 'Inaktiv' : activeCp.end_date ? 'Opsagt' : 'Aktiv'
    const uniqueCompanies = new Set(
      p.company_persons.filter((cp) => !cp.end_date).map((cp) => cp.company.id)
    )

    return {
      id: p.id,
      ini: getInitials(p.first_name, p.last_name),
      navn: `${p.first_name} ${p.last_name}`,
      rolle: role ? getCompanyPersonRoleLabel(role) : '—',
      rawRole: role,
      selskab: activeCp?.company.name ?? '—',
      companyId: activeCp?.company.id ?? null,
      ansat: activeCp?.start_date ? formatShortDate(activeCp.start_date) : '—',
      ansatSort: activeCp?.start_date?.getTime() ?? 0,
      status,
      sens: 'STANDARD',
      email: p.email,
      phone: p.phone,
      selskabsCount: uniqueCompanies.size,
    }
  })

  return { rows, totalCount, page, pageSize: take }
}

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
  if (!session) return { error: 'Din session er udløbet — log ind igen.' }

  const parsed = createPersonSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Ugyldigt input' }

  if (!(await canAccessModule(session.user.id, 'persons', session.user.organizationId))) {
    return { error: 'Du har ikke adgang til persondatabasen' }
  }

  const rl = await checkActionRateLimit(session.user.organizationId)
  if (rl.limited) return { error: 'For mange handlinger. Vent venligst.' }

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
  if (!session) return { error: 'Din session er udløbet — log ind igen.' }

  const parsed = updatePersonSchema.safeParse(input)
  if (!parsed.success) return { error: 'Udfyld alle påkrævede felter og prøv igen.' }

  if (!(await canAccessModule(session.user.id, 'persons', session.user.organizationId))) {
    return { error: 'Du har ikke adgang til persondatabasen' }
  }

  const rlUpd = await checkActionRateLimit(session.user.organizationId)
  if (rlUpd.limited) return { error: 'For mange handlinger. Vent venligst.' }

  // Tenant isolation
  const existing = await prisma.person.findFirst({
    where: {
      id: parsed.data.personId,
      organization_id: session.user.organizationId,
      deleted_at: null,
    },
    select: { id: true },
  })
  if (!existing) return { error: 'Person ikke fundet' }

  try {
    const person = await prisma.person.update({
      where: { id: parsed.data.personId, organization_id: session.user.organizationId },
      data: {
        ...(parsed.data.firstName && { first_name: parsed.data.firstName }),
        ...(parsed.data.lastName && { last_name: parsed.data.lastName }),
        ...(parsed.data.email !== undefined && { email: parsed.data.email || null }),
        ...(parsed.data.phone !== undefined && { phone: parsed.data.phone || null }),
        ...(parsed.data.notes !== undefined && { notes: parsed.data.notes || null }),
      },
    })

    await recordAuditEvent({
      organizationId: session.user.organizationId,
      userId: session.user.id,
      action: 'UPDATE',
      resourceType: 'person',
      resourceId: parsed.data.personId,
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
  if (!session) return { error: 'Din session er udløbet — log ind igen.' }

  const hasAccess = await canAccessModule(session.user.id, 'settings', session.user.organizationId)
  if (!hasAccess)
    return { error: 'Du har ikke adgang til denne funktion. Kontakt din administrator.' }

  const rlDel = await checkActionRateLimit(session.user.organizationId)
  if (rlDel.limited) return { error: 'For mange handlinger. Vent venligst.' }

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
    where: { id: personId, organization_id: session.user.organizationId, deleted_at: null },
    select: { id: true },
  })
  if (!person) return { error: 'Person ikke fundet' }

  try {
    await prisma.person.update({
      where: { id: personId, organization_id: session.user.organizationId },
      data: { deleted_at: new Date() },
    })

    await recordAuditEvent({
      organizationId: session.user.organizationId,
      userId: session.user.id,
      action: 'DELETE',
      resourceType: 'person',
      resourceId: personId,
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

export async function searchPersons(query: string, limit = 10): Promise<ActionResult<Person[]>> {
  const session = await auth()
  if (!session) return { error: 'Din session er udløbet — log ind igen.' }

  if (query.length < 2) return { data: [] }

  const organizationId = session.user.organizationId

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
  if (!session) return { error: 'Din session er udløbet — log ind igen.' }

  const parsed = addPersonRoleSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Ugyldigt input' }

  // Tjek selskabsadgang
  const hasCompanyAccess = await canAccessCompany(
    session.user.id,
    parsed.data.companyId,
    session.user.organizationId
  )
  if (!hasCompanyAccess) return { error: 'Ingen adgang til dette selskab' }

  const rlRole = await checkActionRateLimit(session.user.organizationId)
  if (rlRole.limited) return { error: 'For mange handlinger. Vent venligst.' }

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
  if (!session) return { error: 'Din session er udløbet — log ind igen.' }

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

  const rlOwn = await checkActionRateLimit(session.user.organizationId)
  if (rlOwn.limited) return { error: 'For mange handlinger. Vent venligst.' }

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

// ─────────────────────────────────────────────────────────────────────────────
// Page-data queries (flyt Prisma-kald ud af page.tsx)
// ─────────────────────────────────────────────────────────────────────────────

export type RawPersonDetail = Awaited<ReturnType<typeof getRawPersonDetail>>

async function getRawPersonDetail(personId: string, orgId: string) {
  return prisma.person.findFirst({
    where: {
      id: personId,
      organization_id: orgId,
      deleted_at: null,
    },
    include: {
      company_persons: {
        include: {
          company: { select: { id: true, name: true } },
          contract: {
            select: {
              id: true,
              display_name: true,
              system_type: true,
              status: true,
              expiry_date: true,
            },
          },
        },
        orderBy: { start_date: 'desc' },
      },
      contract_parties: {
        include: {
          contract: {
            select: {
              id: true,
              display_name: true,
              system_type: true,
              status: true,
              expiry_date: true,
              company: { select: { id: true, name: true } },
            },
          },
        },
      },
      ownerships: {
        include: {
          company: { select: { id: true, name: true } },
          contract: { select: { id: true, status: true } },
        },
        orderBy: { effective_date: 'desc' },
      },
      case_persons: {
        include: {
          case: { select: { id: true, title: true, case_number: true, status: true } },
        },
      },
    },
  })
}

export interface PersonDetailPageData {
  person: NonNullable<RawPersonDetail>
  accessibleCompanies: Array<{ id: string; name: string }>
  isAdmin: boolean
}

export async function getPersonDetailPageData(
  personId: string
): Promise<PersonDetailPageData | null> {
  const session = await auth()
  if (!session) return null

  const orgId = session.user.organizationId

  const hasPersonsAccess = await canAccessModule(session.user.id, 'persons', orgId)
  if (!hasPersonsAccess) return null

  const isAdmin = await canAccessModule(session.user.id, 'settings', orgId)

  const person = await getRawPersonDetail(personId, orgId)
  if (!person) return null

  const accessibleCompanyIds = await getAccessibleCompanies(session.user.id, orgId)
  const accessibleCompanies = await prisma.company.findMany({
    where: {
      id: { in: accessibleCompanyIds },
      organization_id: orgId,
      deleted_at: null,
    },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  })

  return { person, accessibleCompanies, isAdmin }
}

export async function getPersonFullName(personId: string): Promise<string> {
  const session = await auth()
  if (!session) return 'Person'
  const person = await prisma.person.findFirst({
    where: { id: personId, organization_id: session.user.organizationId, deleted_at: null },
    select: { first_name: true, last_name: true },
  })
  if (!person) return 'Person'
  return `${person.first_name} ${person.last_name}`
}
