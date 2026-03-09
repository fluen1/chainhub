import 'server-only'
import { prisma } from '@/lib/db'
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

    const company = await prisma.company.findFirst({
      where: {
        id: companyId,
        organizationId,
        deletedAt: null,
      },
      include: {
        ownerships: {
          where: {
            organizationId,
          } as any,
          orderBy: { percentage: 'desc' } as any,
          include: {
            ownerCompanyRel: true,
          } as any,
        },
        companyPersons: {
          where: {
            organizationId,
          } as any,
          include: {
            person: true,
          } as any,
        },
        contracts: {
          where: {
            organizationId,
            deletedAt: null,
          } as any,
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: {
            id: true,
            organizationId: true,
            status: true,
            systemType: true,
            sensitivity: true,
            createdAt: true,
            updatedAt: true,
          } as any,
        },
      },
    })

    if (!company) {
      return { data: undefined, error: 'Selskabet blev ikke fundet' }
    }

    return { data: company, error: undefined }
  } catch (err) {
    console.error('[getCompany]', err)
    return { data: undefined, error: 'Kunne ikke hente selskab' }
  }
}

// ─── Adgangstjek ─────────────────────────────────────────────────────────────

export async function canAccessCompany(companyId: string): Promise<boolean> {
  try {
    const organizationId = await getOrganizationId()
    const company = await prisma.company.findFirst({
      where: { id: companyId, organizationId, deletedAt: null },
      select: { id: true },
    })
    return company !== null
  } catch {
    return false
  }
}

// ─── Opret selskab ────────────────────────────────────────────────────────────

export async function createCompany(
  input: CreateCompanyInput
): Promise<ActionResult<{ id: string }>> {
  try {
    const organizationId = await getOrganizationId()
    const userId = await getUserId()
    const data = createCompanySchema.parse(input)

    const company = await prisma.company.create({
      data: {
        ...data,
        organizationId,
        createdBy: userId,
      },
      select: { id: true },
    })

    revalidatePath('/companies')
    return { data: { id: company.id } }
  } catch (err) {
    console.error('[createCompany]', err)
    return { error: 'Kunne ikke oprette selskab' }
  }
}

// ─── Opdater selskab ──────────────────────────────────────────────────────────

export async function updateCompany(
  companyId: string,
  input: UpdateCompanyInput
): Promise<ActionResult<{ id: string }>> {
  try {
    const organizationId = await getOrganizationId()
    const data = updateCompanySchema.parse(input)

    const existing = await prisma.company.findFirst({
      where: { id: companyId, organizationId, deletedAt: null },
      select: { id: true },
    })
    if (!existing) return { error: 'Selskabet blev ikke fundet' }

    await prisma.company.update({
      where: { id: companyId },
      data,
    })

    revalidatePath(`/companies/${companyId}`)
    revalidatePath('/companies')
    return { data: { id: companyId } }
  } catch (err) {
    console.error('[updateCompany]', err)
    return { error: 'Kunne ikke opdatere selskab' }
  }
}

// ─── Slet selskab (soft delete) ───────────────────────────────────────────────

export async function deleteCompany(
  companyId: string
): Promise<ActionResult<{ id: string }>> {
  try {
    const organizationId = await getOrganizationId()
    const userId = await getUserId()

    const existing = await prisma.company.findFirst({
      where: { id: companyId, organizationId, deletedAt: null },
      select: { id: true },
    })
    if (!existing) return { error: 'Selskabet blev ikke fundet' }

    await prisma.company.update({
      where: { id: companyId },
      data: { deletedAt: new Date(), updatedBy: userId } as any,
    })

    revalidatePath('/companies')
    return { data: { id: companyId } }
  } catch (err) {
    console.error('[deleteCompany]', err)
    return { error: 'Kunne ikke slette selskab' }
  }
}

// ─── Ejerskaber ───────────────────────────────────────────────────────────────

export async function createOwnership(
  companyId: string,
  input: CreateOwnershipInput
): Promise<ActionResult<{ id: string }>> {
  try {
    const organizationId = await getOrganizationId()
    const userId = await getUserId()

    const canAccess = await canAccessCompany(companyId)
    if (!canAccess) return { error: 'Ingen adgang til selskabet' }

    const data = createOwnershipSchema.parse(input)

    const ownership = await prisma.ownership.create({
      data: {
        ...data,
        companyId,
        organizationId,
        createdBy: userId,
      } as any,
      select: { id: true },
    })

    revalidatePath(`/companies/${companyId}`)
    return { data: { id: ownership.id } }
  } catch (err) {
    console.error('[createOwnership]', err)
    return { error: 'Kunne ikke oprette ejerskab' }
  }
}

