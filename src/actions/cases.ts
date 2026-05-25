'use server'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import type { Prisma } from '@prisma/client'
import {
  canAccessCompany,
  canAccessModule,
  canAccessSensitivity,
  getAccessibleCompanies,
} from '@/lib/permissions'
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
import { checkActionRateLimit } from '@/lib/rate-limit'

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
  if (!session) return { error: 'Din session er udløbet — log ind igen.' }

  const parsed = createCaseSchema.safeParse(input)
  if (!parsed.success)
    return {
      error: parsed.error.issues[0]?.message ?? 'Udfyld alle påkrævede felter og prøv igen.',
    }

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

  // Tjek at bruger har adgang til det valgte sensitivitetsniveau
  if (parsed.data.sensitivity) {
    const hasSensitivity = await canAccessSensitivity(
      session.user.id,
      parsed.data.sensitivity,
      session.user.organizationId
    )
    if (!hasSensitivity)
      return { error: 'Du har ikke adgang til at oprette sager på dette fortrolighedsniveau' }
  }

  const rl = await checkActionRateLimit(session.user.organizationId)
  if (rl.limited) return { error: 'For mange handlinger. Vent venligst.' }

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
  if (!session) return { error: 'Din session er udløbet — log ind igen.' }

  const parsed = updateCaseStatusSchema.safeParse(input)
  if (!parsed.success) return { error: 'Udfyld alle påkrævede felter og prøv igen.' }

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
    return { error: 'Sagen kan ikke ændres til denne status i det nuværende forløb.' }
  }

  const rl = await checkActionRateLimit(session.user.organizationId)
  if (rl.limited) return { error: 'For mange handlinger. Vent venligst.' }

  try {
    const updated = await prisma.case.update({
      where: { id: parsed.data.caseId },
      data: {
        status: parsed.data.status,
        ...(parsed.data.status === 'LUKKET' ? { closed_at: new Date() } : {}),
      },
    })

    // Hent første tilknyttede selskab til resourceCompanyId
    const firstCaseCompany = await prisma.caseCompany.findFirst({
      where: { case_id: parsed.data.caseId, organization_id: session.user.organizationId },
      select: { company_id: true },
    })

    await recordAuditEvent({
      organizationId: session.user.organizationId,
      userId: session.user.id,
      action: 'STATUS_CHANGE',
      resourceType: 'case',
      resourceId: updated.id,
      resourceCompanyId: firstCaseCompany?.company_id,
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
  if (!session) return { error: 'Din session er udløbet — log ind igen.' }

  const parsed = closeCaseSchema.safeParse({ caseId, notes })
  if (!parsed.success)
    return {
      error: parsed.error.issues[0]?.message ?? 'Udfyld alle påkrævede felter og prøv igen.',
    }

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

  const rlClose = await checkActionRateLimit(session.user.organizationId)
  if (rlClose.limited) return { error: 'For mange handlinger. Vent venligst.' }

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
      resourceCompanyId: existingCase.case_companies[0]?.company_id,
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
  if (!session) return { error: 'Din session er udløbet — log ind igen.' }

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

  const rlEsc = await checkActionRateLimit(session.user.organizationId)
  if (rlEsc.limited) return { error: 'For mange handlinger. Vent venligst.' }

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
      resourceCompanyId: existingCase.case_companies[0]?.company_id,
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
  if (!session) return { error: 'Din session er udløbet — log ind igen.' }

  const parsed = updateCaseSchema.safeParse(input)
  if (!parsed.success)
    return {
      error: parsed.error.issues[0]?.message ?? 'Udfyld alle påkrævede felter og prøv igen.',
    }

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

  const rlUpd = await checkActionRateLimit(session.user.organizationId)
  if (rlUpd.limited) return { error: 'For mange handlinger. Vent venligst.' }

  // Tjek at bruger har adgang til det nye sensitivitetsniveau
  if (parsed.data.sensitivity !== undefined) {
    const hasSensitivity = await canAccessSensitivity(
      session.user.id,
      parsed.data.sensitivity,
      session.user.organizationId
    )
    if (!hasSensitivity)
      return { error: 'Du har ikke adgang til at sætte dette fortrolighedsniveau på sagen' }
  }

  try {
    const updateData: Prisma.CaseUncheckedUpdateInput = {}
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
      data: updateData,
    })

    await recordAuditEvent({
      organizationId: session.user.organizationId,
      userId: session.user.id,
      action: 'UPDATE',
      resourceType: 'case',
      resourceId: updated.id,
      resourceCompanyId: existingCase.case_companies[0]?.company_id,
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
  if (!session) return { error: 'Din session er udløbet — log ind igen.' }

  const hasModule = await canAccessModule(session.user.id, 'settings', session.user.organizationId)
  if (!hasModule)
    return { error: 'Du har ikke adgang til denne funktion. Kontakt din administrator.' }

  const rlDel = await checkActionRateLimit(session.user.organizationId)
  if (rlDel.limited) return { error: 'For mange handlinger. Vent venligst.' }

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

  await recordAuditEvent({
    organizationId: session.user.organizationId,
    userId: session.user.id,
    action: 'DELETE',
    resourceType: 'case',
    resourceId: caseId,
    resourceCompanyId: caseCompanies[0]?.company_id,
    sensitivity: existingCase.sensitivity,
  })

  revalidatePath('/cases')
  return { data: undefined }
}

// ─────────────────────────────────────────────────────────────────────────────
// Page-data queries (flyt Prisma-kald ud af page.tsx)
// ─────────────────────────────────────────────────────────────────────────────

export interface CaseListRow {
  id: string
  nr: string
  type: string
  rawType: string
  title: string
  desc: string
  companyId: string | null
  selskab: string
  status: string
  rawStatus: string
  frist: string
  fristDays: number
  ansvarlig: string
  updatedAt: number
}

export interface CasesPageData {
  cases: CaseListRow[]
  totalCount: number
}

export async function getCasesPageData(): Promise<CasesPageData> {
  const session = await auth()
  if (!session) return { cases: [], totalCount: 0 }

  const orgId = session.user.organizationId

  const hasAccess = await canAccessModule(session.user.id, 'cases', orgId)
  if (!hasAccess) return { cases: [], totalCount: 0 }

  const companyIds = await getAccessibleCompanies(session.user.id, orgId)
  if (companyIds.length === 0) return { cases: [], totalCount: 0 }

  const caseCompanyLinks = await prisma.caseCompany.findMany({
    where: {
      organization_id: orgId,
      company_id: { in: companyIds },
    },
    select: { case_id: true },
    distinct: ['case_id'],
  })
  const caseIds = caseCompanyLinks.map((cc) => cc.case_id)
  if (caseIds.length === 0) return { cases: [], totalCount: 0 }

  const [rawCases, totalCount] = await Promise.all([
    prisma.case.findMany({
      where: {
        organization_id: orgId,
        deleted_at: null,
        id: { in: caseIds },
      },
      include: {
        case_companies: {
          take: 1,
          include: { company: { select: { id: true, name: true } } },
        },
      },
      orderBy: { due_date: 'asc' },
    }),
    prisma.case.count({
      where: { organization_id: orgId, deleted_at: null, id: { in: caseIds } },
    }),
  ])

  const responsibleIds = Array.from(
    new Set(rawCases.map((c) => c.responsible_id).filter((id): id is string => !!id))
  )
  const users = responsibleIds.length
    ? await prisma.user.findMany({
        where: { id: { in: responsibleIds } },
        select: { id: true, name: true, email: true },
      })
    : []
  const userMap = new Map(users.map((u) => [u.id, u.name ?? u.email ?? 'Ukendt']))

  const today = new Date()
  const { getCaseStatusLabel, getCaseTypeLabel } = await import('@/lib/labels')
  const { formatShortDate } = await import('@/lib/date-helpers')

  const cases: CaseListRow[] = rawCases.map((c) => {
    const dueMs = c.due_date?.getTime() ?? null
    const fristDays =
      dueMs != null ? Math.ceil((dueMs - today.getTime()) / (1000 * 60 * 60 * 24)) : 9999

    const firstCompany = c.case_companies[0]?.company
    return {
      id: c.id,
      nr: c.case_number ?? '—',
      type: getCaseTypeLabel(c.case_type),
      rawType: c.case_type,
      title: c.title,
      desc: c.description ?? '',
      companyId: firstCompany?.id ?? null,
      selskab: firstCompany?.name ?? '—',
      status: getCaseStatusLabel(c.status),
      rawStatus: c.status,
      frist: c.due_date ? formatShortDate(c.due_date) : '—',
      fristDays,
      ansvarlig: c.responsible_id ? (userMap.get(c.responsible_id) ?? '—') : '—',
      updatedAt: c.updated_at.getTime(),
    }
  })

  return { cases, totalCount }
}

export async function getCaseTitle(caseId: string): Promise<string> {
  const session = await auth()
  if (!session) return 'Sag'
  const c = await prisma.case.findFirst({
    where: { id: caseId, organization_id: session.user.organizationId, deleted_at: null },
    select: { title: true, case_number: true },
  })
  if (!c) return 'Sag'
  return c.case_number ? `${c.case_number} · ${c.title}` : c.title
}

export type RawCaseDetail = Awaited<ReturnType<typeof getRawCaseDetail>>

async function getRawCaseDetail(id: string, orgId: string) {
  return prisma.case.findFirst({
    where: {
      id,
      organization_id: orgId,
      deleted_at: null,
    },
    include: {
      case_companies: {
        include: { company: { select: { id: true, name: true } } },
      },
      case_contracts: {
        include: {
          contract: {
            select: { id: true, display_name: true, system_type: true, status: true },
          },
        },
      },
      case_persons: {
        include: {
          person: { select: { id: true, first_name: true, last_name: true } },
        },
      },
      tasks: {
        where: { deleted_at: null },
        orderBy: { due_date: 'asc' },
      },
      documents: {
        where: { deleted_at: null },
        orderBy: { uploaded_at: 'desc' },
        take: 10,
        include: { extraction: { select: { extraction_status: true } } },
      },
    },
  })
}

export interface CaseDetailPageData {
  caseItem: NonNullable<RawCaseDetail>
  comments: Array<{
    id: string
    content: string
    created_by: string
    created_at: Date
    author: { id: string; name: string | null; email: string }
  }>
  userMap: Map<string, string>
  currentUserId: string
}

export async function getCaseDetailPageData(caseId: string): Promise<CaseDetailPageData | null> {
  const session = await auth()
  if (!session) return null

  const orgId = session.user.organizationId

  const caseItem = await getRawCaseDetail(caseId, orgId)
  if (!caseItem) return null

  // Adgangscheck — mindst én tilknyttet selskab tilgængeligt
  let hasAccess = false
  for (const cc of caseItem.case_companies) {
    const ok = await canAccessCompany(session.user.id, cc.company.id, orgId)
    if (ok) {
      hasAccess = true
      break
    }
  }
  if (!hasAccess) return null

  const hasModule = await canAccessModule(session.user.id, 'cases', orgId)
  if (!hasModule) return null

  const hasSensitivity = await canAccessSensitivity(session.user.id, caseItem.sensitivity, orgId)
  if (!hasSensitivity) return null

  const commentsRaw = await prisma.comment.findMany({
    where: { case_id: caseId, organization_id: orgId, deleted_at: null },
    orderBy: { created_at: 'desc' },
    include: { author: { select: { id: true, name: true, email: true } } },
  })

  const userIds = Array.from(
    new Set(
      [caseItem.responsible_id, ...caseItem.tasks.map((t) => t.assigned_to ?? null)].filter(
        (id): id is string => !!id
      )
    )
  )
  const users = userIds.length
    ? await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, name: true, email: true },
      })
    : []
  const userMap = new Map(users.map((u) => [u.id, u.name ?? u.email ?? 'Ukendt']))

  return {
    caseItem,
    comments: commentsRaw,
    userMap,
    currentUserId: session.user.id,
  }
}
