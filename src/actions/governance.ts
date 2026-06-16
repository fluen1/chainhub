'use server'

import type { CompanyPerson, SensitivityLevel } from '@prisma/client'
import { revalidatePath } from 'next/cache'
import { recordAuditEvent } from '@/lib/audit'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { captureError } from '@/lib/logger'
import { canAccessCompany } from '@/lib/permissions'
import { checkActionRateLimit } from '@/lib/rate-limit'
import {
  addCompanyPersonSchema,
  endCompanyPersonSchema,
  type AddCompanyPersonInput,
  type EndCompanyPersonInput,
} from '@/lib/validations/governance'
import type { ActionResult } from '@/types/actions'

// Direktør og bestyrelse er governance-roller — INTERN sensitivity på audit
const GOVERNANCE_ROLES = new Set(['direktoer', 'bestyrelsesformand', 'bestyrelsesmedlem'])

function sensitivityForRole(role: string): SensitivityLevel | undefined {
  return GOVERNANCE_ROLES.has(role) ? 'INTERN' : undefined
}

export async function addCompanyPerson(
  input: AddCompanyPersonInput
): Promise<ActionResult<CompanyPerson>> {
  const session = await auth()
  if (!session) return { error: 'Ikke autoriseret' }

  const parsed = addCompanyPersonSchema.safeParse(input)
  if (!parsed.success) return { error: 'Ugyldigt input: ' + parsed.error.issues[0]?.message }

  const hasAccess = await canAccessCompany(
    session.user.id,
    parsed.data.companyId,
    session.user.organizationId
  )
  if (!hasAccess) return { error: 'Ingen adgang til dette selskab' }

  const rl = await checkActionRateLimit(session.user.organizationId)
  if (rl.limited) return { error: 'For mange handlinger. Vent venligst.' }

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

    // Check: kun én aktiv direktør pr. selskab
    if (parsed.data.role === 'direktoer') {
      const existingDirector = await prisma.companyPerson.findFirst({
        where: {
          organization_id: session.user.organizationId,
          company_id: parsed.data.companyId,
          role: 'direktoer',
          end_date: null,
        },
      })
      if (existingDirector) {
        return {
          error: 'Selskabet har allerede en aktiv direktør. Afregistrér den nuværende først.',
        }
      }
    }

    const companyPerson = await prisma.companyPerson.create({
      data: {
        organization_id: session.user.organizationId,
        company_id: parsed.data.companyId,
        person_id: personId,
        role: parsed.data.role,
        employment_type: parsed.data.employmentType || null,
        start_date: parsed.data.startDate ? new Date(parsed.data.startDate) : null,
        contract_id: parsed.data.contractId || null,
        created_by: session.user.id,
      },
    })

    await recordAuditEvent({
      organizationId: session.user.organizationId,
      userId: session.user.id,
      action: 'CREATE',
      resourceType: 'company_person',
      resourceId: companyPerson.id,
      sensitivity: sensitivityForRole(parsed.data.role),
      changes: {
        personId,
        companyId: parsed.data.companyId,
        role: parsed.data.role,
        startDate: parsed.data.startDate ?? null,
      },
    })

    revalidatePath(`/companies/${parsed.data.companyId}`)
    return { data: companyPerson }
  } catch (err) {
    captureError(err, {
      namespace: 'action:addCompanyPerson',
      extra: { companyId: parsed.data.companyId, role: parsed.data.role },
    })
    return { error: 'Tilknytning kunne ikke oprettes — prøv igen' }
  }
}

export async function endCompanyPerson(
  input: EndCompanyPersonInput
): Promise<ActionResult<CompanyPerson>> {
  const session = await auth()
  if (!session) return { error: 'Ikke autoriseret' }

  const parsed = endCompanyPersonSchema.safeParse(input)
  if (!parsed.success) return { error: 'Ugyldigt input' }

  // Hent company_id + role til revalidering og audit
  const existing = await prisma.companyPerson.findFirst({
    where: { id: parsed.data.companyPersonId },
    select: { organization_id: true, company_id: true, person_id: true, role: true },
  })
  if (!existing || existing.organization_id !== session.user.organizationId) {
    return { error: 'Tilknytning ikke fundet' }
  }

  const hasAccess = await canAccessCompany(
    session.user.id,
    existing.company_id,
    session.user.organizationId
  )
  if (!hasAccess) return { error: 'Ingen adgang til dette selskab' }

  const rlEnd = await checkActionRateLimit(session.user.organizationId)
  if (rlEnd.limited) return { error: 'For mange handlinger. Vent venligst.' }

  try {
    const companyPerson = await prisma.companyPerson.update({
      where: { id: parsed.data.companyPersonId, organization_id: session.user.organizationId },
      data: { end_date: new Date(parsed.data.endDate) },
    })

    await recordAuditEvent({
      organizationId: session.user.organizationId,
      userId: session.user.id,
      action: 'END',
      resourceType: 'company_person',
      resourceId: companyPerson.id,
      sensitivity: sensitivityForRole(existing.role),
      changes: {
        personId: existing.person_id,
        companyId: existing.company_id,
        role: existing.role,
        endDate: parsed.data.endDate,
        ...(parsed.data.note ? { note: parsed.data.note } : {}),
      },
    })

    revalidatePath(`/companies/${existing.company_id}`)
    return { data: companyPerson }
  } catch (err) {
    captureError(err, {
      namespace: 'action:endCompanyPerson',
      extra: { companyPersonId: parsed.data.companyPersonId },
    })
    return { error: 'Tilknytning kunne ikke afregistreres — prøv igen' }
  }
}
