'use server'

import type { Ownership } from '@prisma/client'
import { revalidatePath } from 'next/cache'
import { recordAuditEvent } from '@/lib/audit'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { captureError } from '@/lib/logger'
import { canAccessCompany, canAccessSensitivity } from '@/lib/permissions'
import { checkActionRateLimit } from '@/lib/rate-limit'
import {
  addOwnerSchema,
  updateOwnershipSchema,
  endOwnershipSchema,
  type AddOwnerInput,
  type UpdateOwnershipInput,
  type EndOwnershipInput,
} from '@/lib/validations/ownership'
import type { ActionResult } from '@/types/actions'

export async function addOwner(input: AddOwnerInput): Promise<ActionResult<Ownership>> {
  const session = await auth()
  if (!session) return { error: 'Din session er udløbet — log ind igen.' }

  const parsed = addOwnerSchema.safeParse(input)
  if (!parsed.success) return { error: 'Udfyld alle påkrævede felter og prøv igen.' }

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
  if (!hasSensitivityAccess) return { error: 'Du har ikke adgang til at se ejerskabsoplysninger' }

  const rl = await checkActionRateLimit(session.user.organizationId)
  if (rl.limited) return { error: 'For mange handlinger. Vent venligst.' }

  // Forsøg op til 3 gange ved serialization-konflikt
  const MAX_RETRIES = 3
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      let personId = parsed.data.personId

      // Opret ny person hvis ingen personId (udenfor transaction — person er ikke ejerskabs-kritisk)
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

      const resolvedPersonId = personId

      // SERIALIZABLE transaction: sum-tjek + insert atomisk
      const ownership = await prisma.$transaction(
        async (tx) => {
          // Sum af eksisterende aktive ejerskaber (end_date IS NULL og deleted_at IS NULL)
          const sumResult = await tx.ownership.aggregate({
            where: {
              company_id: parsed.data.companyId,
              organization_id: session.user.organizationId,
              end_date: null,
              deleted_at: null,
            },
            _sum: { ownership_pct: true },
          })

          const existingSum = Number(sumResult._sum.ownership_pct ?? 0)
          const newTotal = existingSum + parsed.data.ownershipPct

          if (newTotal > 100) {
            throw new RangeError(
              `Samlet ejerskab kan ikke overstige 100% (eksisterende: ${existingSum.toFixed(2)}%)`
            )
          }

          return tx.ownership.create({
            data: {
              organization_id: session.user.organizationId,
              company_id: parsed.data.companyId,
              owner_person_id: resolvedPersonId,
              ownership_pct: parsed.data.ownershipPct,
              effective_date: parsed.data.acquiredAt ? new Date(parsed.data.acquiredAt) : null,
              contract_id: parsed.data.contractId || null,
              created_by: session.user.id,
            },
          })
        },
        { isolationLevel: 'Serializable' }
      )

      await recordAuditEvent({
        organizationId: session.user.organizationId,
        userId: session.user.id,
        action: 'CREATE',
        resourceType: 'ownership',
        resourceId: ownership.id,
        resourceCompanyId: parsed.data.companyId,
        sensitivity: 'STRENGT_FORTROLIG',
        changes: {
          companyId: parsed.data.companyId,
          ownershipPct: Number(ownership.ownership_pct),
          ...(parsed.data.note ? { note: parsed.data.note } : {}),
        },
      })

      revalidatePath(`/companies/${parsed.data.companyId}`)
      return { data: ownership }
    } catch (err) {
      // RangeError = forretningsregel-fejl, retur med det samme
      if (err instanceof RangeError) {
        return { error: err.message }
      }
      // Serialization conflict (Postgres error code 40001) — prøv igen
      const pgCode = (err as { code?: string }).code
      if (pgCode === '40001' && attempt < MAX_RETRIES - 1) {
        continue
      }
      captureError(err, {
        namespace: 'action:addOwner',
        extra: { companyId: parsed.data.companyId, attempt },
      })
      return { error: 'Ejerskab kunne ikke tilføjes — prøv igen' }
    }
  }

  return { error: 'Ejerskab kunne ikke tilføjes — prøv igen' }
}

