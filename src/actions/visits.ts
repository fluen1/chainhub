'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { captureError } from '@/lib/logger'
import { canAccessCompany, getAccessibleCompanies } from '@/lib/permissions'
import { checkActionRateLimit } from '@/lib/rate-limit'
import { zodVisitType, zodVisitStatus } from '@/lib/zod-enums'
import type { ActionResult } from '@/types/actions'

// ─────────────────────────────────────────────────────────────────────────────
// Page-data queries (flyt Prisma-kald ud af page.tsx)
// ─────────────────────────────────────────────────────────────────────────────

export interface VisitDetailPageData {
  visit: {
    id: string
    organization_id: string
    company_id: string
    visited_by: string
    visit_date: Date
    visit_type: string
    status: string
    notes: string | null
    summary: string | null
    created_at: Date
    company: { id: string; name: string }
    visitor: { id: string; name: string | null }
  }
  canReopen: boolean
}

export async function getVisitDetailPageData(visitId: string): Promise<VisitDetailPageData | null> {
  const session = await auth()
  if (!session) return null

  const [visit, userRoles] = await Promise.all([
    prisma.visit.findFirst({
      where: {
        id: visitId,
        organization_id: session.user.organizationId,
        deleted_at: null,
      },
      include: {
        company: { select: { id: true, name: true } },
        visitor: { select: { id: true, name: true } },
      },
    }),
    prisma.userRoleAssignment.findMany({
      where: { user_id: session.user.id, organization_id: session.user.organizationId },
      select: { role: true },
    }),
  ])

  if (!visit) return null

  const hasAccess = await canAccessCompany(
    session.user.id,
    visit.company_id,
    session.user.organizationId
  )
  if (!hasAccess) return null

  const canReopen = userRoles.some((r) => ['GROUP_OWNER', 'GROUP_ADMIN'].includes(r.role))

  return { visit, canReopen }
}

export async function getVisitTitle(visitId: string): Promise<string> {
  const session = await auth()
  if (!session) return 'Besøg'
  const visit = await prisma.visit.findFirst({
    where: { id: visitId, organization_id: session.user.organizationId, deleted_at: null },
    select: { company: { select: { name: true } }, visit_date: true },
  })
  if (!visit) return 'Besøg'
  const date = visit.visit_date.toISOString().slice(0, 10)
  return `Besøg · ${visit.company.name} · ${date}`
}

export async function getVisitNewPageCompanies(): Promise<Array<{ id: string; name: string }>> {
  const session = await auth()
  if (!session) return []

  const companyIds = await getAccessibleCompanies(session.user.id, session.user.organizationId)

  if (companyIds.length === 0) return []

  return prisma.company.findMany({
    where: {
      id: { in: companyIds },
      organization_id: session.user.organizationId,
      deleted_at: null,
    },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  })
}

const createVisitSchema = z.object({
  companyId: z.string().min(1, 'Selskab mangler'),
  visitDate: z.string(),
  visitType: zodVisitType,
  notes: z.string().optional(),
})

const updateVisitSchema = z.object({
  visitId: z.string().min(1, 'Besøg-ID mangler'),
  status: zodVisitStatus.optional(),
  notes: z.string().optional(),
  summary: z.string().optional(),
})

type CreateVisitInput = z.infer<typeof createVisitSchema>
type UpdateVisitInput = z.infer<typeof updateVisitSchema>

export async function createVisit(input: CreateVisitInput): Promise<ActionResult<{ id: string }>> {
  const session = await auth()
  if (!session) return { error: 'Din session er udløbet — log ind igen.' }

  const parsed = createVisitSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Ugyldigt input' }

  const hasAccess = await canAccessCompany(
    session.user.id,
    parsed.data.companyId,
    session.user.organizationId
  )
  if (!hasAccess) return { error: 'Ingen adgang til dette selskab' }

  const rl = await checkActionRateLimit(session.user.organizationId)
  if (rl.limited) return { error: 'For mange handlinger. Vent venligst.' }

  try {
    const visit = await prisma.visit.create({
      data: {
        organization_id: session.user.organizationId,
        company_id: parsed.data.companyId,
        visited_by: session.user.id,
        visit_date: new Date(parsed.data.visitDate),
        visit_type: parsed.data.visitType,
        status: 'PLANLAGT',
        notes: parsed.data.notes || null,
        created_by: session.user.id,
      },
    })

    revalidatePath('/visits')
    revalidatePath(`/companies/${parsed.data.companyId}`)
    revalidatePath('/dashboard')
    revalidateTag('calendar', {})
    return { data: { id: visit.id } }
  } catch (err) {
    captureError(err, {
      namespace: 'action:createVisit',
      extra: { companyId: parsed.data.companyId, visitType: parsed.data.visitType },
    })
    return { error: 'Besøget kunne ikke oprettes — prøv igen' }
  }
}

export async function updateVisit(input: UpdateVisitInput): Promise<ActionResult<{ id: string }>> {
  const session = await auth()
  if (!session) return { error: 'Din session er udløbet — log ind igen.' }

  const parsed = updateVisitSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Ugyldigt input' }

  const visit = await prisma.visit.findFirst({
    where: {
      id: parsed.data.visitId,
      organization_id: session.user.organizationId,
      deleted_at: null,
    },
  })
  if (!visit) return { error: 'Besøg ikke fundet' }

  const hasAccess = await canAccessCompany(
    session.user.id,
    visit.company_id,
    session.user.organizationId
  )
  if (!hasAccess) return { error: 'Ingen adgang til dette selskab' }

  const rlUpd = await checkActionRateLimit(session.user.organizationId)
  if (rlUpd.limited) return { error: 'For mange handlinger. Vent venligst.' }

  try {
    const updated = await prisma.visit.update({
      where: { id: parsed.data.visitId },
      data: {
        ...(parsed.data.status ? { status: parsed.data.status } : {}),
        ...(parsed.data.notes !== undefined ? { notes: parsed.data.notes } : {}),
        ...(parsed.data.summary !== undefined ? { summary: parsed.data.summary } : {}),
      },
    })

    revalidatePath('/visits')
    revalidatePath(`/visits/${parsed.data.visitId}`)
    revalidatePath(`/companies/${visit.company_id}`)
    revalidatePath('/dashboard')
    revalidateTag('calendar', {})
    return { data: { id: updated.id } }
  } catch (err) {
    captureError(err, {
      namespace: 'action:updateVisit',
      extra: { visitId: parsed.data.visitId },
    })
    return { error: 'Besøget kunne ikke opdateres — prøv igen' }
  }
}

export async function deleteVisit(visitId: string): Promise<ActionResult<void>> {
  const session = await auth()
  if (!session) return { error: 'Din session er udløbet — log ind igen.' }

  const visit = await prisma.visit.findFirst({
    where: {
      id: visitId,
      organization_id: session.user.organizationId,
      deleted_at: null,
    },
  })
  if (!visit) return { error: 'Besøg ikke fundet' }

  const hasAccess = await canAccessCompany(
    session.user.id,
    visit.company_id,
    session.user.organizationId
  )
  if (!hasAccess)
    return { error: 'Du har ikke adgang til denne funktion. Kontakt din administrator.' }

  const rlDel = await checkActionRateLimit(session.user.organizationId)
  if (rlDel.limited) return { error: 'For mange handlinger. Vent venligst.' }

  await prisma.visit.update({
    where: { id: visitId },
    data: { deleted_at: new Date() },
  })

  revalidatePath('/visits')
  revalidatePath(`/companies/${visit.company_id}`)
  revalidatePath('/dashboard')
  revalidateTag('calendar', {})
  return { data: undefined }
}
