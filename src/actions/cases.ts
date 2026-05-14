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
import { z } from 'zod'
import { zodCaseType, zodCaseSubtype, zodSensitivityLevel } from '@/lib/zod-enums'
import { revalidatePath } from 'next/cache'
import type { ActionResult } from '@/types/actions'
import type { Case } from '@prisma/client'
import { recordAuditEvent } from '@/lib/audit'
import { captureError } from '@/lib/logger'
import { invalidateCompanyInsightsCache } from '@/lib/ai/invalidate-cache'

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

  const hasModule = await canAccessModule(session.user.id, 'cases', session.user.organizationId)
  if (!hasModule) return { error: 'Ingen adgang til sagsstyring' }

  // Tjek adgang til alle tilknyttede selskaber
  for (const companyId of parsed.data.companyIds) {
    const hasAccess = await canAccessCompany(
      session.user.id,
      companyId,
      session.user.organizationId
    )
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

    await Promise.all(parsed.data.companyIds.map((cId) => invalidateCompanyInsightsCache(cId)))

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

    // Invalider insights-cache for alle tilknyttede selskaber (M:N via CaseCompany)
    const caseCompanies = await prisma.caseCompany.findMany({
      where: { case_id: parsed.data.caseId, organization_id: session.user.organizationId },
      select: { company_id: true },
    })
    await Promise.all(caseCompanies.map((cc) => invalidateCompanyInsightsCache(cc.company_id)))

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

// Zod schema til closeCase
const closeCaseSchema = z.object({
  caseId: z.string().min(1),
  notes: z.string().max(500, 'Maks 500 tegn').optional(),
})

export async function closeCase(caseId: string, notes?: string): Promise<ActionResult<Case>> {
  const session = await auth()
  if (!session) return { error: 'Ikke autoriseret' }

  const parsed = closeCaseSchema.safeParse({ caseId, notes })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Ugyldigt input' }

  const hasModule = await canAccessModule(session.user.id, 'cases', session.user.organizationId)
  if (!hasModule) return { error: 'Ingen adgang til sagsstyring' }

  const existingCase = await prisma.case.findFirst({
    where: {
      id: parsed.data.caseId,
      organization_id: session.user.organizationId,
      deleted_at: null,
    },
    include: { case_companies: { select: { company_id: true } } },
  })
  if (!existingCase) return { error: 'Sag ikke fundet' }
  if (existingCase.status === 'LUKKET') return { error: 'Sagen er allerede lukket' }

  // Tjek adgang til mindst ét tilknyttet selskab
  let hasAccess = false
  for (const cc of existingCase.case_companies) {
    const ok = await canAccessCompany(session.user.id, cc.company_id, session.user.organizationId)
    if (ok) {
      hasAccess = true
      break
    }
  }
  if (!hasAccess) return { error: 'Ingen adgang til denne sag' }

  try {
    const updated = await prisma.case.update({
      where: { id: parsed.data.caseId },
      data: {
        status: 'LUKKET',
        closed_at: new Date(),
      },
    })

    await recordAuditEvent({
      organizationId: session.user.organizationId,
      userId: session.user.id,
      action: 'CLOSE',
      resourceType: 'case',
      resourceId: updated.id,
      sensitivity: existingCase.sensitivity,
      changes: { notes: parsed.data.notes ?? null },
    })

    // Invalider insights-cache
    await Promise.all(
      existingCase.case_companies.map((cc) => invalidateCompanyInsightsCache(cc.company_id))
    )

    revalidatePath('/cases')
    revalidatePath(`/cases/${parsed.data.caseId}`)
    return { data: updated }
  } catch (err) {
    captureError(err, { namespace: 'action:closeCase', extra: { caseId } })
    return { error: 'Sagen kunne ikke lukkes — prøv igen' }
  }
}

// Eskalér sag: tilføjer kommentar + audit. Case-modellen har ikke eget priority-felt.
export async function escalateCase(caseId: string): Promise<ActionResult<void>> {
  const session = await auth()
  if (!session) return { error: 'Ikke autoriseret' }

  if (!caseId || caseId.trim().length === 0) return { error: 'Sags-ID mangler' }

  const hasModule = await canAccessModule(session.user.id, 'cases', session.user.organizationId)
  if (!hasModule) return { error: 'Ingen adgang til sagsstyring' }

  const existingCase = await prisma.case.findFirst({
    where: {
      id: caseId,
      organization_id: session.user.organizationId,
      deleted_at: null,
    },
    include: { case_companies: { select: { company_id: true } } },
  })
  if (!existingCase) return { error: 'Sag ikke fundet' }
  if (existingCase.status === 'LUKKET') return { error: 'Lukkede sager kan ikke eskaleres' }

  let hasAccess = false
  for (const cc of existingCase.case_companies) {
    const ok = await canAccessCompany(session.user.id, cc.company_id, session.user.organizationId)
    if (ok) {
      hasAccess = true
      break
    }
  }
  if (!hasAccess) return { error: 'Ingen adgang til denne sag' }

  try {
    // Hent bruger-navn til eskalerings-kommentar
    const user = await prisma.user.findFirst({
      where: { id: session.user.id, organization_id: session.user.organizationId },
      select: { name: true, email: true },
    })
    const userName = user?.name ?? user?.email ?? 'Ukendt bruger'
    const now = new Date()
    const dateStr = now.toLocaleDateString('da-DK', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })

    await prisma.comment.create({
      data: {
        organization_id: session.user.organizationId,
        case_id: caseId,
        content: `**Eskaleret af ${userName}** · ${dateStr}`,
        created_by: session.user.id,
      },
    })

    await recordAuditEvent({
      organizationId: session.user.organizationId,
      userId: session.user.id,
      action: 'ESCALATE',
      resourceType: 'case',
      resourceId: caseId,
      sensitivity: existingCase.sensitivity,
    })

    revalidatePath('/cases')
    revalidatePath(`/cases/${caseId}`)
    return { data: undefined }
  } catch (err) {
    captureError(err, { namespace: 'action:escalateCase', extra: { caseId } })
    return { error: 'Eskalering mislykkedes — prøv igen' }
  }
}

