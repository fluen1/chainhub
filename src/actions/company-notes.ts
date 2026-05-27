'use server'

import { revalidatePath } from 'next/cache'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { captureError } from '@/lib/logger'
import { canAccessCompany } from '@/lib/permissions'
import { checkActionRateLimit } from '@/lib/rate-limit'
import {
  createCompanyNoteSchema,
  updateCompanyNoteSchema,
  togglePinNoteSchema,
} from '@/lib/validations/company-note'
import type { ActionResult } from '@/types/actions'

export interface CompanyNoteWithAuthor {
  id: string
  content: string
  pinned: boolean
  created_at: Date
  author: { id: string; name: string; email: string }
}

export async function getCompanyNotes(
  companyId: string
): Promise<ActionResult<CompanyNoteWithAuthor[]>> {
  const session = await auth()
  if (!session) return { error: 'Din session er udløbet — log ind igen.' }

  const hasAccess = await canAccessCompany(session.user.id, companyId, session.user.organizationId)
  if (!hasAccess) return { error: 'Ingen adgang til dette selskab' }

  const notes = await prisma.companyNote.findMany({
    where: {
      organization_id: session.user.organizationId,
      company_id: companyId,
      deleted_at: null,
    },
    orderBy: [{ pinned: 'desc' }, { created_at: 'desc' }],
    include: {
      author: { select: { id: true, name: true, email: true } },
    },
  })

  return { data: notes }
}

export async function createCompanyNote(input: {
  companyId: string
  content: string
}): Promise<ActionResult<{ id: string }>> {
  const session = await auth()
  if (!session) return { error: 'Din session er udløbet — log ind igen.' }

  const parsed = createCompanyNoteSchema.safeParse(input)
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
    const note = await prisma.companyNote.create({
      data: {
        organization_id: session.user.organizationId,
        company_id: parsed.data.companyId,
        content: parsed.data.content,
        created_by: session.user.id,
      },
    })

    revalidatePath(`/companies/${parsed.data.companyId}`)
    return { data: { id: note.id } }
  } catch (err) {
    captureError(err, {
      namespace: 'action:company-notes',
      extra: { companyId: parsed.data.companyId },
    })
    return { error: 'Noget gik galt — prøv igen.' }
  }
}

export async function updateCompanyNote(input: {
  noteId: string
  content: string
}): Promise<ActionResult<void>> {
  const session = await auth()
  if (!session) return { error: 'Din session er udløbet — log ind igen.' }

  const parsed = updateCompanyNoteSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Ugyldigt input' }

  const existing = await prisma.companyNote.findFirst({
    where: {
      id: parsed.data.noteId,
      organization_id: session.user.organizationId,
      deleted_at: null,
    },
  })
  if (!existing) return { error: 'Notat ikke fundet' }

  try {
    await prisma.companyNote.update({
      where: { id: parsed.data.noteId },
      data: { content: parsed.data.content },
    })

    revalidatePath(`/companies/${existing.company_id}`)
    return { data: undefined }
  } catch (err) {
    captureError(err, { namespace: 'action:company-notes', extra: { noteId: parsed.data.noteId } })
    return { error: 'Noget gik galt — prøv igen.' }
  }
}

export async function toggleNotePin(noteId: string): Promise<ActionResult<void>> {
  const session = await auth()
  if (!session) return { error: 'Din session er udløbet — log ind igen.' }

  const parsed = togglePinNoteSchema.safeParse({ noteId })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Ugyldigt input' }

  const existing = await prisma.companyNote.findFirst({
    where: {
      id: parsed.data.noteId,
      organization_id: session.user.organizationId,
      deleted_at: null,
    },
  })
  if (!existing) return { error: 'Notat ikke fundet' }

  try {
    await prisma.companyNote.update({
      where: { id: parsed.data.noteId },
      data: { pinned: !existing.pinned },
    })

    revalidatePath(`/companies/${existing.company_id}`)
    return { data: undefined }
  } catch (err) {
    captureError(err, { namespace: 'action:company-notes', extra: { noteId: parsed.data.noteId } })
    return { error: 'Noget gik galt — prøv igen.' }
  }
}

export async function deleteCompanyNote(noteId: string): Promise<ActionResult<void>> {
  const session = await auth()
  if (!session) return { error: 'Din session er udløbet — log ind igen.' }

  if (!noteId) return { error: 'Notat-ID mangler' }

  const existing = await prisma.companyNote.findFirst({
    where: {
      id: noteId,
      organization_id: session.user.organizationId,
      deleted_at: null,
    },
  })
  if (!existing) return { error: 'Notat ikke fundet' }

  const rl = await checkActionRateLimit(session.user.organizationId)
  if (rl.limited) return { error: 'For mange handlinger. Vent venligst.' }

  try {
    await prisma.companyNote.update({
      where: { id: noteId },
      data: { deleted_at: new Date() },
    })

    revalidatePath(`/companies/${existing.company_id}`)
    return { data: undefined }
  } catch (err) {
    captureError(err, { namespace: 'action:company-notes', extra: { noteId } })
    return { error: 'Noget gik galt — prøv igen.' }
  }
}