export async function updateOwnership(
  input: UpdateOwnershipInput
): Promise<ActionResult<Ownership>> {
  const session = await auth()
  if (!session) return { error: 'Din session er udløbet — log ind igen.' }

  const parsed = updateOwnershipSchema.safeParse(input)
  if (!parsed.success) return { error: 'Udfyld alle påkrævede felter og prøv igen.' }

  const hasSensitivityAccess = await canAccessSensitivity(
    session.user.id,
    'STRENGT_FORTROLIG',
    session.user.organizationId
  )
  if (!hasSensitivityAccess)
    return { error: 'Du har ikke adgang til denne funktion. Kontakt din administrator.' }

  const rlUpd = await checkActionRateLimit(session.user.organizationId)
  if (rlUpd.limited) return { error: 'For mange handlinger. Vent venligst.' }

  // Verificér tenant isolation + læs før-værdier til audit
  const existing = await prisma.ownership.findFirst({
    where: { id: parsed.data.ownershipId },
    select: {
      organization_id: true,
      company_id: true,
      ownership_pct: true,
      effective_date: true,
      contract_id: true,
    },
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

    await recordAuditEvent({
      organizationId: session.user.organizationId,
      userId: session.user.id,
      action: 'UPDATE',
      resourceType: 'ownership',
      resourceId: ownership.id,
      resourceCompanyId: existing.company_id,
      sensitivity: 'STRENGT_FORTROLIG',
      changes: {
        oldOwnershipPct: Number(existing.ownership_pct),
        newOwnershipPct: Number(ownership.ownership_pct),
        oldEffectiveDate: existing.effective_date?.toISOString() ?? null,
        newEffectiveDate: ownership.effective_date?.toISOString() ?? null,
        oldContractId: existing.contract_id,
        newContractId: ownership.contract_id,
      },
    })

    revalidatePath(`/companies/${existing.company_id}`)
    return { data: ownership }
  } catch (err) {
    captureError(err, {
      namespace: 'action:updateOwnership',
      extra: { ownershipId: parsed.data.ownershipId },
    })
    return { error: 'Ejerskab kunne ikke opdateres — prøv igen' }
  }
}

export async function endOwnership(input: EndOwnershipInput): Promise<ActionResult<Ownership>> {
  const session = await auth()
  if (!session) return { error: 'Din session er udløbet — log ind igen.' }

  const parsed = endOwnershipSchema.safeParse(input)
  if (!parsed.success) return { error: 'Udfyld alle påkrævede felter og prøv igen.' }

  const hasSensitivityAccess = await canAccessSensitivity(
    session.user.id,
    'STRENGT_FORTROLIG',
    session.user.organizationId
  )
  if (!hasSensitivityAccess)
    return { error: 'Du har ikke adgang til denne funktion. Kontakt din administrator.' }

  const rlEnd = await checkActionRateLimit(session.user.organizationId)
  if (rlEnd.limited) return { error: 'For mange handlinger. Vent venligst.' }

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

    await recordAuditEvent({
      organizationId: session.user.organizationId,
      userId: session.user.id,
      action: 'END',
      resourceType: 'ownership',
      resourceId: ownership.id,
      resourceCompanyId: existing.company_id,
      sensitivity: 'STRENGT_FORTROLIG',
      changes: {
        endDate: parsed.data.endDate,
        ...(parsed.data.note ? { note: parsed.data.note } : {}),
      },
    })

    revalidatePath(`/companies/${existing.company_id}`)
    return { data: ownership }
  } catch (err) {
    captureError(err, {
      namespace: 'action:endOwnership',
      extra: { ownershipId: parsed.data.ownershipId },
    })
    return { error: 'Ejerskab kunne ikke afregistreres — prøv igen' }
  }
}
