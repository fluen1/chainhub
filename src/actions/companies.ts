import 'server-only'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import {
  createCompanySchema,
  updateCompanySchema,
  createOwnershipSchema,
  updateOwnershipSchema,
  createCompanyPersonSchema,
  updateCompanyPersonSchema,
} from '@/lib/validations/company'
import type {
  CreateCompanyInput,
  UpdateCompanyInput,
  CreateOwnershipInput,
  UpdateOwnershipInput,
  CreateCompanyPersonInput,
  UpdateCompanyPersonInput,
} from '@/lib/validations/company'

// ─── Hjælpefunktioner ────────────────────────────────────────────────────────

async function getOrganizationId(): Promise<string> {
  const session = await auth()
  if (!session?.user?.organizationId) throw new Error('Ikke autentificeret')
  return session.user.organizationId
}

async function getUserId(): Promise<string> {
  const session = await auth()
  if (!session?.user?.id) throw new Error('Ikke autentificeret')
  return session.user.id
}

type ActionResult<T> = { data: T; error?: never } | { data?: never; error: string }

// ─── Selskaber ────────────────────────────────────────────────────────────────

export async function getCompanies(params?: {
  search?: string
  status?: string
  limit?: number
  offset?: number
}) {
  try {
    const organizationId = await getOrganizationId()
    const userId = await getUserId()

    const { search, status, limit = 50, offset = 0 } = params ?? {}

    // Hent bruger for at tjekke scope
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
      },
    })

    if (!user) throw new Error('Bruger ikke fundet')

    const where: any = {
      organizationId,
      deletedAt: null,
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { cvr: { contains: search, mode: 'insensitive' } },
      ]
    }

    if (status) {
      where.status = status
    }

    const [companies, total] = await Promise.all([
      prisma.company.findMany({
        where,
        skip: offset,
        take: limit,
        orderBy: { name: 'asc' },
        include: {
          _count: {
            select: {
              ownerships: true,
              companyPersons: true,
              contracts: true,
            },
          },
        },
      }),
      prisma.company.count({ where }),
    ])

    return { data: { companies, total }, error: undefined }
  } catch (err) {
    console.error('[getCompanies]', err)
    return { data: undefined, error: 'Kunne ikke hente selskaber' }
  }
}

export async function getCompany(companyId: string) {
  try {
    const organizationId = await getOrganizationId()
    const userId = await getUserId()

    const company = await prisma.company.findFirst({
      where: {
        id: companyId,
        organizationId,
        deletedAt: null,
      },
      include: {
        ownerships: {
          where: {
            deletedAt: null,
          },
          include: {
            ownerPerson: true,
            ownerCompany: true,
          },
          orderBy: { ownershipPct: 'desc' },
        },
        companyPersons: {
          where: {
            deletedAt: null,
          },
          include: {
            person: true,
          },
          orderBy: { role: 'asc' },
        },
        contracts: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
        _count: {
          select: {
            ownerships: true,
            companyPersons: true,
            contracts: true,
          },
        },
      },
    })

    if (!company) {
      return { data: undefined, error: 'Selskab ikke fundet' }
    }

    // Log visning
    await prisma.activityLog.create({
      data: {
        organizationId,
        userId,
        action: 'VIEW',
        resourceType: 'company',
        resourceId: companyId,
      },
    })

    return { data: company, error: undefined }
  } catch (err) {
    console.error('[getCompany]', err)
    return { data: undefined, error: 'Kunne ikke hente selskab' }
  }
}

export async function createCompany(input: CreateCompanyInput): Promise<ActionResult<{ id: string }>> {
  try {
    const organizationId = await getOrganizationId()
    const userId = await getUserId()

    const parsed = createCompanySchema.safeParse(input)
    if (!parsed.success) {
      return { error: parsed.error.errors[0]?.message ?? 'Ugyldigt input' }
    }

    const { name, cvr, companyType, address, city, postalCode, foundedDate, status, notes } = parsed.data

    const company = await prisma.company.create({
      data: {
        organizationId,
        name,
        cvr,
        companyType,
        address,
        city,
        postalCode,
        foundedDate: foundedDate ? new Date(foundedDate) : undefined,
        status: status ?? 'aktiv',
        notes,
      },
    })

    await prisma.activityLog.create({
      data: {
        organizationId,
        userId,
        action: 'CREATE',
        resourceType: 'company',
        resourceId: company.id,
      },
    })

    revalidatePath('/companies')
    return { data: { id: company.id } }
  } catch (err) {
    console.error('[createCompany]', err)
    return { error: 'Kunne ikke oprette selskab' }
  }
}

