import type { Metadata } from 'next'
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { canAccessModule } from '@/lib/permissions'
import { DocumentsListB, type DocRow } from './documents-list-b'

export const metadata: Metadata = { title: 'Dokumenter' }

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec']
function formatDate(d: Date): string {
  return `${d.getDate()}. ${MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  const mb = bytes / (1024 * 1024)
  return mb >= 10 ? `${Math.round(mb)} MB` : `${mb.toFixed(1).replace('.', ',')} MB`
}

function extFromFilename(name: string): string {
  const ext = name.split('.').pop()?.toUpperCase() ?? ''
  return ext.length > 0 && ext.length <= 4 ? ext : 'FIL'
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

export default async function DocumentsPage() {
  const session = await auth()
  if (!session) redirect('/login')

  const hasAccess = await canAccessModule(session.user.id, 'documents')
  if (!hasAccess) redirect('/dashboard')

  const orgId = session.user.organizationId

  const documents = await prisma.document.findMany({
    where: {
      organization_id: orgId,
      deleted_at: null,
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

  const rows: DocRow[] = documents.map((d) => {
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
      dato: formatDate(d.uploaded_at),
      datoSort: d.uploaded_at.getTime(),
    }
  })

  return <DocumentsListB documents={rows} />
}
