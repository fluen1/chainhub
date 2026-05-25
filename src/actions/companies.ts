'use server'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { canAccessCompany, canAccessModule, getAccessibleCompanies } from '@/lib/permissions'
import {
  createCompanySchema,
  updateCompanySchema,
  type CreateCompanyInput,
  type UpdateCompanyInput,
} from '@/lib/validations/company'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import type { ActionResult } from '@/types/actions'
import type { Company } from '@prisma/client'
import { captureError } from '@/lib/logger'
import { geocodeAddress } from '@/lib/geocode'
import { invalidateCompanyInsightsCache } from '@/lib/ai/invalidate-cache'
import { recordAuditEvent } from '@/lib/audit'

const stamdataSchema = z.object({
  name: z.string().min(1, 'Navn er paakraevet').max(200, 'Navn maa maks vaere 200 tegn'),
  cvr: z
    .string()
    .regex(/^\d{8}$/, 'CVR skal vaere 8 cifre')
    .nullable(),
  address: z.string().max(200, 'Adresse maa maks vaere 200 tegn').nullable(),
  city: z.string().max(100, 'By maa maks vaere 100 tegn').nullable(),
  postal_code: z.string().max(10, 'Postnummer maa maks vaere 10 tegn').nullable(),
  founded_date: z.string().nullable(),
})

export type UpdateCompanyStamdataInput = z.infer<typeof stamdataSchema>

export async function createCompany(input: CreateCompanyInput): Promise<ActionResult<Company>> {
  const session = await auth()
  if (!session) return { error: 'Din session er udløbet — log ind igen.' }

  const parsed = createCompanySchema.safeParse(input)
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0]
    return { error: firstIssue?.message ?? 'Ugyldigt input' }
  }

  const hasAccess = await canAccessModule(session.user.id, 'settings', session.user.organizationId)
  if (!hasAccess) return { error: 'Du har ikke adgang til at oprette selskaber' }

  // Check for duplicate CVR in tenant
  if (parsed.data.cvr) {
    const existing = await prisma.company.findFirst({
      where: {
        organization_id: session.user.organizationId,
        cvr: parsed.data.cvr,
        deleted_at: null,
      },
    })
    if (existing) {
      return { error: `CVR ${parsed.data.cvr} er allerede registreret (se ${existing.name})` }
    }
  }

  try {
    // Geocode adresse → koordinater
    const coords = await geocodeAddress(
      parsed.data.address || null,
      parsed.data.city || null,
      parsed.data.postalCode || null
    )

    const company = await prisma.company.create({
      data: {
        organization_id: session.user.organizationId,
        name: parsed.data.name,
        cvr: parsed.data.cvr || null,
        company_type: parsed.data.companyType || null,
        address: parsed.data.address || null,
        city: parsed.data.city || null,
        postal_code: parsed.data.postalCode || null,
        founded_date: parsed.data.foundedDate ? new Date(parsed.data.foundedDate) : null,
        status: parsed.data.status || 'aktiv',
        notes: parsed.data.notes || null,
        created_by: session.user.id,
        latitude: coords?.latitude ?? null,
        longitude: coords?.longitude ?? null,
      },
    })

    revalidatePath('/dashboard')
    revalidatePath('/companies')
    return { data: company }
  } catch (err) {
    captureError(err, {
      namespace: 'action:createCompany',
      extra: { name: parsed.data.name, cvr: parsed.data.cvr },
    })
    return { error: 'Selskabet kunne ikke oprettes — prøv igen' }
  }
}

