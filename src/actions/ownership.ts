'use server'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { canAccessCompany, canAccessSensitivity } from '@/lib/permissions'
import {
  addOwnerSchema,
  updateOwnershipSchema,
  endOwnershipSchema,
  type AddOwnerInput,
  type UpdateOwnershipInput,
  type EndOwnershipInput,
} from '@/lib/validations/ownership'
import { revalidatePath } from 'next/cache'
import type { ActionResult } from '@/types/actions'
import type { Ownership } from '@prisma/client'

export async function addOwner(input: AddOwnerInput): Promise<ActionResult<Ownership>> {
  const session = await auth()
  if (!session) return { error: 'Ikke autoriseret' }

  const parsed = addOwnerSchema.safeParse(input)
  if (!parsed.success) return { error: 'Ugyldigt input' }

  const hasCompanyAccess = await canAccessCompany(session.user.id, parsed.data.companyId)
  if (!hasCompanyAccess) return { error: 'Ingen adgang til dette selskab' }

  // Ejerskab er STRENGT_FORTROLIG
  const hasSensitivityAccess = await canAccessSensitivity(session.user.id, 'STRENGT_FORTROLIG')
  if (!hasSensitivityAccess) return { error: 'Du har ikke adgang til at se ejerskabsoplysninger' }

  try {
    let personId = parsed.data.personId

    // Opret ny person hvis ingen personId
    if (!personId) {
      if (!parsed.data.firstName || !parsed.data.lastName) {
        return { error: 'Fornavn og efternavn er påkrævet for ny person' }
      }
      const person = await prisma.person.create({
        data: {
          organization_id: session.user.organizationId,
          first_name: parsed.data.firstName,
          last_name: parsed.data.lastName,
          email: parsed.data.personEmail || null,
          created_by: session.user.id,
        },
      })
      personId = person.id
    }

    const ownership = await prisma.ownership.create({
      data: {
        organization_id: session.user.organizationId,
        company_id: parsed.data.companyId,
        owner_person_id: personId,
        ownership_pct: parsed.data.ownershipPct,
        effective_date: parsed.data.acquiredAt ? new Date(parsed.data.acquiredAt) : null,
        contract_id: parsed.data.contractId || null,
        created_by: session.user.id,
      },
    })

    // Log aktivitet
    await prisma.auditLog.create({
      data: {
        organization_id: session.user.organizationId,
        user_id: session.user.id,
        action: 'CREATE',
        resource_type: 'ownership',
        resource_id: ownership.id,
        sensitivity: 'STRENGT_FORTROLIG',
      },
    })

    revalidatePath(`/companies/${parsed.data.companyId}`)
    return { data: ownership }
  } catch {
    return { error: 'Ejerskab kunne ikke tilføjes — prøv igen' }
  }
}

export async function updateOwnership(
  input: UpdateOwnershipInput
): Promise<ActionResult<Ownership>> {
  const session = await auth()
  if (!session) return { error: 'Ikke autoriseret' }

  const parsed = updateOwnershipSchema.safeParse(input)
  if (!parsed.success) return { error: 'Ugyldigt input' }

  const hasSensitivityAccess = await canAccessSensitivity(session.user.id, 'STRENGT_FORTROLIG')
  if (!hasSensitivityAccess) return { error: 'Ingen adgang' }

  // Verificér tenant isolation
  const existing = await prisma.ownership.findFirst({
    where: { id: parsed.data.ownershipId },
    select: { organization_id: true, company_id: true },
  })
  if (!existing || existing.organization_id !== session.user.organizationId) {
    return { error: 'Ejerskab ikke fundet' }
  }

  try {
    const ownership = await prisma.ownership.update({
      where: { id: parsed.data.ownershipId },
      data: {
        ...(parsed.data.ownershipPct !== undefined && { ownership_pct: parsed.data.ownershipPct }),
        ...(parsed.data.acquiredAt && { effective_date: new Date(parsed.data.acquiredAt) }),
        ...(parsed.data.contractId !== undefined && {
          contract_id: parsed.data.contractId || null,
        }),
      },
    })

    revalidatePath(`/companies/${existing.company_id}`)
    return { data: ownership }
  } catch {
    return { error: 'Ejerskab kunne ikke opdateres — prøv igen' }
  }
}

export async function endOwnership(input: EndOwnershipInput): Promise<ActionResult<Ownership>> {
  const session = await auth()
  if (!session) return { error: 'Ikke autoriseret' }

  const parsed = endOwnershipSchema.safeParse(input)
  if (!parsed.success) return { error: 'Ugyldigt input' }

  const hasSensitivityAccess = await canAccessSensitivity(session.user.id, 'STRENGT_FORTROLIG')
  if (!hasSensitivityAccess) return { error: 'Ingen adgang' }

  const existing = await prisma.ownership.findFirst({
    where: { id: parsed.data.ownershipId },
    select: { organization_id: true, company_id: true },
  })
  if (!existing || existing.organization_id !== session.user.organizationId) {
    return { error: 'Ejerskab ikke fundet' }
  }

  try {
    const ownership = await prisma.ownership.update({
      where: { id: parsed.data.ownershipId },
      data: { end_date: new Date(parsed.data.endDate) },
    })

    await prisma.auditLog.create({
      data: {
        organization_id: session.user.organizationId,
        user_id: session.user.id,
        action: 'UPDATE',
        resource_type: 'ownership',
        resource_id: ownership.id,
        sensitivity: 'STRENGT_FORTROLIG',
        changes: { action: 'end_ownership', end_date: parsed.data.endDate },
      },
    })

    revalidatePath(`/companies/${existing.company_id}`)
    return { data: ownership }
  } catch {
    return { error: 'Ejerskab kunne ikke afregistreres — prøv igen' }
  }
}