export async function updateCompany(input: UpdateCompanyInput): Promise<ActionResult<void>> {
  try {
    const organizationId = await getOrganizationId()
    const userId = await getUserId()

    const parsed = updateCompanySchema.safeParse(input)
    if (!parsed.success) {
      return { error: parsed.error.errors[0]?.message ?? 'Ugyldigt input' }
    }

    const { companyId, ...data } = parsed.data

    // Verificer adgang
    const company = await prisma.company.findFirst({
      where: { id: companyId, organizationId, deletedAt: null },
    })
    if (!company) return { error: 'Selskab ikke fundet' }

    await prisma.company.update({
      where: { id: companyId },
      data: {
        ...data,
        foundedDate: data.foundedDate ? new Date(data.foundedDate) : undefined,
        updatedAt: new Date(),
      },
    })

    await prisma.activityLog.create({
      data: {
        organizationId,
        userId,
        action: 'UPDATE',
        resourceType: 'company',
        resourceId: companyId,
      },
    })

    revalidatePath(`/companies/${companyId}`)
    revalidatePath('/companies')
    return { data: undefined }
  } catch (err) {
    console.error('[updateCompany]', err)
    return { error: 'Kunne ikke opdatere selskab' }
  }
}

export async function deleteCompany(input: { companyId: string }): Promise<ActionResult<void>> {
  try {
    const organizationId = await getOrganizationId()
    const userId = await getUserId()

    const company = await prisma.company.findFirst({
      where: { id: input.companyId, organizationId, deletedAt: null },
    })
    if (!company) return { error: 'Selskab ikke fundet' }

    await prisma.company.update({
      where: { id: input.companyId },
      data: { deletedAt: new Date() },
    })

    await prisma.activityLog.create({
      data: {
        organizationId,
        userId,
        action: 'DELETE',
        resourceType: 'company',
        resourceId: input.companyId,
      },
    })

    revalidatePath('/companies')
    return { data: undefined }
  } catch (err) {
    console.error('[deleteCompany]', err)
    return { error: 'Kunne ikke slette selskab' }
  }
}

// ─── Ejerskab ────────────────────────────────────────────────────────────────

export async function getOwnerships(companyId: string) {
  try {
    const organizationId = await getOrganizationId()

    const company = await prisma.company.findFirst({
      where: { id: companyId, organizationId, deletedAt: null },
    })
    if (!company) return { data: undefined, error: 'Selskab ikke fundet' }

    const ownerships = await prisma.ownership.findMany({
      where: {
        companyId,
      },
      include: {
        ownerPerson: true,
        ownerCompany: true,
      },
      orderBy: { ownershipPct: 'desc' },
    })

    return { data: ownerships, error: undefined }
  } catch (err) {
    console.error('[getOwnerships]', err)
    return { data: undefined, error: 'Kunne ikke hente ejerskaber' }
  }
}

export async function createOwnership(input: CreateOwnershipInput): Promise<ActionResult<void>> {
  try {
    const organizationId = await getOrganizationId()
    const userId = await getUserId()

    const parsed = createOwnershipSchema.safeParse(input)
    if (!parsed.success) {
      return { error: parsed.error.errors[0]?.message ?? 'Ugyldigt input' }
    }

    const { companyId, ownerType, ownerPersonId, ownerCompanyId, ownershipPct, shareClass, effectiveDate, contractId } = parsed.data

    // Verificer adgang
    const company = await prisma.company.findFirst({
      where: { id: companyId, organizationId, deletedAt: null },
    })
    if (!company) return { error: 'Selskab ikke fundet' }

    const ownership = await prisma.ownership.create({
      data: {
        companyId,
        ownerType,
        ownerPersonId: ownerType === 'person' ? ownerPersonId : undefined,
        ownerCompanyId: ownerType === 'company' ? ownerCompanyId : undefined,
        ownershipPct,
        shareClass: shareClass ?? undefined,
        effectiveDate: effectiveDate ?? undefined,
        contractId: contractId ?? undefined,
      },
    })

    await prisma.activityLog.create({
      data: {
        organizationId,
        userId,
        action: 'CREATE',
        resourceType: 'ownership',
        resourceId: ownership.id,
      },
    })

    revalidatePath(`/companies/${companyId}`)
    return { data: undefined }
  } catch (err) {
    console.error('[createOwnership]', err)
    return { error: 'Kunne ikke oprette ejerskab' }
  }
}

