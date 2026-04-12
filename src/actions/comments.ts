'use server'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import type { ActionResult } from '@/types/actions'

const commentSchema = z.object({
  content: z.string().min(1, 'Kommentar kan ikke være tom').max(2000, 'Maks 2000 tegn'),
  taskId: z.string().uuid(),
})

export async function createComment(input: { content: string; taskId: string }): Promise<ActionResult<{ id: string }>> {
  const session = await auth()
  if (!session) return { error: 'Ikke autoriseret' }

  const parsed = commentSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Ugyldigt input' }

  const task = await prisma.task.findFirst({
    where: { id: parsed.data.taskId, organization_id: session.user.organizationId, deleted_at: null },
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
