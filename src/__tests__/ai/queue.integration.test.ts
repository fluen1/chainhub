// @vitest-environment node
import { describe, it, expect, afterAll, beforeAll } from 'vitest'
import { createQueue, stopQueue, JOB_NAMES } from '@/lib/ai/queue'
import type { PgBoss } from 'pg-boss'

const runIntegrationTests = !!process.env.DIRECT_URL || !!process.env.DATABASE_URL

describe.skipIf(!runIntegrationTests)('queue integration', () => {
  let boss: PgBoss

  beforeAll(async () => {
    boss = await createQueue()
  }, 30_000)

  afterAll(async () => {
    await stopQueue()
  }, 30_000)

  it('creates queue successfully', () => {
    expect(boss).toBeDefined()
  })

  it('can send and receive a job', async () => {
    const receivedJobs: unknown[] = []

    await boss.work('queue-test', async (jobs: Array<{ data: unknown }>) => {
      for (const job of jobs) {
        receivedJobs.push(job.data)
      }
    })

    const jobId = await boss.send('queue-test', { hello: 'world' })
    expect(jobId).toBeTruthy()

    const deadline = Date.now() + 5_000
    while (receivedJobs.length === 0 && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 100))
    }

    expect(receivedJobs).toHaveLength(1)
    expect(receivedJobs[0]).toEqual({ hello: 'world' })

    await boss.deleteQueue('queue-test')
  }, 15_000)

  it('exposes JOB_NAMES constants', () => {
    expect(JOB_NAMES.EXTRACT_DOCUMENT_POC).toBe('extraction.poc')
  })
})
