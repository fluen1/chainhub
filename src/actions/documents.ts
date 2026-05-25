'use server'

import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { canAccessCompany, canAccessModule, getAccessibleCompanies } from '@/lib/permissions'
import { revalidatePath } from 'next/cache'
import type { ActionResult } from '@/types/actions'
import type { Prisma } from '@prisma/client'

// ─────────────────────────────────────────────────────────────────────────────
// Page-data queries (flyt Prisma-kald ud af page.tsx)
// ─────────────────────────────────────────────────────────────────────────────

export async function getDocumentUploadCompanies(): Promise<Array<{ id: string; name: string }>> {
  const session = await auth()
  if (!session) return []

  const orgId = session.user.organizationId
  const hasAccess = await canAccessModule(session.user.id, 'documents', orgId)
  if (!hasAccess) return []

  const companyIds = await getAccessibleCompanies(session.user.id, orgId)

  return prisma.company.findMany({
    where: { organization_id: orgId, deleted_at: null, id: { in: companyIds } },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
    take: 200,
  })
}

// AI-status (UI-label) afledt fra extraction-rækkens status + review-tidspunkt.
function deriveAiStatus(
  extraction: { extraction_status: string; reviewed_at: Date | null } | null
): 'AI ✓' | 'Review' | 'Afventer' | 'Ikke AI' {
  if (!extraction) return 'Ikke AI'
  if (extraction.extraction_status === 'pending') return 'Afventer'
  if (extraction.extraction_status === 'completed' && extraction.reviewed_at) return 'AI ✓'
  if (extraction.extraction_status === 'completed') return 'Review'
  if (extraction.extraction_status === 'rejected') return 'Review'
  return 'Ikke AI'
}

// Konfidens-pct fra agreement_score (0-1) → procent eller null.
function deriveConfidence(extraction: { agreement_score: number | null } | null): number | null {
  if (!extraction || extraction.agreement_score == null) return null
  return Math.round(extraction.agreement_score * 100)
}

// Tæl "opmærksomhedsfelter" = felter med confidence < 0.7 eller discrepancy.
function countAttention(extraction: { extracted_fields: unknown } | null): number {
  if (!extraction) return 0
  const fields = extraction.extracted_fields
  if (!fields || typeof fields !== 'object' || Array.isArray(fields)) return 0
  let count = 0
  for (const value of Object.values(fields as Record<string, unknown>)) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const f = value as Record<string, unknown>
      if ((typeof f.confidence === 'number' && f.confidence < 0.7) || f.hasDiscrepancy === true) {
        count++
      }
    }
  }
  return count
}

function extFromFilename(name: string): string {
  const ext = name.split('.').pop()?.toUpperCase() ?? ''
  return ext.length > 0 && ext.length <= 4 ? ext : 'FIL'
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  const mb = bytes / (1024 * 1024)
  return mb >= 10 ? `${Math.round(mb)} MB` : `${mb.toFixed(1).replace('.', ',')} MB`
}

