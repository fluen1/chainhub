import { PgBoss } from 'pg-boss'
import { createLogger } from './logger'

const log = createLogger('queue')

let bossInstance: PgBoss | null = null

export const JOB_NAMES = {
  EXTRACT_DOCUMENT: 'extraction.full',
  PORTFOLIO_SCAN: 'alerts.portfolio-scan',
} as const

export type JobName = (typeof JOB_NAMES)[keyof typeof JOB_NAMES]

export async function createQueue(): Promise<PgBoss> {
  if (bossInstance) return bossInstance

  const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error('DIRECT_URL or DATABASE_URL environment variable is required')
  }

  log.info('Initializing pg-boss queue')

  bossInstance = new PgBoss({
    connectionString,
    application_name: 'chainhub-ai-worker',
  })

  bossInstance.on('error', (err: Error) => {
    log.error({ err: err.message }, 'pg-boss error')
  })

  await bossInstance.start()

  // Planlæg daglig porteføljescanning kl. 06:00 UTC
  await bossInstance.schedule(JOB_NAMES.PORTFOLIO_SCAN, '0 6 * * *', {}, { tz: 'UTC' })

  log.info('pg-boss started')
  return bossInstance
}

export async function stopQueue(): Promise<void> {
  if (bossInstance) {
    await bossInstance.stop({ graceful: true, timeout: 30_000 })
    bossInstance = null
    log.info('pg-boss stopped')
  }
}
