'use server'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { canAccessCompany, canAccessModule } from '@/lib/permissions'
import {
  createCaseSchema,
  updateCaseStatusSchema,
  type CreateCaseInput,
  type UpdateCaseStatusInput,
} from '@/lib/validations/case'
import { revalidatePath } from 'next/cache'
import type { ActionResult } from '@/types/actions'
import type { Case } from '@prisma/client'
import { recordAuditEvent } from '@/lib/audit'
import { captureError } from '@/lib/logger'

// Gyldige sagsstatus-transitioner
const CASE_TRANSITIONS: Record<string, string[]> = {
  NY: ['AKTIV'],
  AKTIV: ['AFVENTER_EKSTERN', 'AFVENTER_KLIENT', 'LUKKET'],
  AFVENTER_EKSTERN: ['AKTIV', 'LUKKET'],
  AFVENTER_KLIENT: ['AKTIV', 'LUKKET'],
  LUKKET: ['AKTIV', 'ARKIVERET'],
  ARKIVERET: [],
}

// Generer sagsnummer: CAS-YYYY-NNNN
async function generateCaseNumber(organizationId: string): Promise<string> {
  const year = new Date().getFullYear()
  const count = await prisma.case.count({
    where: {
      organization_id: organizationId,
      created_at: {
        gte: new Date(`${year}-01-01`),
        lt: new Date(`${year + 1}-01-01`),
      },
    },
  })
  return `CAS-${year}-${String(count + 1).padStart(4, '0')}`
}

export async function createCase(input: CreateCaseInput): Promise<ActionResult<Case>> {
  const session = await auth()
  if (!session) return { error: 'Ikke autoriseret' }

  const parsed = createCaseSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Ugyldigt input' }

  const hasModule = await canAccessModule(session.user.id, 'cases')
  if (!hasModule) return { error: 'Ingen adgang til sagsstyring' }

  // Tjek adgang til alle tilknyttede selskaber
  for (const companyId of parsed.data.companyIds) {
    const hasAccess = await canAccessCompany(session.user.id, companyId)
    if (!hasAccess) return { error: `Ingen adgang til selskab ${companyId}` }
  }

  try {
    const caseNumber = await generateCaseNumber(session.user.organizationId)

    // Sagsnummeret gemmes i description-feltet med prefix
    const descriptionWithNumber = [caseNumber, parsed.data.description ?? '']
      .filter(Boolean)
      .join('\n')

    const newCase = await prisma.case.create({
      data: {
        organization_id: session.user.organizationId,
        title: parsed.data.title,
        case_type: parsed.data.caseType,
        case_subtype: parsed.data.caseSubtype ?? null,
        status: 'NY',
        sensitivity: parsed.data.sensitivity,
        description: descriptionWithNumber || null,
        responsible_id: parsed.data.assignedTo || null,
        created_by: session.user.id,
      },
    })

    // Opret CaseCompany-records
    await Promise.all(
      parsed.data.companyIds.map((companyId) =>
        prisma.caseCompany.create({
          data: {
            organization_id: session.user.organizationId,
            case_id: newCase.id,
            company_id: companyId,
            created_by: session.user.id,
          },
        })
      )
    )

    revalidatePath('/cases')
    parsed.data.companyIds.forEach((cId) => revalidatePath(`/companies/${cId}/cases`))
    return { data: newCase }
  } catch (err) {
    captureError(err, {
      namespace: 'action:createCase',
      extra: {
        caseType: parsed.data.caseType,
        companyIds: parsed.data.companyIds,
      },
    })
    return { error: 'Sagen kunne ikke oprettes — prøv igen' }
  }
}

export async function updateCaseStatus(input: UpdateCaseStatusInput): Promise<ActionResult<Case>> {
  const session = await auth()
  if (!session) return { error: 'Ikke autoriseret' }

  const parsed = updateCaseStatusSchema.safeParse(input)
  if (!parsed.success) return { error: 'Ugyldigt input' }

  const existingCase = await prisma.case.findFirst({
    where: {
      id: parsed.data.caseId,
      organization_id: session.user.organizationId,
      deleted_at: null,
    },
  })
  if (!existingCase) return { error: 'Sag ikke fundet' }

  const validNext = CASE_TRANSITIONS[existingCase.status] ?? []
  if (!validNext.includes(parsed.data.status)) {
    return { error: `Ugyldig statusændring: ${existingCase.status} → ${parsed.data.status}` }
  }

  try {
    const updated = await prisma.case.update({
      where: { id: parsed.data.caseId },
      data: {
        status: parsed.data.status,
        ...(parsed.data.status === 'LUKKET' ? { closed_at: new Date() } : {}),
      },
    })

    await recordAuditEvent({
      organizationId: session.user.organizationId,
      userId: session.user.id,
      action: 'STATUS_CHANGE',
      resourceType: 'case',
      resourceId: updated.id,
      sensitivity: existingCase.sensitivity,
      changes: { oldStatus: existingCase.status, newStatus: parsed.data.status },
    })

    revalidatePath('/cases')
    revalidatePath(`/cases/${parsed.data.caseId}`)
    return { data: updated }
  } catch (err) {
    captureError(err, {
      namespace: 'action:updateCaseStatus',
      extra: { caseId: parsed.data.caseId, newStatus: parsed.data.status },
    })
    return { error: 'Status kunne ikke opdateres — prøv igen' }
  }
}

export async function deleteCase(caseId: string): Promise<ActionResult<void>> {
  const session = await auth()
  if (!session) return { error: 'Ikke autoriseret' }

  const hasModule = await canAccessModule(session.user.id, 'settings')
  if (!hasModule) return { error: 'Ingen adgang' }

  const existingCase = await prisma.case.findFirst({
    where: { id: caseId, organization_id: session.user.organizationId, deleted_at: null },
  })
  if (!existingCase) return { error: 'Sag ikke fundet' }

  await prisma.case.update({
    where: { id: caseId },
    data: { deleted_at: new Date() },
  })

  revalidatePath('/cases')
  return { data: undefined }
}