export async function updateCompany(input: UpdateCompanyInput): Promise<ActionResult<Company>> {
  const session = await auth()
  if (!session) return { error: 'Din session er udløbet — log ind igen.' }

  const parsed = updateCompanySchema.safeParse(input)
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0]
    return { error: firstIssue?.message ?? 'Ugyldigt input' }
  }

  const hasAccess = await canAccessCompany(
    session.user.id,
    parsed.data.companyId,
    session.user.organizationId
  )
  if (!hasAccess) return { error: 'Ingen adgang til dette selskab' }

  try {
    const company = await prisma.company.update({
      where: {
        id: parsed.data.companyId,
        organization_id: session.user.organizationId,
      },
      data: {
        ...(parsed.data.name && { name: parsed.data.name }),
        ...(parsed.data.cvr !== undefined && { cvr: parsed.data.cvr || null }),
        ...(parsed.data.companyType !== undefined && {
          company_type: parsed.data.companyType || null,
        }),
        ...(parsed.data.address !== undefined && { address: parsed.data.address || null }),
        ...(parsed.data.city !== undefined && { city: parsed.data.city || null }),
        ...(parsed.data.postalCode !== undefined && {
          postal_code: parsed.data.postalCode || null,
        }),
        ...(parsed.data.notes !== undefined && { notes: parsed.data.notes || null }),
      },
    })

    await invalidateCompanyInsightsCache(parsed.data.companyId)

    revalidatePath(`/companies/${parsed.data.companyId}`)
    revalidatePath('/companies')
    return { data: company }
  } catch (err) {
    captureError(err, {
      namespace: 'action:updateCompany',
      extra: { companyId: parsed.data.companyId },
    })
    return { error: 'Selskabet kunne ikke opdateres — prøv igen' }
  }
}

export async function deleteCompany(companyId: string): Promise<ActionResult<void>> {
  const session = await auth()
  if (!session) return { error: 'Din session er udløbet — log ind igen.' }

  const hasAccess = await canAccessModule(session.user.id, 'settings', session.user.organizationId)
  if (!hasAccess) return { error: 'Du har ikke adgang til at slette selskaber' }

  // Tenant isolation check
  const existing = await prisma.company.findFirst({
    where: { id: companyId, organization_id: session.user.organizationId, deleted_at: null },
    select: { id: true },
  })
  if (!existing) return { error: 'Selskab ikke fundet' }

  try {
    await prisma.company.update({
      where: {
        id: companyId,
        organization_id: session.user.organizationId,
      },
      data: { deleted_at: new Date() },
    })

    await invalidateCompanyInsightsCache(companyId)

    await recordAuditEvent({
      organizationId: session.user.organizationId,
      userId: session.user.id,
      action: 'DELETE',
      resourceType: 'company',
      resourceId: companyId,
      resourceCompanyId: companyId,
    })

    revalidatePath('/dashboard')
    revalidatePath('/companies')
    return { data: undefined }
  } catch (err) {
    captureError(err, {
      namespace: 'action:deleteCompany',
      extra: { companyId },
    })
    return { error: 'Selskabet kunne ikke slettes — prøv igen' }
  }
}

