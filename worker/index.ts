import { extractDocument } from '../src/lib/ai/jobs/extract-document'
import type { ExtractDocumentPayload } from '../src/lib/ai/jobs/extract-document'
import { runPortfolioScan } from '../src/lib/ai/jobs/portfolio-scan'
import { createLogger } from '../src/lib/ai/logger'
import { createQueue, stopQueue, JOB_NAMES } from '../src/lib/ai/queue'
import { prisma } from '../src/lib/db'

const log = createLogger('worker')

async function main() {
  log.info('Worker starting')

  const boss = await createQueue()

  await boss.work(JOB_NAMES.EXTRACT_DOCUMENT, async (jobs) => {
    for (const job of jobs) {
      const payload = job.data as ExtractDocumentPayload
      log.info({ job_id: job.id, document_id: payload.document_id }, 'Processing extraction.full')
      try {
        const result = await extractDocument(payload)
        log.info(
          { job_id: job.id, extraction_id: result.extraction_id, skipped: result.skipped },
          'Extraction.full completed'
        )
      } catch (err) {
        log.error(
          { job_id: job.id, err: err instanceof Error ? err.message : String(err) },
          'Extraction.full failed'
        )
        throw err
      }
    }
  })

  // Daglig regelbaseret porteføljescanning (ingen LLM). Cron'en (queue.ts) sender
  // tom payload, så vi scanner alle organisationer. Hver org behandles isoleret —
  // én fejlende org stopper ikke de øvrige.
  await boss.work(JOB_NAMES.PORTFOLIO_SCAN, async (jobs) => {
    for (const job of jobs) {
      const orgs = await prisma.organization.findMany({ select: { id: true } })
      log.info({ job_id: job.id, org_count: orgs.length }, 'Processing alerts.portfolio-scan')
      for (const org of orgs) {
        try {
          const result = await runPortfolioScan(org.id)
          log.info(
            { job_id: job.id, org_id: org.id, inserted: result.inserted, deleted: result.deleted },
            'Portfolio-scan completed for org'
          )
        } catch (err) {
          log.error(
            {
              job_id: job.id,
              org_id: org.id,
              err: err instanceof Error ? err.message : String(err),
            },
            'Portfolio-scan failed for org'
          )
        }
      }
    }
  })

  log.info({ registered_jobs: Object.values(JOB_NAMES) }, 'Worker ready — waiting for jobs')

  const shutdown = async (signal: string) => {
    log.info({ signal }, 'Worker shutting down')
    await stopQueue()
    log.info('Worker stopped cleanly')
    process.exit(0)
  }

  process.on('SIGTERM', () => {
    void shutdown('SIGTERM')
  })
  process.on('SIGINT', () => {
    void shutdown('SIGINT')
  })
}

main().catch((err) => {
  log.fatal({ err: err instanceof Error ? err.message : String(err) }, 'Worker crashed')
  process.exit(1)
})
