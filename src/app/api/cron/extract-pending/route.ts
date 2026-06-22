import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { isAIEnabled } from '@/lib/ai/feature-flags'
import { extractDocumentById } from '@/lib/ai/jobs/extract-document-by-id'
import { createLogger } from '@/lib/ai/logger'
import { isCronAuthorized } from '@/lib/cron/auth'
import { prisma } from '@/lib/db'

// AI-extraction-pipelinen kan tage flere minutter pr. dokument — Vercel skal
// have lov at køre længe (default er 10-15s og ville timeoute pipelinen).
export const maxDuration = 300

const log = createLogger('cron:extract-pending')

// Batch-loft: hvor mange dokumenter vi forsøger pr. cron-tick. Holder hver
// kørsel inden for maxDuration og spreder belastningen over flere ticks.
const BATCH_LIMIT = 5

/**
 * Cron-poller: finder dokumenter uden færdig extraction og kører pipelinen.
 *
 * Pending = Document uden DocumentExtraction-række ELLER med
 * extraction_status='in_progress' (et tidligere forsøg nåede ikke i mål).
 *
 * Vercel-cron kalder GET; auth via Bearer (CRON_SECRET || DIGEST_CRON_SECRET).
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!isCronAuthorized(request.headers.get('authorization'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Pending docs: ingen extraction ELLER extraction stadig i gang.
  const pendingDocs = await prisma.document.findMany({
    where: {
      deleted_at: null,
      OR: [{ extraction: { is: null } }, { extraction: { extraction_status: 'in_progress' } }],
    },
    select: { id: true, organization_id: true },
    orderBy: { uploaded_at: 'asc' },
    take: BATCH_LIMIT,
  })

  let processed = 0
  let skipped = 0
  let failed = 0

  // Tjek AI-gaten ÉN gang pr. organisation, så vi billigt springer hele orgs
  // dokumenter over hvis extraction er deaktiveret (sparer DB-/storage-kald).
  const aiEnabledByOrg = new Map<string, boolean>()

  for (const doc of pendingDocs) {
    let aiEnabled = aiEnabledByOrg.get(doc.organization_id)
    if (aiEnabled === undefined) {
      aiEnabled = await isAIEnabled(doc.organization_id, 'extraction')
      aiEnabledByOrg.set(doc.organization_id, aiEnabled)
    }

    if (!aiEnabled) {
      skipped++
      continue
    }

    try {
      const result = await extractDocumentById(doc.id)
      // extractDocument gater også internt (plan/cost-cap) og kan returnere
      // skipped uden at skrive en række — det tæller vi som skipped, ikke processed.
      if (result.skipped) {
        skipped++
      } else {
        processed++
      }
    } catch (err) {
      // Én fejlende doc må ikke stoppe resten af batchen.
      failed++
      log.error(
        { document_id: doc.id, err: err instanceof Error ? err.message : String(err) },
        'Extraction fejlede for dokument'
      )
    }
  }

  log.info(
    { processed, skipped, failed, batch: pendingDocs.length },
    'Extract-pending kørsel færdig'
  )

  return NextResponse.json({ success: true, processed, skipped, failed })
}