// Zod schema til updateCase
const updateCaseSchema = z.object({
  caseId: z.string().min(1),
  title: z.string().min(1, 'Titel er påkrævet').max(255).optional(),
  description: z.string().max(5000).optional(),
  caseType: zodCaseType.optional(),
  caseSubtype: zodCaseSubtype.optional(),
  sensitivity: zodSensitivityLevel.optional(),
  assignedTo: z.string().min(1).nullable().optional(),
  dueDate: z.string().nullable().optional(),
})

export type UpdateCaseInput = z.infer<typeof updateCaseSchema>

export async function updateCase(input: UpdateCaseInput): Promise<ActionResult<Case>> {
  const session = await auth()
  if (!session) return { error: 'Ikke autoriseret' }

  const parsed = updateCaseSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Ugyldigt input' }

  const hasModule = await canAccessModule(session.user.id, 'cases', session.user.organizationId)
  if (!hasModule) return { error: 'Ingen adgang til sagsstyring' }

  const existingCase = await prisma.case.findFirst({
    where: {
      id: parsed.data.caseId,
      organization_id: session.user.organizationId,
      deleted_at: null,
    },
    include: { case_companies: { select: { company_id: true } } },
  })
  if (!existingCase) return { error: 'Sag ikke fundet' }

  let hasAccess = false
  for (const cc of existingCase.case_companies) {
    const ok = await canAccessCompany(session.user.id, cc.company_id, session.user.organizationId)
    if (ok) {
      hasAccess = true
      break
    }
  }
  if (!hasAccess) return { error: 'Ingen adgang til denne sag' }

  try {
    const updateData: Record<string, unknown> = {}
    if (parsed.data.title !== undefined) updateData.title = parsed.data.title
    if (parsed.data.description !== undefined)
      updateData.description = parsed.data.description || null
    if (parsed.data.caseType !== undefined) updateData.case_type = parsed.data.caseType
    if (parsed.data.caseSubtype !== undefined) updateData.case_subtype = parsed.data.caseSubtype
    if (parsed.data.sensitivity !== undefined) updateData.sensitivity = parsed.data.sensitivity
    if (parsed.data.assignedTo !== undefined) updateData.responsible_id = parsed.data.assignedTo
    if (parsed.data.dueDate !== undefined) {
      updateData.due_date = parsed.data.dueDate ? new Date(parsed.data.dueDate) : null
    }

    const updated = await prisma.case.update({
      where: { id: parsed.data.caseId },
      data: updateData as never,
    })

    await recordAuditEvent({
      organizationId: session.user.organizationId,
      userId: session.user.id,
      action: 'UPDATE',
      resourceType: 'case',
      resourceId: updated.id,
      sensitivity: existingCase.sensitivity,
      changes: updateData,
    })

    await Promise.all(
      existingCase.case_companies.map((cc) => invalidateCompanyInsightsCache(cc.company_id))
    )

    revalidatePath('/cases')
    revalidatePath(`/cases/${parsed.data.caseId}`)
    return { data: updated }
  } catch (err) {
    captureError(err, { namespace: 'action:updateCase', extra: { caseId: parsed.data.caseId } })
    return { error: 'Sagen kunne ikke opdateres — prøv igen' }
  }
}

export async function deleteCase(caseId: string): Promise<ActionResult<void>> {
  const session = await auth()
  if (!session) return { error: 'Ikke autoriseret' }

  const hasModule = await canAccessModule(session.user.id, 'settings', session.user.organizationId)
  if (!hasModule) return { error: 'Ingen adgang' }

  const existingCase = await prisma.case.findFirst({
    where: { id: caseId, organization_id: session.user.organizationId, deleted_at: null },
  })
  if (!existingCase) return { error: 'Sag ikke fundet' }

  await prisma.case.update({
    where: { id: caseId },
    data: { deleted_at: new Date() },
  })

  // Invalider insights-cache for alle tilknyttede selskaber
  const caseCompanies = await prisma.caseCompany.findMany({
    where: { case_id: caseId, organization_id: session.user.organizationId },
    select: { company_id: true },
  })
  await Promise.all(caseCompanies.map((cc) => invalidateCompanyInsightsCache(cc.company_id)))

  revalidatePath('/cases')
  return { data: undefined }
}