function formatDateLocal(d: Date): string {
  const MONTHS = [
    'jan',
    'feb',
    'mar',
    'apr',
    'maj',
    'jun',
    'jul',
    'aug',
    'sep',
    'okt',
    'nov',
    'dec',
  ]
  return `${d.getDate()}. ${MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

export interface DocRow {
  id: string
  ext: string
  navn: string
  size: string
  selskab: string
  tilknytning: string
  aiStatus: 'AI ✓' | 'Review' | 'Afventer' | 'Ikke AI'
  konf: number | null
  att: number
  dato: string
  datoSort: number
  contractName: string | null
  caseName: string | null
}

export async function getDocumentsPageData(): Promise<DocRow[]> {
  const session = await auth()
  if (!session) return []

  const orgId = session.user.organizationId
  const hasAccess = await canAccessModule(session.user.id, 'documents', orgId)
  if (!hasAccess) return []

  const companyIds = await getAccessibleCompanies(session.user.id, orgId)

  const documents = await prisma.document.findMany({
    where: {
      organization_id: orgId,
      deleted_at: null,
      // Vis kun dokumenter tilknyttet selskaber brugeren har adgang til,
      // eller dokumenter uden selskabstilknytning (org-niveau dokumenter).
      OR: [{ company_id: null }, { company_id: { in: companyIds } }],
    },
    include: {
      company: { select: { id: true, name: true } },
      contract: { select: { id: true, display_name: true } },
      case: { select: { id: true, title: true, case_number: true } },
      extraction: {
        select: {
          extraction_status: true,
          reviewed_at: true,
          agreement_score: true,
          extracted_fields: true,
        },
      },
    },
    orderBy: { uploaded_at: 'desc' },
  })

  return documents.map((d) => {
    const aiStatus = deriveAiStatus(d.extraction)
    const konf = deriveConfidence(d.extraction)
    const att = countAttention(d.extraction)

    const tilknytning = d.contract
      ? d.contract.display_name
      : d.case
        ? `#${d.case.case_number ?? d.case.id.slice(0, 6)} ${d.case.title}`
        : '—'

    return {
      id: d.id,
      ext: extFromFilename(d.file_name),
      navn: d.file_name,
      size: formatSize(d.file_size_bytes),
      selskab: d.company?.name ?? '—',
      tilknytning,
      aiStatus,
      konf,
      att,
      dato: formatDateLocal(d.uploaded_at),
      datoSort: d.uploaded_at.getTime(),
      contractName: d.contract?.display_name ?? null,
      caseName: d.case ? `#${d.case.case_number ?? d.case.id.slice(0, 6)} ${d.case.title}` : null,
    }
  })
}

const documentReviewInclude = {
  company: { select: { name: true } },
  extraction: true,
  contract: {
    include: {
      parties: { include: { person: true } },
      ownerships: true,
    },
  },
  case: { select: { id: true, case_number: true, title: true } },
} satisfies Prisma.DocumentInclude

export type DocumentReviewDoc = NonNullable<
  Prisma.DocumentGetPayload<{ include: typeof documentReviewInclude }>
>

export interface DocumentReviewPageData {
  doc: DocumentReviewDoc
  reviewQueue: Array<{ id: string; fileName: string }>
}

export async function getDocumentReviewPageData(
  documentId: string
): Promise<DocumentReviewPageData | null> {
  const session = await auth()
  if (!session) return null

  const orgId = session.user.organizationId

  const doc = await prisma.document.findFirst({
    where: {
      id: documentId,
      organization_id: orgId,
      deleted_at: null,
    },
    include: documentReviewInclude,
  })

  if (!doc) return null

  if (doc.company_id) {
    const hasAccess = await canAccessCompany(session.user.id, doc.company_id, orgId)
    if (!hasAccess) return null
  }

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

  const reviewQueue = reviewQueueDocs.map((d) => ({
    id: d.id,
    fileName: d.file_name || d.title,
  }))

  return { doc, reviewQueue }
}

export async function getDocumentTitle(documentId: string): Promise<string> {
  const session = await auth()
  if (!session) return 'Review'
  const doc = await prisma.document.findFirst({
    where: { id: documentId, organization_id: session.user.organizationId, deleted_at: null },
    select: { file_name: true, title: true },
  })
  return `Review · ${doc?.file_name ?? doc?.title ?? 'dokument'}`
}

// Løs UUID-validering: accepterer alle 8-4-4-4-12 hex-formater inkl. nil-UUIDs (seed-data)
const uuidSchema = z
  .string()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)

export async function deleteDocument(documentId: string): Promise<ActionResult<void>> {
  const session = await auth()
  if (!session) return { error: 'Din session er udløbet — log ind igen.' }

  if (!uuidSchema.safeParse(documentId).success) return { error: 'Ugyldigt input' }

  const doc = await prisma.document.findFirst({
    where: {
      id: documentId,
      organization_id: session.user.organizationId,
      deleted_at: null,
    },
  })
  if (!doc) return { error: 'Dokument ikke fundet' }

  if (doc.company_id) {
    const hasAccess = await canAccessCompany(
      session.user.id,
      doc.company_id,
      session.user.organizationId
    )
    if (!hasAccess) return { error: 'Ingen adgang til dette dokument' }
  }

  await prisma.document.update({
    where: { id: documentId },
    data: { deleted_at: new Date() },
  })

  revalidatePath('/documents')
  if (doc.company_id) revalidatePath(`/companies/${doc.company_id}/documents`)
  return { data: undefined }
}
