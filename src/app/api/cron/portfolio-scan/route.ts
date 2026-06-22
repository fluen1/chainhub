import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { runPortfolioScan } from '@/lib/ai/jobs/portfolio-scan'
import { createLogger } from '@/lib/ai/logger'
import { isCronAuthorized } from '@/lib/cron/auth'
import { prisma } from '@/lib/db'

// Regelbaseret scan over alle orgs kan tage tid ved mange organisationer.
export const maxDuration = 300

const log = createLogger('cron:portfolio-scan')

/**
 * Cron: daglig regelbaseret porteføljescanning (ingen LLM).
 *
 * Kører {@link runPortfolioScan} for hver organisation isoleret — én fejlende
 * org stopper ikke de øvrige. Flyttet fra den tidligere pg-boss-worker.
 *
 * Vercel-cron kalder GET; auth via Bearer (CRON_SECRET || DIGEST_CRON_SECRET).
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!isCronAuthorized(request.headers.get('authorization'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const orgs = await prisma.organization.findMany({ select: { id: true } })

  let scanned = 0
  let failed = 0

  for (const org of orgs) {
    try {
      const result = await runPortfolioScan(org.id)
      scanned++
      log.info(
        { org_id: org.id, inserted: result.inserted, deleted: result.deleted },
        'Portfolio-scan færdig for org'
      )
    } catch (err) {
      failed++
      log.error(
        { org_id: org.id, err: err instanceof Error ? err.message : String(err) },
        'Portfolio-scan fejlede for org'
      )
    }
  }

  log.info({ scanned, failed, org_count: orgs.length }, 'Portfolio-scan kørsel færdig')

  return NextResponse.json({ success: true, scanned, failed })
}
