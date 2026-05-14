'use server'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { canAccessCompany } from '@/lib/permissions'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import type { ActionResult } from '@/types/actions'
import { recordAuditEvent } from '@/lib/audit'

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
  if (!session) return { error: 'Ikke autoriseret' }

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
}

export async function createCaseComment(input: {
  content: string
  caseId: string
}): Promise<ActionResult<{ id: string }>> {
  const session = await auth()
  if (!session) return { error: 'Ikke autoriseret' }

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
    sensitivity: caseItem.sensitivity,
  })

  revalidatePath(`/cases/${parsed.data.caseId}`)
  return { data: { id: comment.id } }
}

export async function deleteComment(commentId: string): Promise<ActionResult<null>> {
  const session = await auth()
  if (!session) return { error: 'Ikke autoriseret' }

  const comment = await prisma.comment.findFirst({
    where: { id: commentId, organization_id: session.user.organizationId },
  })
  if (!comment) return { error: 'Kommentar ikke fundet' }
  if (comment.created_by !== session.user.id) return { error: 'Du kan kun slette egne kommentarer' }

  await prisma.comment.delete({ where: { id: commentId } })

  if (comment.task_id) revalidatePath(`/tasks/${comment.task_id}`)
  return { data: null }
}
