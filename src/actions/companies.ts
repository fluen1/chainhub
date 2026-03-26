'use server'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { canAccessCompany, canAccessModule } from '@/lib/permissions'
import { createCompanySchema, updateCompanySchema, type CreateCompanyInput, type UpdateCompanyInput } from '@/lib/validations/company'
import { revalidatePath } from 'next/cache'
import type { ActionResult } from '@/types/actions'
import type { Company } from '@prisma/client'

export async function createCompany(
  input: CreateCompanyInput
): Promise<ActionResult<Company>> {
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
      },
    })

    revalidatePath('/dashboard')
    revalidatePath('/companies')
    return { data: company }
  } catch {
    return { error: 'Selskabet kunne ikke oprettes — prøv igen' }
  }
}

export async function updateCompany(
  input: UpdateCompanyInput
): Promise<ActionResult<Company>> {
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
        ...(parsed.data.companyType !== undefined && { company_type: parsed.data.companyType || null }),
        ...(parsed.data.address !== undefined && { address: parsed.data.address || null }),
        ...(parsed.data.city !== undefined && { city: parsed.data.city || null }),
        ...(parsed.data.postalCode !== undefined && { postal_code: parsed.data.postalCode || null }),
        ...(parsed.data.notes !== undefined && { notes: parsed.data.notes || null }),
      },
    })

    revalidatePath(`/companies/${parsed.data.companyId}`)
    revalidatePath('/companies')
    return { data: company }
  } catch {
    return { error: 'Selskabet kunne ikke opdateres — prøv igen' }
  }
}

export async function deleteCompany(
  companyId: string
): Promise<ActionResult<void>> {
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

    revalidatePath('/dashboard')
    revalidatePath('/companies')
    return { data: undefined }
  } catch {
    return { error: 'Selskabet kunne ikke slettes — prøv igen' }
  }
}
