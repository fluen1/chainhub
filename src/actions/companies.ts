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
            ownerCompany: {
              select: {
                id: true,
                name: true,
                cvr: true,
              },
            },
            ownedCompany: {
              select: {
                id: true,
                name: true,
                cvr: true,
              },
            },
          },
          orderBy: { ownershipPercentage: 'desc' },
        },
        companyPersons: {
          where: {
            deletedAt: null,
          },
          include: {
            person: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                phone: true,
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
        contracts: {
          where: {
            deletedAt: null,
          },
          select: {
            id: true,
            title: true,
            status: true,
            systemType: true,
            expiresAt: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 10,
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
      return { data: undefined, error: 'Selskabet blev ikke fundet' }
    }

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

    const data = parsed.data

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

export async function updateCompany(input: UpdateCompanyInput): Promise<ActionResult<{ id: string }>> {
  try {
    const organizationId = await getOrganizationId()
    const userId = await getUserId()

    const parsed = updateCompanySchema.safeParse(input)
    if (!parsed.success) {
      return { error: parsed.error.errors[0]?.message ?? 'Ugyldigt input' }
    }

    const { id, ...data } = parsed.data

    // Verificer at selskabet tilhører organisationen
    const existing = await prisma.company.findFirst({
      where: { id, organizationId, deletedAt: null },
      select: { id: true },
    })

    if (!existing) {
      return { error: 'Selskabet blev ikke fundet' }
    }

    await prisma.company.update({
      where: { id },
      data: {
        ...data,
        updatedAt: new Date(),
      },
    })

    revalidatePath('/companies')
    revalidatePath(`/companies/${id}`)
    return { data: { id } }
  } catch (err) {
    console.error('[updateCompany]', err)
    return { error: 'Kunne ikke opdatere selskab' }
  }
}

export async function deleteCompany(companyId: string): Promise<ActionResult<{ id: string }>> {
  try {
    const organizationId = await getOrganizationId()
    const userId = await getUserId()

    // Verificer at selskabet tilhører organisationen
    const existing = await prisma.company.findFirst({
      where: { id: companyId, organizationId, deletedAt: null },
      select: { id: true },
    })

    if (!existing) {
      return { error: 'Selskabet blev ikke fundet' }
    }

    await prisma.company.update({
      where: { id: companyId },
      data: {
        deletedAt: new Date(),
        updatedAt: new Date(),
      },
    })

    revalidatePath('/companies')
    return { data: { id: companyId } }
  } catch (err) {
    console.error('[deleteCompany]', err)
    return { error: 'Kunne ikke slette selskab' }
  }
}

// ─── Ejerskab ─────────────────────────────────────────────────────────────────

export async function createOwnership(input: CreateOwnershipInput): Promise<ActionResult<{ id: string }>> {
  try {
    const organizationId = await getOrganizationId()
    const userId = await getUserId()

    const parsed = createOwnershipSchema.safeParse(input)
    if (!parsed.success) {
      return { error: parsed.error.errors[0]?.message ?? 'Ugyldigt input' }
    }

    const data = parsed.data

    // Verificer at begge selskaber tilhører organisationen
    const [ownerCompany, ownedCompany] = await Promise.all([
      prisma.company.findFirst({
        where: { id: data.ownerCompanyId, organizationId, deletedAt: null },
        select: { id: true },
      }),
      prisma.company.findFirst({
        where: { id: data.ownedCompanyId, organizationId, deletedAt: null },
        select: { id: true },
      }),
    ])

    if (!ownerCompany) return { error: 'Ejende selskab ikke fundet' }
    if (!ownedCompany) return { error: 'Ejet selskab ikke fundet' }

    const ownership = await prisma.ownership.create({
      data: {
        ...data,
        organizationId,
        createdBy: userId,
      },
      select: { id: true },
    })

    revalidatePath(`/companies/${data.ownerCompanyId}`)
    revalidatePath(`/companies/${data.ownedCompanyId}`)
    return { data: { id: ownership.id } }
  } catch (err) {
    console.error('[createOwnership]', err)
    return { error: 'Kunne ikke oprette ejerskab' }
  }
}

export async function updateOwnership(input: UpdateOwnershipInput): Promise<ActionResult<{ id: string }>> {
  try {
    const organizationId = await getOrganizationId()

    const parsed = updateOwnershipSchema.safeParse(input)
    if (!parsed.success) {
      return { error: parsed.error.errors[0]?.message ?? 'Ugyldigt input' }
    }

    const { id, ...data } = parsed.data

    // Verificer at ejerskabet tilhører organisationen
    const existing = await prisma.ownership.findFirst({
      where: { id, organizationId, deletedAt: null },
      select: { id: true, ownerCompanyId: true, ownedCompanyId: true },
    })

    if (!existing) {
      return { error: 'Ejerskab ikke fundet' }
    }

    await prisma.ownership.update({
      where: { id },
      data: {
        ...data,
        updatedAt: new Date(),
      },
    })

    revalidatePath(`/companies/${existing.ownerCompanyId}`)
    revalidatePath(`/companies/${existing.ownedCompanyId}`)
    return { data: { id } }
  } catch (err) {
    console.error('[updateOwnership]', err)
    return { error: 'Kunne ikke opdatere ejerskab' }
  }
}

export async function deleteOwnership(ownershipId: string): Promise<ActionResult<{ id: string }>> {
  try {
    const organizationId = await getOrganizationId()

    const existing = await prisma.ownership.findFirst({
      where: { id: ownershipId, organizationId, deletedAt: null },
      select: { id: true, ownerCompanyId: true, ownedCompanyId: true },
    })

    if (!existing) {
      return { error: 'Ejerskab ikke fundet' }
    }

    await prisma.ownership.update({
      where: { id: ownershipId },
      data: {
        deletedAt: new Date(),
        updatedAt: new Date(),
      },
    })

    revalidatePath(`/companies/${existing.ownerCompanyId}`)
    revalidatePath(`/companies/${existing.ownedCompanyId}`)
    return { data: { id: ownershipId } }
  } catch (err) {
    console.error('[deleteOwnership]', err)
    return { error: 'Kunne ikke slette ejerskab' }
  }
}

// ─── Selskabspersoner ─────────────────────────────────────────────────────────

export async function createCompanyPerson(input: CreateCompanyPersonInput): Promise<ActionResult<{ id: string }>> {
  try {
    const organizationId = await getOrganizationId()
    const userId = await getUserId()

    const parsed = createCompanyPersonSchema.safeParse(input)
    if (!parsed.success) {
      return { error: parsed.error.errors[0]?.message ?? 'Ugyldigt input' }
    }

    const data = parsed.data

    // Verificer at selskabet tilhører organisationen
    const company = await prisma.company.findFirst({
      where: { id: data.companyId, organizationId, deletedAt: null },
      select: { id: true },
    })

    if (!company) return { error: 'Selskabet blev ikke fundet' }

    const { notes: _notes, ...dataWithoutNotes } = data as any

    const companyPerson = await prisma.companyPerson.create({
      data: {
        ...dataWithoutNotes,
        organizationId,
        createdBy: userId,
      },
      select: { id: true },
    })

    revalidatePath(`/companies/${data.companyId}`)
    return { data: { id: companyPerson.id } }
  } catch (err) {
    console.error('[createCompanyPerson]', err)
    return { error: 'Kunne ikke tilknytte person til selskab' }
  }
}

export async function updateCompanyPerson(input: UpdateCompanyPersonInput): Promise<ActionResult<{ id: string }>> {
  try {
    const organizationId = await getOrganizationId()

    const parsed = updateCompanyPersonSchema.safeParse(input)
    if (!parsed.success) {
      return { error: parsed.error.errors[0]?.message ?? 'Ugyldigt input' }
    }

    const { id, ...data } = parsed.data

    // Verificer at relationen tilhører organisationen
    const existing = await prisma.companyPerson.findFirst({
      where: { id, organizationId, deletedAt: null },
      select: { id: true, companyId: true },
    })

    if (!existing) {
      return { error: 'Person-relation ikke fundet' }
    }

    const { notes: _notes, ...dataWithoutNotes } = data as any

    await prisma.companyPerson.update({
      where: { id },
      data: {
        ...dataWithoutNotes,
        updatedAt: new Date(),
      },
    })

    revalidatePath(`/companies/${existing.companyId}`)
    return { data: { id } }
  } catch (err) {
    console.error('[updateCompanyPerson]', err)
    return { error: 'Kunne ikke opdatere person-relation' }
  }
}

export async function deleteCompanyPerson(companyPersonId: string): Promise<ActionResult<{ id: string }>> {
  try {
    const organizationId = await getOrganizationId()

    const existing = await prisma.companyPerson.findFirst({
      where: { id: companyPersonId, organizationId, deletedAt: null },
      select: { id: true, companyId: true },
    })

    if (!existing) {
      return { error: 'Person-relation ikke fundet' }
    }

    await prisma.companyPerson.update({
      where: { id: companyPersonId },
      data: {
        deletedAt: new Date(),
        updatedAt: new Date(),
      },
    })

    revalidatePath(`/companies/${existing.companyId}`)
    return { data: { id: companyPersonId } }
  } catch (err) {
    console.error('[deleteCompanyPerson]', err)
    return { error: 'Kunne ikke fjerne person fra selskab' }
  }
}