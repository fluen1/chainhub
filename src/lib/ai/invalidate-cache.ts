import { prisma } from '@/lib/db'
import { createLogger } from './logger'

const log = createLogger('ai-cache-invalidation')

/**
 * Sletter CompanyInsightsCache-rækken for et selskab, så næste view
 * genererer friske insights i stedet for at returnere en stale 24h-cache.
 *
 * Kaldes fra Server Actions der muterer data synlig i insights (kontrakter,
 * sager, finans-nøgletal). Fejler stille — en tabt cache-invalidering må
 * ALDRIG bryde en user-save; dataintegritet er uaffekteret.
 */
export async function invalidateCompanyInsightsCache(companyId: string): Promise<void> {
  try {
    const deleted = await prisma.companyInsightsCache.deleteMany({
      where: { company_id: companyId },
    })
    if (deleted.count > 0) {
      log.info({ companyId, deleted: deleted.count }, 'Invaliderede insights-cache')
    }
  } catch (err) {
    log.warn({ err, companyId }, 'invalidateCompanyInsightsCache fejlede (non-fatal)')
  }
}
