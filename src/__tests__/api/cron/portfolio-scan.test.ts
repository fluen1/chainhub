import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const orgFindManyMock = vi.fn()
vi.mock('@/lib/db', () => ({
  prisma: {
    organization: { findMany: (...args: unknown[]) => orgFindManyMock(...args) },
  },
}))

const runPortfolioScanMock = vi.fn()
vi.mock('@/lib/ai/jobs/portfolio-scan', () => ({
  runPortfolioScan: (...args: unknown[]) => runPortfolioScanMock(...args),
}))

vi.mock('@/lib/ai/logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}))

import { GET } from '@/app/api/cron/portfolio-scan/route'
import { NextRequest } from 'next/server'

function makeRequest(authHeader?: string) {
  return new NextRequest('http://localhost/api/cron/portfolio-scan', {
    method: 'GET',
    headers: authHeader ? { authorization: authHeader } : {},
  })
}

describe('GET /api/cron/portfolio-scan — auth', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv }
    orgFindManyMock.mockReset().mockResolvedValue([])
    runPortfolioScanMock
      .mockReset()
      .mockResolvedValue({ inserted: 0, deleted: 0, organizationId: 'x' })
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('returnerer 401 når ingen secret er konfigureret', async () => {
    delete process.env.CRON_SECRET
    delete process.env.DIGEST_CRON_SECRET
    const res = await GET(makeRequest('Bearer whatever'))
    expect(res.status).toBe(401)
  })

  it('returnerer 401 ved forkert bearer-token', async () => {
    process.env.CRON_SECRET = 'korrekt'
    const res = await GET(makeRequest('Bearer forkert'))
    expect(res.status).toBe(401)
  })

  it('autoriserer med gyldig token', async () => {
    process.env.CRON_SECRET = 'korrekt'
    const res = await GET(makeRequest('Bearer korrekt'))
    expect(res.status).toBe(200)
  })
})

describe('GET /api/cron/portfolio-scan — scan-logik', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv, CRON_SECRET: 's' }
    orgFindManyMock.mockReset()
    runPortfolioScanMock.mockReset()
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('kører scan for hver org', async () => {
    orgFindManyMock.mockResolvedValue([{ id: 'org1' }, { id: 'org2' }])
    runPortfolioScanMock.mockResolvedValue({ inserted: 1, deleted: 0, organizationId: 'x' })

    const res = await GET(makeRequest('Bearer s'))
    const body = await res.json()

    expect(runPortfolioScanMock).toHaveBeenCalledTimes(2)
    expect(runPortfolioScanMock).toHaveBeenCalledWith('org1')
    expect(runPortfolioScanMock).toHaveBeenCalledWith('org2')
    expect(body).toMatchObject({ scanned: 2, failed: 0 })
  })

  it('én fejlende org stopper ikke de øvrige', async () => {
    orgFindManyMock.mockResolvedValue([{ id: 'org1' }, { id: 'org2' }, { id: 'org3' }])
    runPortfolioScanMock
      .mockResolvedValueOnce({ inserted: 1, deleted: 0, organizationId: 'org1' })
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce({ inserted: 2, deleted: 0, organizationId: 'org3' })

    const res = await GET(makeRequest('Bearer s'))
    const body = await res.json()

    expect(runPortfolioScanMock).toHaveBeenCalledTimes(3)
    expect(body).toMatchObject({ scanned: 2, failed: 1 })
  })
})
