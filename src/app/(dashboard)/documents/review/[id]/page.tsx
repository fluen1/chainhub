import { auth } from '@/lib/auth'
import { redirect, notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import { canAccessCompany } from '@/lib/permissions'
import { getExistingValue, type ContractWithRelations } from '@/lib/ai/review/existing-values'
import { getSchema } from '@/lib/ai/schemas/registry'
import type { ContractSchema } from '@/lib/ai/schemas/types'
import ReviewClient from './review-client'
import type { ReviewDocument, ReviewField, ReviewQueueItem } from './review-client'

// ---------------------------------------------------------------
// Helpers — map extracted_fields JSON → ReviewField[]
// ---------------------------------------------------------------
interface ExtractedFieldJson {
  value?: unknown
  claude_confidence?: number
  source_page?: number
  source_paragraph?: string
  source_text?: string
}

function mapExtractedFields(
  extractedFields: unknown,
  discrepancies: unknown,
  contract: ContractWithRelations | null,
  schema: ContractSchema | null
): ReviewField[] {
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

    const confidence = typeof field.claude_confidence === 'number' ? field.claude_confidence : 0

    const meta = schema?.field_metadata?.[key] ?? null
    const description =
      meta && typeof meta === 'object' && 'description' in meta
        ? (meta as { description?: string }).description
        : undefined
    const legalCritical =
      meta && typeof meta === 'object' && 'legal_critical' in meta
        ? !!(meta as { legal_critical?: boolean }).legal_critical
        : false
    const autoAcceptThreshold =
      meta && typeof meta === 'object' && 'auto_accept_threshold' in meta
        ? ((meta as { auto_accept_threshold?: number }).auto_accept_threshold ?? 0.85)
        : 0.85

    const fieldLabel = description ?? formatFieldLabel(key)

    const confidenceLevel: 'high' | 'medium' | 'low' =
      confidence >= autoAcceptThreshold
        ? 'high'
        : confidence >= autoAcceptThreshold - 0.25
          ? 'medium'
          : 'low'

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

    const existingFromContract = getExistingValue(key, contract, schema?.contract_type ?? '')
    const existingFromDiscrepancy = discObj
      ? ((discObj.existing_value as string | null) ?? null)
      : null
    const existingValue = existingFromContract ?? existingFromDiscrepancy

    return {
      id: key,
      fieldName: key,
      fieldLabel,
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
      legalCritical,
      isAttention: confidenceLevel !== 'high' || legalCritical,
      autoAcceptThreshold,
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
// Source blocks — unikke PDF-tekstblokke bygget fra felternes source_text
// ---------------------------------------------------------------
export interface SourceBlock {
  id: string
  page: number
  paragraph: string
  text: string
}

function buildSourceBlocks(fields: ReviewField[]): SourceBlock[] {
  const seen = new Set<string>()
  const blocks: SourceBlock[] = []
  for (const f of fields) {
    if (!f.sourceText || !f.sourcePageNumber) continue
    const key = `${f.sourcePageNumber}-${f.sourceParagraph}-${f.sourceText.slice(0, 40)}`
    if (seen.has(key)) continue
    seen.add(key)
    blocks.push({
      id: `block-${blocks.length}`,
      page: f.sourcePageNumber,
      paragraph: f.sourceParagraph || `Side ${f.sourcePageNumber}`,
      text: f.sourceText,
    })
  }
  return blocks.sort((a, b) => a.page - b.page)
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
      contract: {
        include: {
          parties: { include: { person: true } },
          ownerships: true,
        },
      },
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
  const schema = extraction?.detected_type ? getSchema(extraction.detected_type) : null

  const fields = extraction
    ? mapExtractedFields(
        extraction.extracted_fields,
        extraction.discrepancies,
        doc.contract as ContractWithRelations | null,
        schema ?? null
      )
    : []

  const sourceBlocks = buildSourceBlocks(fields)

  // Check already decided fields
  const fieldDecisions =
    extraction?.field_decisions &&
    typeof extraction.field_decisions === 'object' &&
    !Array.isArray(extraction.field_decisions)
      ? (extraction.field_decisions as Record<string, unknown>)
      : {}

  const decidedFieldNames = Object.keys(fieldDecisions).filter((k) => !k.startsWith('__'))

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

  return <ReviewClient document={reviewDoc} reviewQueue={reviewQueue} sourceBlocks={sourceBlocks} />
}
