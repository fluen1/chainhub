import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import DocumentsClient from './documents-client'
import type { DocumentItem, DocStatus, ConfidenceLevel } from './documents-client'

// ---------------------------------------------------------------
// Helpers til at mappe Prisma-data → klient-typer
// ---------------------------------------------------------------
function deriveStatus(extraction: ExtractionData | null): DocStatus {
  if (!extraction) return 'archived'
  if (extraction.extraction_status === 'pending') return 'processing'
  if (!extraction.reviewed_at) return 'ready_for_review'
  return 'reviewed'
}

function deriveConfidence(extraction: ExtractionData | null): ConfidenceLevel | null {
  if (!extraction) return null
  const score = extraction.agreement_score
  if (score == null) return null
  if (score >= 0.85) return 'high'
  if (score >= 0.6) return 'medium'
  return 'low'
}

function countExtractedFields(extraction: ExtractionData | null): number {
  if (!extraction) return 0
  const fields = extraction.extracted_fields
  if (fields && typeof fields === 'object' && !Array.isArray(fields)) {
    return Object.keys(fields as Record<string, unknown>).length
  }
  return 0
}

function countAttentionFields(extraction: ExtractionData | null): number {
  if (!extraction) return 0
  const fields = extraction.extracted_fields
  if (!fields || typeof fields !== 'object' || Array.isArray(fields)) return 0

  let count = 0
  const record = fields as Record<string, unknown>
  for (const key of Object.keys(record)) {
    const field = record[key]
    if (field && typeof field === 'object' && !Array.isArray(field)) {
      const f = field as Record<string, unknown>
      // Tæl felter med lav confidence eller discrepancy
      if (
        (typeof f.confidence === 'number' && f.confidence < 0.7) ||
        f.hasDiscrepancy === true
      ) {
        count++
      }
    }
  }
  return count
}

// Type for den inkluderede extraction-relation
type ExtractionData = {
  id: string
  extraction_status: string
  reviewed_at: Date | null
  agreement_score: number | null
  extracted_fields: unknown
  type_confidence: number | null
}

// ---------------------------------------------------------------
// Server Component — henter data og sender til klient
// ---------------------------------------------------------------
export default async function DocumentsPage() {
  const session = await auth()
  if (!session) redirect('/login')

  const orgId = session.user.organizationId

  const documents = await prisma.document.findMany({
    where: {
      organization_id: orgId,
      deleted_at: null,
    },
    include: {
      company: { select: { name: true } },
      extraction: {
        select: {
          id: true,
          extraction_status: true,
          reviewed_at: true,
          agreement_score: true,
          extracted_fields: true,
          type_confidence: true,
        },
      },
    },
    orderBy: { uploaded_at: 'desc' },
  })

  // Map Prisma-data til serialiserbare klient-typer
  const items: DocumentItem[] = documents.map((doc) => {
    const extraction = doc.extraction as ExtractionData | null
    return {
      id: doc.id,
      title: doc.title,
      fileName: doc.file_name || doc.title,
      companyName: doc.company?.name ?? '—',
      uploadedAt: doc.uploaded_at.toISOString(),
      status: deriveStatus(extraction),
      extractedFieldCount: countExtractedFields(extraction),
      attentionFieldCount: countAttentionFields(extraction),
      confidenceLevel: deriveConfidence(extraction),
    }
  })

  return <DocumentsClient documents={items} />
}
