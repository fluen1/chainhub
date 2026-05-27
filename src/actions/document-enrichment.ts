'use server'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { captureError } from '@/lib/logger'
import { canAccessCompany } from '@/lib/permissions'
import type { ActionResult } from '@/types/actions'

export interface EntityMatchResult {
  entity_type: 'company' | 'person'
  entity_id: string
  entity_name: string
  confidence: number
  match_reason: string
}

export interface DocumentEnrichmentData {
  extractionId: string
  detectedType: string | null
  typeConfidence: number | null
  extractedFields: Record<string, unknown>
  entityMatches: EntityMatchResult[]
  status: string
}

function parseEntityMatches(raw: unknown): EntityMatchResult[] {
  if (!Array.isArray(raw)) return []
  return raw.filter(
    (item): item is EntityMatchResult =>
      item != null &&
      typeof item === 'object' &&
      (item.entity_type === 'company' || item.entity_type === 'person') &&
      typeof item.entity_id === 'string' &&
      typeof item.entity_name === 'string' &&
      typeof item.confidence === 'number' &&
      typeof item.match_reason === 'string'
  )
}

export async function getDocumentEnrichment(
  documentId: string
): Promise<ActionResult<DocumentEnrichmentData | null>> {
  const session = await auth()
  if (!session) return { error: 'Ikke autoriseret' }

  const document = await prisma.document.findFirst({
    where: {
      id: documentId,
      organization_id: session.user.organizationId,
      deleted_at: null,
    },
    select: { id: true, company_id: true },
  })

  if (!document) return { error: 'Dokument ikke fundet' }

  if (document.company_id) {
    const hasAccess = await canAccessCompany(
      session.user.id,
      document.company_id,
      session.user.organizationId
    )
    if (!hasAccess) return { error: 'Ingen adgang til dette dokument' }
  }

  try {
    const extraction = await prisma.documentExtraction.findFirst({
      where: { document_id: documentId },
      select: {
        id: true,
        detected_type: true,
        type_confidence: true,
        extracted_fields: true,
        entity_matches: true,
        extraction_status: true,
      },
    })

    if (!extraction) return { data: null }

    const extractedFields =
      extraction.extracted_fields &&
      typeof extraction.extracted_fields === 'object' &&
      !Array.isArray(extraction.extracted_fields)
        ? (extraction.extracted_fields as Record<string, unknown>)
        : {}

    return {
      data: {
        extractionId: extraction.id,
        detectedType: extraction.detected_type,
        typeConfidence: extraction.type_confidence,
        extractedFields,
        entityMatches: parseEntityMatches(extraction.entity_matches),
        status: extraction.extraction_status,
      },
    }
  } catch (err) {
    captureError(err, { namespace: 'action:document-enrichment', extra: { documentId } })
    return { error: 'Noget gik galt — prøv igen.' }
  }
}
