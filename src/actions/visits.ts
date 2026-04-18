'use server'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { canAccessCompany } from '@/lib/permissions'
import { revalidatePath } from 'next/cache'
import type { ActionResult } from '@/types/actions'
import { z } from 'zod'
import { captureError } from '@/lib/logger'
import { zodVisitType, zodVisitStatus } from '@/lib/zod-enums'

const createVisitSchema = z.object({
  companyId: z.string().uuid(),
  visitDate: z.string(),
  visitType: zodVisitType,
  notes: z.string().optional(),
})

const updateVisitSchema = z.object({
  visitId: z.string().uuid(),
  status: zodVisitStatus.optional(),
  notes: z.string().optional(),
  summary: z.string().optional(),
})

type CreateVisitInput = z.infer<typeof createVisitSchema>
type UpdateVisitInput = z.infer<typeof updateVisitSchema>

export async function createVisit(input: CreateVisitInput): Promise<ActionResult<{ id: string }>> {
  const session = await auth()
  if (!session) return { error: 'Ikke autoriseret' }

  const parsed = createVisitSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Ugyldigt input' }

  const hasAccess = await canAccessCompany(session.user.id, parsed.data.companyId)
  if (!hasAccess) return { error: 'Ingen adgang til dette selskab' }

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
    revalidatePath(`/companies/${parsed.data.companyId}/visits`)
    revalidatePath('/dashboard')
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
  if (!session) return { error: 'Ikke autoriseret' }

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

  const hasAccess = await canAccessCompany(session.user.id, visit.company_id)
  if (!hasAccess) return { error: 'Ingen adgang til dette selskab' }

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
    revalidatePath(`/companies/${visit.company_id}/visits`)
    revalidatePath('/dashboard')
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
  if (!session) return { error: 'Ikke autoriseret' }

  const visit = await prisma.visit.findFirst({
    where: {
      id: visitId,
      organization_id: session.user.organizationId,
      deleted_at: null,
    },
  })
  if (!visit) return { error: 'Besøg ikke fundet' }

  const hasAccess = await canAccessCompany(session.user.id, visit.company_id)
  if (!hasAccess) return { error: 'Ingen adgang' }

  await prisma.visit.update({
    where: { id: visitId },
    data: { deleted_at: new Date() },
  })

  revalidatePath('/visits')
  revalidatePath(`/companies/${visit.company_id}/visits`)
  revalidatePath('/dashboard')
  return { data: undefined }
}
