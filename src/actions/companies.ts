'use server'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { canAccessCompany, canAccessModule } from '@/lib/permissions'
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
  if (!session) return { error: 'Ikke autoriseret' }

  const parsed = createCompanySchema.safeParse(input)
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0]
    return { error: firstIssue?.message ?? 'Ugyldigt input' }
  }

  const hasAccess = await canAccessModule(session.user.id, 'settings')
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
  if (!session) return { error: 'Ikke autoriseret' }

  const parsed = updateCompanySchema.safeParse(input)
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0]
    return { error: firstIssue?.message ?? 'Ugyldigt input' }
  }

  const hasAccess = await canAccessCompany(session.user.id, parsed.data.companyId)
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
  if (!session) return { error: 'Ikke autoriseret' }

  const hasAccess = await canAccessModule(session.user.id, 'settings')
  if (!hasAccess) return { error: 'Du har ikke adgang til at slette selskaber' }

  try {
    await prisma.company.update({
      where: {
        id: companyId,
        organization_id: session.user.organizationId,
      },
      data: { deleted_at: new Date() },
    })

    await invalidateCompanyInsightsCache(companyId)

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
  if (!session) return { error: 'Ikke autoriseret' }

  const parsed = stamdataSchema.safeParse(input)
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0]
    return { error: firstIssue?.message ?? 'Ugyldigt input' }
  }

  const hasAccess = await canAccessCompany(session.user.id, companyId)
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
