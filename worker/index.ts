import { createQueue, stopQueue, JOB_NAMES } from '../src/lib/ai/queue'
import { createLogger } from '../src/lib/ai/logger'
import { extractDocumentPoc } from '../src/lib/ai/jobs/extract-document-poc'
import type { ExtractDocumentPocPayload } from '../src/lib/ai/jobs/extract-document-poc'
import { extractDocument } from '../src/lib/ai/jobs/extract-document'
import type { ExtractDocumentPayload } from '../src/lib/ai/jobs/extract-document'

const log = createLogger('worker')

async function main() {
  log.info('Worker starting')

  const boss = await createQueue()

  // DEPRECATED: PoC extraction handler — kept for backward compatibility
  await boss.work(JOB_NAMES.EXTRACT_DOCUMENT_POC, async (jobs) => {
    for (const job of jobs) {
      const payload = job.data as ExtractDocumentPocPayload
      log.info({ job_id: job.id, document_id: payload.document_id }, 'Processing extraction.poc')
      try {
        const result = await extractDocumentPoc(payload)
        log.info(
          { job_id: job.id, extraction_id: result.extraction_id, cost_usd: result.cost_usd },
          'Extraction.poc completed',
        )
      } catch (err) {
        log.error(
          { job_id: job.id, err: err instanceof Error ? err.message : String(err) },
          'Extraction.poc failed',
        )
        throw err
      }
    }
  })

  await boss.work(JOB_NAMES.EXTRACT_DOCUMENT, async (jobs) => {
    for (const job of jobs) {
      const payload = job.data as ExtractDocumentPayload
      log.info({ job_id: job.id, document_id: payload.document_id }, 'Processing extraction.full')
      try {
        const result = await extractDocument(payload)
        log.info({ job_id: job.id, extraction_id: result.extraction_id, skipped: result.skipped }, 'Extraction.full completed')
      } catch (err) {
        log.error({ job_id: job.id, err: err instanceof Error ? err.message : String(err) }, 'Extraction.full failed')
        throw err
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

  process.on('SIGTERM', () => { void shutdown('SIGTERM') })
  process.on('SIGINT', () => { void shutdown('SIGINT') })
}

main().catch((err) => {
  log.fatal({ err: err instanceof Error ? err.message : String(err) }, 'Worker crashed')
  process.exit(1)
})