export async function updateOwnership(input: UpdateOwnershipInput): Promise<ActionResult<void>> {
  try {
    const organizationId = await getOrganizationId()
    const userId = await getUserId()

    const parsed = updateOwnershipSchema.safeParse(input)
    if (!parsed.success) {
      return { error: parsed.error.errors[0]?.message ?? 'Ugyldigt input' }
    }

    const { id, ownershipPct, shareClass, effectiveDate, contractId } = parsed.data

    // Find og verificer ejerskab
    const ownership = await prisma.ownership.findFirst({
      where: { id },
      include: { company: true },
    })
    if (!ownership) return { error: 'Ejerskab ikke fundet' }
    if (ownership.company.organizationId !== organizationId) return { error: 'Ikke adgang' }

    await prisma.ownership.update({
      where: { id },
      data: {
        ownershipPct: ownershipPct ?? undefined,
        shareClass: shareClass ?? undefined,
        effectiveDate: effectiveDate ?? undefined,
        contractId: contractId ?? undefined,
        updatedAt: new Date(),
      },
    })

    await prisma.activityLog.create({
      data: {
        organizationId,
        userId,
        action: 'UPDATE',
        resourceType: 'ownership',
        resourceId: id,
      },
    })

    revalidatePath(`/companies/${ownership.companyId}`)
    return { data: undefined }
  } catch (err) {
    console.error('[updateOwnership]', err)
    return { error: 'Kunne ikke opdatere ejerskab' }
  }
}

export async function deleteOwnership(input: { id: string }): Promise<ActionResult<void>> {
  try {
    const organizationId = await getOrganizationId()
    const userId = await getUserId()

    const ownership = await prisma.ownership.findFirst({
      where: { id: input.id },
      include: { company: true },
    })
    if (!ownership) return { error: 'Ejerskab ikke fundet' }
    if (ownership.company.organizationId !== organizationId) return { error: 'Ikke adgang' }

    await prisma.ownership.delete({
      where: { id: input.id },
    })

    await prisma.activityLog.create({
      data: {
        organizationId,
        userId,
        action: 'DELETE',
        resourceType: 'ownership',
        resourceId: input.id,
      },
    })

    revalidatePath(`/companies/${ownership.companyId}`)
    return { data: undefined }
  } catch (err) {
    console.error('[deleteOwnership]', err)
    return { error: 'Kunne ikke slette ejerskab' }
  }
}

// ─── Selskabspersoner ────────────────────────────────────────────────────────

export async function getCompanyPersons(companyId: string) {
  try {
    const organizationId = await getOrganizationId()

    const company = await prisma.company.findFirst({
      where: { id: companyId, organizationId, deletedAt: null },
    })
    if (!company) return { data: undefined, error: 'Selskab ikke fundet' }

    const persons = await prisma.companyPerson.findMany({
      where: {
        companyId,
      },
      include: {
        person: true,
      },
      orderBy: { role: 'asc' },
    })

    return { data: persons, error: undefined }
  } catch (err) {
    console.error('[getCompanyPersons]', err)
    return { data: undefined, error: 'Kunne ikke hente tilknyttede personer' }
  }
}

export async function createCompanyPerson(input: CreateCompanyPersonInput): Promise<ActionResult<void>> {
  try {
    const organizationId = await getOrganizationId()
    const userId = await getUserId()

    const parsed = createCompanyPersonSchema.safeParse(input)
    if (!parsed.success) {
      return { error: parsed.error.errors[0]?.message ?? 'Ugyldigt input' }
    }

    const company = await prisma.company.findFirst({
      where: { id: parsed.data.companyId, organizationId, deletedAt: null },
    })
    if (!company) return { error: 'Selskab ikke fundet' }

    const cp = await prisma.companyPerson.create({
      data: {
        companyId: parsed.data.companyId,
        personId: parsed.data.personId,
        role: parsed.data.role,
        startDate: parsed.data.startDate ? new Date(parsed.data.startDate) : undefined,
        endDate: parsed.data.endDate ? new Date(parsed.data.endDate) : undefined,
        employmentType: parsed.data.employmentType,
        notes: parsed.data.notes,
      },
    })

    await prisma.activityLog.create({
      data: {
        organizationId,
        userId,
        action: 'CREATE',
        resourceType: 'company_person',
        resourceId: cp.id,
      },
    })

    revalidatePath(`/companies/${parsed.data.companyId}`)
    return { data: undefined }
  } catch (err) {
    console.error('[createCompanyPerson]', err)
    return { error: 'Kunne ikke tilknytte person' }
  }
}