export async function updateOwnership(
  ownershipId: string,
  companyId: string,
  input: UpdateOwnershipInput
): Promise<ActionResult<{ id: string }>> {
  try {
    const organizationId = await getOrganizationId()

    const canAccess = await canAccessCompany(companyId)
    if (!canAccess) return { error: 'Ingen adgang til selskabet' }

    const data = updateOwnershipSchema.parse(input)

    const existing = await prisma.ownership.findFirst({
      where: { id: ownershipId, organizationId } as any,
      select: { id: true },
    })
    if (!existing) return { error: 'Ejerskab ikke fundet' }

    await prisma.ownership.update({
      where: { id: ownershipId },
      data: data as any,
    })

    revalidatePath(`/companies/${companyId}`)
    return { data: { id: ownershipId } }
  } catch (err) {
    console.error('[updateOwnership]', err)
    return { error: 'Kunne ikke opdatere ejerskab' }
  }
}

export async function deleteOwnership(
  ownershipId: string,
  companyId: string
): Promise<ActionResult<{ id: string }>> {
  try {
    const organizationId = await getOrganizationId()
    const userId = await getUserId()

    const canAccess = await canAccessCompany(companyId)
    if (!canAccess) return { error: 'Ingen adgang til selskabet' }

    const existing = await prisma.ownership.findFirst({
      where: { id: ownershipId, organizationId } as any,
      select: { id: true },
    })
    if (!existing) return { error: 'Ejerskab ikke fundet' }

    await prisma.ownership.update({
      where: { id: ownershipId },
      data: { deletedAt: new Date(), updatedBy: userId } as any,
    })

    revalidatePath(`/companies/${companyId}`)
    return { data: { id: ownershipId } }
  } catch (err) {
    console.error('[deleteOwnership]', err)
    return { error: 'Kunne ikke slette ejerskab' }
  }
}

// ─── Selskabspersoner ─────────────────────────────────────────────────────────

export async function createCompanyPerson(
  companyId: string,
  input: CreateCompanyPersonInput
): Promise<ActionResult<{ id: string }>> {
  try {
    const organizationId = await getOrganizationId()
    const userId = await getUserId()

    const canAccess = await canAccessCompany(companyId)
    if (!canAccess) return { error: 'Ingen adgang til selskabet' }

    const data = createCompanyPersonSchema.parse(input)

    const companyPerson = await prisma.companyPerson.create({
      data: {
        ...data,
        companyId,
        organizationId,
        createdBy: userId,
      } as any,
      select: { id: true },
    })

    revalidatePath(`/companies/${companyId}`)
    return { data: { id: companyPerson.id } }
  } catch (err) {
    console.error('[createCompanyPerson]', err)
    return { error: 'Kunne ikke tilknytte person' }
  }
}

export async function updateCompanyPerson(
  companyPersonId: string,
  companyId: string,
  input: UpdateCompanyPersonInput
): Promise<ActionResult<{ id: string }>> {
  try {
    const organizationId = await getOrganizationId()

    const canAccess = await canAccessCompany(companyId)
    if (!canAccess) return { error: 'Ingen adgang til selskabet' }

    const data = updateCompanyPersonSchema.parse(input)

    const existing = await prisma.companyPerson.findFirst({
      where: { id: companyPersonId, organizationId } as any,
      select: { id: true },
    })
    if (!existing) return { error: 'Tilknytning ikke fundet' }

    await prisma.companyPerson.update({
      where: { id: companyPersonId },
      data: data as any,
    })

    revalidatePath(`/companies/${companyId}`)
    return { data: { id: companyPersonId } }
  } catch (err) {
    console.error('[updateCompanyPerson]', err)
    return { error: 'Kunne ikke opdatere tilknytning' }
  }
}

export async function deleteCompanyPerson(
  companyPersonId: string,
  companyId: string
): Promise<ActionResult<{ id: string }>> {
  try {
    const organizationId = await getOrganizationId()
    const userId = await getUserId()

    const canAccess = await canAccessCompany(companyId)
    if (!canAccess) return { error: 'Ingen adgang til selskabet' }

    const existing = await prisma.companyPerson.findFirst({
      where: { id: companyPersonId, organizationId } as any,
      select: { id: true },
    })
    if (!existing) return { error: 'Tilknytning ikke fundet' }

    await prisma.companyPerson.update({
      where: { id: companyPersonId },
      data: { deletedAt: new Date(), updatedBy: userId } as any,
    })

    revalidatePath(`/companies/${companyId}`)
    return { data: { id: companyPersonId } }
  } catch (err) {
    console.error('[deleteCompanyPerson]', err)
    return { error: 'Kunne ikke fjerne tilknytning' }
  }
}