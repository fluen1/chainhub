'use server'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { logFieldCorrection } from '@/lib/ai/feedback'
import { canAccessCompany } from '@/lib/permissions'
import { revalidatePath } from 'next/cache'
import type { ActionResult } from '@/types/actions'
import type { Prisma } from '@prisma/client'
import { z } from 'zod'

const approveSchema = z.string().min(1, 'Ekstraktions-ID mangler')

const fieldDecisionSchema = z.object({
  extractionId: z.string().min(1, 'Ekstraktions-ID mangler'),
  fieldName: z.string().min(1),
  decision: z.enum(['use_ai', 'keep_existing', 'manual', 'accept_missing', 'add_manual']),
  aiValue: z.unknown(),
  existingValue: z.unknown(),
  confidence: z.number().nullable(),
})

export async function approveDocumentReview(extractionId: string): Promise<ActionResult<void>> {
  const parsed = approveSchema.safeParse(extractionId)
  if (!parsed.success) return { error: 'Ugyldigt ekstraktions-ID' }

  const session = await auth()
  if (!session) return { error: 'Ikke autoriseret' }

  const extraction = await prisma.documentExtraction.findFirst({
    where: {
      id: extractionId,
      organization_id: session.user.organizationId,
    },
    include: {
      document: {
        select: { company_id: true, deleted_at: true },
      },
    },
  })

  if (!extraction || extraction.document.deleted_at) {
    return { error: 'Ekstraktion ikke fundet' }
  }

  if (extraction.document.company_id) {
    const hasAccess = await canAccessCompany(session.user.id, extraction.document.company_id)
    if (!hasAccess) return { error: 'Ingen adgang til dette dokument' }
  }

  await prisma.documentExtraction.update({
    where: { id: extractionId },
    data: {
      reviewed_by: session.user.id,
      reviewed_at: new Date(),
    },
  })

  revalidatePath('/documents')
  return { data: undefined }
}

export async function saveFieldDecision(params: {
  extractionId: string
  fieldName: string
  decision: 'use_ai' | 'keep_existing' | 'manual' | 'accept_missing' | 'add_manual'
  aiValue: unknown
  existingValue: unknown
  confidence: number | null
}): Promise<ActionResult<{ correctionId: string }>> {
  const parsed = fieldDecisionSchema.safeParse(params)
  if (!parsed.success) return { error: 'Ugyldige parametre' }

  const session = await auth()
  if (!session) return { error: 'Ikke autoriseret' }

  const extraction = await prisma.documentExtraction.findFirst({
    where: {
      id: params.extractionId,
      organization_id: session.user.organizationId,
    },
    include: {
      document: {
        select: { company_id: true, deleted_at: true },
      },
    },
  })

  if (!extraction || extraction.document.deleted_at) {
    return { error: 'Ekstraktion ikke fundet' }
  }

  if (extraction.document.company_id) {
    const hasAccess = await canAccessCompany(session.user.id, extraction.document.company_id)
    if (!hasAccess) return { error: 'Ingen adgang til dette dokument' }
  }

  // Determine user_value based on decision
  const userValue =
    params.decision === 'use_ai'
      ? params.aiValue
      : params.decision === 'keep_existing'
        ? params.existingValue
        : params.existingValue // manual/accept_missing/add_manual — log existing

  // Log correction via feedback system
  const correctionId = await logFieldCorrection({
    extraction_id: params.extractionId,
    organization_id: session.user.organizationId,
    field_name: params.fieldName,
    ai_value: params.aiValue,
    user_value: userValue,
    confidence: params.confidence,
    schema_version: extraction.schema_version,
    prompt_version: extraction.prompt_version,
    corrected_by: session.user.id,
  })

  // Update field_decisions JSON on the extraction
  const currentDecisions = (extraction.field_decisions as Record<string, unknown>) ?? {}
  const updatedDecisions = {
    ...currentDecisions,
    [params.fieldName]: {
      decision: params.decision,
      decided_at: new Date().toISOString(),
      decided_by: session.user.id,
      correction_id: correctionId,
    },
  }

  await prisma.documentExtraction.update({
    where: { id: params.extractionId },
    data: { field_decisions: updatedDecisions as Prisma.InputJsonValue },
  })

  revalidatePath('/documents')
  return { data: { correctionId } }
}