export async function updateCompanyPerson(input: UpdateCompanyPersonInput): Promise<ActionResult<void>> {
  try {
    const organizationId = await getOrganizationId()
    const userId = await getUserId()

    const parsed = updateCompanyPersonSchema.safeParse(input)
    if (!parsed.success) {
      return { error: parsed.error.errors[0]?.message ?? 'Ugyldigt input' }
    }

    const { id, role, startDate, endDate, employmentType, notes } = parsed.data

    const cp = await prisma.companyPerson.findFirst({
      where: { id },
      include: { company: true },
    })
    if (!cp) return { error: 'Tilknytning ikke fundet' }
    if (cp.company.organizationId !== organizationId) return { error: 'Ikke adgang' }

    await prisma.companyPerson.update({
      where: { id },
      data: {
        role: role ?? undefined,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        employmentType: employmentType ?? undefined,
        notes: notes ?? undefined,
        updatedAt: new Date(),
      },
    })

    await prisma.activityLog.create({
      data: {
        organizationId,
        userId,
        action: 'UPDATE',
        resourceType: 'company_person',
        resourceId: id,
      },
    })

    revalidatePath(`/companies/${cp.companyId}`)
    return { data: undefined }
  } catch (err) {
    console.error('[updateCompanyPerson]', err)
    return { error: 'Kunne ikke opdatere tilknytning' }
  }
}

export async function deleteCompanyPerson(input: { id: string }): Promise<ActionResult<void>> {
  try {
    const organizationId = await getOrganizationId()
    const userId = await getUserId()

    const cp = await prisma.companyPerson.findFirst({
      where: { id: input.id },
      include: { company: true },
    })
    if (!cp) return { error: 'Tilknytning ikke fundet' }
    if (cp.company.organizationId !== organizationId) return { error: 'Ikke adgang' }

    await prisma.companyPerson.delete({
      where: { id: input.id },
    })

    await prisma.activityLog.create({
      data: {
        organizationId,
        userId,
        action: 'DELETE',
        resourceType: 'company_person',
        resourceId: input.id,
      },
    })

    revalidatePath(`/companies/${cp.companyId}`)
    return { data: undefined }
  } catch (err) {
    console.error('[deleteCompanyPerson]', err)
    return { error: 'Kunne ikke fjerne tilknytning' }
  }
}

// ─── Aktivitetslog ────────────────────────────────────────────────────────────

export async function getActivityLog(params: {
  companyId: string
  limit?: number
  offset?: number
}) {
  try {
    const organizationId = await getOrganizationId()
    const { companyId, limit = 20, offset = 0 } = params

    // Verificer adgang
    const company = await prisma.company.findFirst({
      where: { id: companyId, organizationId, deletedAt: null },
    })
    if (!company) return { data: undefined, error: 'Selskab ikke fundet' }

    const [entries, total] = await Promise.all([
      prisma.activityLog.findMany({
        where: {
          organizationId,
          resourceId: companyId,
        },
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      }),
      prisma.activityLog.count({
        where: {
          organizationId,
          resourceId: companyId,
        },
      }),
    ])

    return { data: { entries, total }, error: undefined }
  } catch (err) {
    console.error('[getActivityLog]', err)
    return { data: undefined, error: 'Kunne ikke hente aktivitetslog' }
  }
}

// ─── Personer til organisation ────────────────────────────────────────────────

export async function getPersonsForOrganization() {
  try {
    const organizationId = await getOrganizationId()

    const persons = await prisma.person.findMany({
      where: {
        organizationId,
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

    return { data: persons, error: undefined }
  } catch (err) {
    console.error('[getPersonsForOrganization]', err)
    return { data: undefined, error: 'Kunne ikke hente personer' }
  }
}