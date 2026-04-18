'use server'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { canAccessCompany } from '@/lib/permissions'
import {
  addCompanyPersonSchema,
  endCompanyPersonSchema,
  type AddCompanyPersonInput,
  type EndCompanyPersonInput,
} from '@/lib/validations/governance'
import { revalidatePath } from 'next/cache'
import type { ActionResult } from '@/types/actions'
import type { CompanyPerson } from '@prisma/client'

export async function addCompanyPerson(
  input: AddCompanyPersonInput
): Promise<ActionResult<CompanyPerson>> {
  const session = await auth()
  if (!session) return { error: 'Ikke autoriseret' }

  const parsed = addCompanyPersonSchema.safeParse(input)
  if (!parsed.success) return { error: 'Ugyldigt input: ' + parsed.error.issues[0]?.message }

  const hasAccess = await canAccessCompany(session.user.id, parsed.data.companyId)
  if (!hasAccess) return { error: 'Ingen adgang til dette selskab' }

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

    revalidatePath(`/companies/${parsed.data.companyId}`)
    return { data: companyPerson }
  } catch {
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

  // Hent company_id til revalidering
  const existing = await prisma.companyPerson.findFirst({
    where: { id: parsed.data.companyPersonId },
    select: { organization_id: true, company_id: true },
  })
  if (!existing || existing.organization_id !== session.user.organizationId) {
    return { error: 'Tilknytning ikke fundet' }
  }

  const hasAccess = await canAccessCompany(session.user.id, existing.company_id)
  if (!hasAccess) return { error: 'Ingen adgang til dette selskab' }

  try {
    const companyPerson = await prisma.companyPerson.update({
      where: { id: parsed.data.companyPersonId },
      data: { end_date: new Date(parsed.data.endDate) },
    })

    revalidatePath(`/companies/${existing.company_id}`)
    return { data: companyPerson }
  } catch {
    return { error: 'Tilknytning kunne ikke afregistreres — prøv igen' }
  }
}
