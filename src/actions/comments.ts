'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { recordAuditEvent } from '@/lib/audit'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { captureError } from '@/lib/logger'
import { canAccessCompany } from '@/lib/permissions'
import { checkActionRateLimit } from '@/lib/rate-limit'
import type { ActionResult } from '@/types/actions'

const commentSchema = z.object({
  content: z.string().min(1, 'Kommentar kan ikke være tom').max(2000, 'Maks 2000 tegn'),
  taskId: z.string().min(1, 'Opgave-ID mangler'),
})

const caseCommentSchema = z.object({
  content: z.string().min(1, 'Kommentar kan ikke være tom').max(2000, 'Maks 2000 tegn'),
  caseId: z.string().min(1, 'Sags-ID mangler'),
})

export async function createComment(input: {
  content: string
  taskId: string
}): Promise<ActionResult<{ id: string }>> {
  const session = await auth()
  if (!session) return { error: 'Din session er udløbet — log ind igen.' }

  const parsed = commentSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Ugyldigt input' }

  const task = await prisma.task.findFirst({
    where: {
      id: parsed.data.taskId,
      organization_id: session.user.organizationId,
      deleted_at: null,
    },
  })
  if (!task) return { error: 'Opgave ikke fundet' }

  const rl = await checkActionRateLimit(session.user.organizationId)
  if (rl.limited) return { error: 'For mange handlinger. Vent venligst.' }

  try {
    const comment = await prisma.comment.create({
      data: {
        organization_id: session.user.organizationId,
        task_id: parsed.data.taskId,
        content: parsed.data.content,
        created_by: session.user.id,
      },
    })

    revalidatePath(`/tasks/${parsed.data.taskId}`)
    return { data: { id: comment.id } }
  } catch (err) {
    captureError(err, { namespace: 'action:comments', extra: { taskId: parsed.data.taskId } })
    return { error: 'Noget gik galt — prøv igen.' }
  }
}

export async function createCaseComment(input: {
  content: string
  caseId: string
}): Promise<ActionResult<{ id: string }>> {
  const session = await auth()
  if (!session) return { error: 'Din session er udløbet — log ind igen.' }

  const parsed = caseCommentSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Ugyldigt input' }

  // Hent sagen og tjek tenant
  const caseItem = await prisma.case.findFirst({
    where: {
      id: parsed.data.caseId,
      organization_id: session.user.organizationId,
      deleted_at: null,
    },
    include: {
      case_companies: { select: { company_id: true } },
    },
  })
  if (!caseItem) return { error: 'Sag ikke fundet' }

  // Tjek adgang til mindst ét tilknyttet selskab
  let hasAccess = false
  for (const cc of caseItem.case_companies) {
    const ok = await canAccessCompany(session.user.id, cc.company_id, session.user.organizationId)
    if (ok) {
      hasAccess = true
      break
    }
  }
  if (!hasAccess) return { error: 'Ingen adgang til denne sag' }

  const rlCase = await checkActionRateLimit(session.user.organizationId)
  if (rlCase.limited) return { error: 'For mange handlinger. Vent venligst.' }

  try {
    const comment = await prisma.comment.create({
      data: {
        organization_id: session.user.organizationId,
        case_id: parsed.data.caseId,
        content: parsed.data.content,
        created_by: session.user.id,
      },
    })

    await recordAuditEvent({
      organizationId: session.user.organizationId,
      userId: session.user.id,
      action: 'COMMENT_CREATE',
      resourceType: 'case',
      resourceId: parsed.data.caseId,
      resourceCompanyId: caseItem.case_companies[0]?.company_id,
      sensitivity: caseItem.sensitivity,
    })

    revalidatePath(`/cases/${parsed.data.caseId}`)
    return { data: { id: comment.id } }
  } catch (err) {
    captureError(err, { namespace: 'action:comments', extra: { caseId: parsed.data.caseId } })
    return { error: 'Noget gik galt — prøv igen.' }
  }
}

export async function deleteComment(commentId: string): Promise<ActionResult<null>> {
  const session = await auth()
  if (!session) return { error: 'Din session er udløbet — log ind igen.' }

  const comment = await prisma.comment.findFirst({
    where: { id: commentId, organization_id: session.user.organizationId, deleted_at: null },
  })
  if (!comment) return { error: 'Kommentar ikke fundet' }
  if (comment.created_by !== session.user.id) return { error: 'Du kan kun slette egne kommentarer' }

  const rlDel = await checkActionRateLimit(session.user.organizationId)
  if (rlDel.limited) return { error: 'For mange handlinger. Vent venligst.' }

  try {
    // Soft-delete — bevarer kommentar i audit-trail
    await prisma.comment.update({
      where: { id: commentId },
      data: { deleted_at: new Date() },
    })

    await recordAuditEvent({
      organizationId: session.user.organizationId,
      userId: session.user.id,
      action: 'DELETE',
      resourceType: 'comment',
      resourceId: commentId,
      resourceCompanyId: undefined, // Comment har ingen company_id — case/task lookup undgås her
    })

    if (comment.task_id) revalidatePath(`/tasks/${comment.task_id}`)
    if (comment.case_id) revalidatePath(`/cases/${comment.case_id}`)
    return { data: null }
  } catch (err) {
    captureError(err, { namespace: 'action:comments', extra: { commentId } })
    return { error: 'Noget gik galt — prøv igen.' }
  }
}