export async function updateCompanyStamdata(
  companyId: string,
  input: UpdateCompanyStamdataInput
): Promise<ActionResult<void>> {
  const session = await auth()
  if (!session) return { error: 'Din session er udløbet — log ind igen.' }

  const parsed = stamdataSchema.safeParse(input)
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0]
    return { error: firstIssue?.message ?? 'Ugyldigt input' }
  }

  const hasAccess = await canAccessCompany(session.user.id, companyId, session.user.organizationId)
  if (!hasAccess) return { error: 'Ingen adgang til dette selskab' }

  try {
    // Re-geocode hvis adresse/by ændres
    const coords = await geocodeAddress(
      parsed.data.address,
      parsed.data.city,
      parsed.data.postal_code
    )

    await prisma.company.update({
      where: {
        id: companyId,
        organization_id: session.user.organizationId,
      },
      data: {
        name: parsed.data.name,
        cvr: parsed.data.cvr,
        address: parsed.data.address,
        city: parsed.data.city,
        postal_code: parsed.data.postal_code,
        founded_date: parsed.data.founded_date ? new Date(parsed.data.founded_date) : null,
        latitude: coords?.latitude ?? undefined,
        longitude: coords?.longitude ?? undefined,
      },
    })

    await invalidateCompanyInsightsCache(companyId)

    revalidatePath(`/companies/${companyId}`)
    revalidatePath('/companies')
    return { data: undefined }
  } catch (err) {
    captureError(err, {
      namespace: 'action:updateCompanyStamdata',
      extra: { companyId },
    })
    return { error: 'Stamdata kunne ikke opdateres — prøv igen' }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Page-data queries (flyt Prisma-kald ud af page.tsx)
// ─────────────────────────────────────────────────────────────────────────────

export interface CompaniesRawData {
  companies: Array<{
    id: string
    name: string
    cvr: string | null
    company_type: string | null
    postal_code: string | null
    city: string | null
    _count: { contracts: number }
    ownerships: Array<{
      ownership_pct: unknown
      owner_person_id: string | null
      owner_company_id: string | null
    }>
  }>
  openCaseCounts: Array<{ company_id: string; count: bigint }>
  expiredCounts: Array<{ company_id: string; count: bigint }>
  expiringCounts: Array<{ company_id: string; count: bigint }>
  financials: Array<{
    company_id: string
    metric_type: string
    period_type: string
    period_year: number
    value: unknown
  }>
  personsCount: number
  canCreate: boolean
}

export async function getCompaniesPageData(): Promise<CompaniesRawData | null> {
  const session = await auth()
  if (!session) return null

  const orgId = session.user.organizationId

  const [companyIds, userRolesInitial] = await Promise.all([
    getAccessibleCompanies(session.user.id, orgId),
    prisma.userRoleAssignment.findMany({
      where: { user_id: session.user.id },
      select: { role: true },
    }),
  ])

  const canCreate = userRolesInitial.some((r) =>
    ['GROUP_OWNER', 'GROUP_ADMIN', 'GROUP_LEGAL'].includes(r.role)
  )

  if (companyIds.length === 0) {
    return {
      companies: [],
      openCaseCounts: [],
      expiredCounts: [],
      expiringCounts: [],
      financials: [],
      personsCount: 0,
      canCreate,
    }
  }

  const now = new Date()
  const ninetyDaysFromNow = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000)

  const [companies, openCaseCounts, expiredCounts, expiringCounts, financials, personsCount] =
    await Promise.all([
      prisma.company.findMany({
        where: {
          organization_id: orgId,
          id: { in: companyIds },
          deleted_at: null,
        },
        include: {
          _count: { select: { contracts: { where: { deleted_at: null } } } },
          ownerships: {
            where: { end_date: null },
            select: { ownership_pct: true, owner_person_id: true, owner_company_id: true },
          },
        },
        orderBy: { name: 'asc' },
      }),
      prisma.$queryRaw<Array<{ company_id: string; count: bigint }>>`
        SELECT cc.company_id, COUNT(DISTINCT c.id)::bigint as count
        FROM "CaseCompany" cc
        JOIN "Case" c ON c.id = cc.case_id
        WHERE c.organization_id = ${orgId}
          AND c.deleted_at IS NULL
          AND c.status NOT IN ('LUKKET', 'ARKIVERET')
        GROUP BY cc.company_id
      `,
      prisma.$queryRaw<Array<{ company_id: string; count: bigint }>>`
        SELECT company_id, COUNT(id)::bigint as count
        FROM "Contract"
        WHERE organization_id = ${orgId}
          AND deleted_at IS NULL
          AND status = 'UDLOBET'
        GROUP BY company_id
      `,
      prisma.$queryRaw<Array<{ company_id: string; count: bigint }>>`
        SELECT company_id, COUNT(id)::bigint as count
        FROM "Contract"
        WHERE organization_id = ${orgId}
          AND deleted_at IS NULL
          AND status = 'AKTIV'
          AND expiry_date IS NOT NULL
          AND expiry_date <= ${ninetyDaysFromNow}
          AND expiry_date > ${now}
        GROUP BY company_id
      `,
      prisma.financialMetric.findMany({
        where: {
          organization_id: orgId,
          company_id: { in: companyIds },
          period_type: 'HELAAR',
        },
        orderBy: { period_year: 'desc' },
      }),
      prisma.person.count({
        where: { organization_id: orgId, deleted_at: null },
      }),
    ])

  return {
    companies,
    openCaseCounts,
    expiredCounts,
    expiringCounts,
    financials: financials.map((f) => ({
      company_id: f.company_id,
      metric_type: f.metric_type,
      period_type: f.period_type,
      period_year: f.period_year,
      value: f.value,
    })),
    personsCount,
    canCreate,
  }
}
