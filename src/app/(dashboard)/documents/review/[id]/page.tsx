import { auth } from '@/lib/auth'
import { redirect, notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import { canAccessCompany } from '@/lib/permissions'
import ReviewClient from './review-client'
import type { ReviewDocument, ReviewField, ReviewQueueItem } from './review-client'

// ---------------------------------------------------------------
// Helpers — map extracted_fields JSON → ReviewField[]
// ---------------------------------------------------------------
interface ExtractedFieldJson {
  value?: unknown
  confidence?: number
  source_page?: number
  source_paragraph?: string
  source_text?: string
}

function mapExtractedFields(extractedFields: unknown, discrepancies: unknown): ReviewField[] {
  if (!extractedFields || typeof extractedFields !== 'object' || Array.isArray(extractedFields)) {
    return []
  }

  const record = extractedFields as Record<string, unknown>
  const discrepancyRecord =
    discrepancies && typeof discrepancies === 'object' && !Array.isArray(discrepancies)
      ? (discrepancies as Record<string, unknown>)
      : {}

  return Object.entries(record).map(([key, raw]) => {
    const field =
      raw && typeof raw === 'object' && !Array.isArray(raw)
        ? (raw as ExtractedFieldJson)
        : ({} as ExtractedFieldJson)

    const confidence = typeof field.confidence === 'number' ? field.confidence : 0
    const confidenceLevel: 'high' | 'medium' | 'low' =
      confidence >= 0.85 ? 'high' : confidence >= 0.6 ? 'medium' : 'low'

    // Check discrepancy info
    const disc = discrepancyRecord[key]
    const discObj =
      disc && typeof disc === 'object' && !Array.isArray(disc)
        ? (disc as Record<string, unknown>)
        : null

    const hasDiscrepancy = !!discObj
    const discrepancyType = discObj
      ? (discObj.type as 'value_mismatch' | 'missing_clause' | 'new_data' | undefined)
      : undefined

    const existingValue = discObj ? ((discObj.existing_value as string | null) ?? null) : null

    return {
      id: key,
      fieldName: key,
      fieldLabel: formatFieldLabel(key),
      extractedValue: field.value != null ? String(field.value) : null,
      existingValue,
      confidence,
      confidenceLevel,
      sourcePageNumber: field.source_page ?? 1,
      sourceParagraph: field.source_paragraph ?? '',
      sourceText: field.source_text ?? '',
      hasDiscrepancy,
      discrepancyType,
      category: 'general',
    }
  })
}

function formatFieldLabel(key: string): string {
  // Convert snake_case / camelCase to human-readable Danish-friendly label
  return key
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/^./, (c) => c.toUpperCase())
}

// ---------------------------------------------------------------
// Server Component
// ---------------------------------------------------------------
export default async function DocumentReviewPage({ params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) redirect('/login')

  const orgId = session.user.organizationId

  const doc = await prisma.document.findFirst({
    where: {
      id: params.id,
      organization_id: orgId,
      deleted_at: null,
    },
    include: {
      company: { select: { name: true } },
      extraction: true,
    },
  })

  if (!doc) notFound()

  // Permission check
  if (doc.company_id) {
    const hasAccess = await canAccessCompany(session.user.id, doc.company_id)
    if (!hasAccess) notFound()
  }

  // Build review queue — other documents awaiting review
  const reviewQueueDocs = await prisma.document.findMany({
    where: {
      organization_id: orgId,
      deleted_at: null,
      extraction: {
        reviewed_at: null,
        extraction_status: 'completed',
      },
    },
    include: {
      extraction: {
        select: { id: true },
      },
    },
    orderBy: { uploaded_at: 'asc' },
  })

  const reviewQueue: ReviewQueueItem[] = reviewQueueDocs.map((d) => ({
    id: d.id,
    fileName: d.file_name || d.title,
  }))

  // Map data for client
  const extraction = doc.extraction
  const fields = extraction
    ? mapExtractedFields(extraction.extracted_fields, extraction.discrepancies)
    : []

  // Check already decided fields
  const fieldDecisions =
    extraction?.field_decisions &&
    typeof extraction.field_decisions === 'object' &&
    !Array.isArray(extraction.field_decisions)
      ? (extraction.field_decisions as Record<string, unknown>)
      : {}

  const decidedFieldNames = Object.keys(fieldDecisions)

  const reviewDoc: ReviewDocument = {
    id: doc.id,
    fileName: doc.file_name || doc.title,
    companyName: doc.company?.name ?? '—',
    extractionId: extraction?.id ?? null,
    hasExtraction: !!extraction,
    isReviewed: !!extraction?.reviewed_at,
    reviewedBy: extraction?.reviewed_by ?? null,
    schemaVersion: extraction?.schema_version ?? null,
    promptVersion: extraction?.prompt_version ?? null,
    fields,
    decidedFieldNames,
  }

  return <ReviewClient document={reviewDoc} reviewQueue={reviewQueue} />
}
