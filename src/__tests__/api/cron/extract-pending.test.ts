import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ── Mocks ─────────────────────────────────────────────────────────────────────
const findManyMock = vi.fn()
vi.mock('@/lib/db', () => ({
  prisma: {
    document: { findMany: (...args: unknown[]) => findManyMock(...args) },
  },
}))

const isAIEnabledMock = vi.fn()
vi.mock('@/lib/ai/feature-flags', () => ({
  isAIEnabled: (...args: unknown[]) => isAIEnabledMock(...args),
}))

const extractDocumentByIdMock = vi.fn()
vi.mock('@/lib/ai/jobs/extract-document-by-id', () => ({
  extractDocumentById: (...args: unknown[]) => extractDocumentByIdMock(...args),
}))

vi.mock('@/lib/ai/logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}))

import { GET } from '@/app/api/cron/extract-pending/route'
import { NextRequest } from 'next/server'

function makeRequest(authHeader?: string) {
  return new NextRequest('http://localhost/api/cron/extract-pending', {
    method: 'GET',
    headers: authHeader ? { authorization: authHeader } : {},
  })
}

const SUCCESS_RESULT = {
  extraction_id: 'e1',
  detected_type: 'lejekontrakt',
  field_count: 5,
  total_cost_usd: 0.01,
  skipped: false,
  status: 'success' as const,
}

describe('GET /api/cron/extract-pending — auth', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv }
    findManyMock.mockReset().mockResolvedValue([])
    isAIEnabledMock.mockReset().mockResolvedValue(true)
    extractDocumentByIdMock.mockReset().mockResolvedValue(SUCCESS_RESULT)
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

  it('returnerer 401 når Authorization-header mangler', async () => {
    process.env.CRON_SECRET = 'korrekt'
    const res = await GET(makeRequest())
    expect(res.status).toBe(401)
  })

  it('autoriserer med CRON_SECRET', async () => {
    process.env.CRON_SECRET = 'vercel-secret'
    delete process.env.DIGEST_CRON_SECRET
    const res = await GET(makeRequest('Bearer vercel-secret'))
    expect(res.status).toBe(200)
  })

  it('autoriserer med DIGEST_CRON_SECRET', async () => {
    delete process.env.CRON_SECRET
    process.env.DIGEST_CRON_SECRET = 'legacy'
    const res = await GET(makeRequest('Bearer legacy'))
    expect(res.status).toBe(200)
  })
})

describe('GET /api/cron/extract-pending — extraction-logik', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv, CRON_SECRET: 's' }
    findManyMock.mockReset()
    isAIEnabledMock.mockReset()
    extractDocumentByIdMock.mockReset().mockResolvedValue(SUCCESS_RESULT)
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('kalder extraction for pending docs i AI-aktiv org', async () => {
    findManyMock.mockResolvedValue([
      { id: 'd1', organization_id: 'org1' },
      { id: 'd2', organization_id: 'org1' },
    ])
    isAIEnabledMock.mockResolvedValue(true)

    const res = await GET(makeRequest('Bearer s'))
    const body = await res.json()

    expect(extractDocumentByIdMock).toHaveBeenCalledTimes(2)
    expect(extractDocumentByIdMock).toHaveBeenCalledWith('d1')
    expect(extractDocumentByIdMock).toHaveBeenCalledWith('d2')
    expect(body).toMatchObject({ processed: 2, skipped: 0, failed: 0 })
  })

  it('springer AI-disabled org helt over uden at kalde extraction', async () => {
    findManyMock.mockResolvedValue([
      { id: 'd1', organization_id: 'orgOff' },
      { id: 'd2', organization_id: 'orgOff' },
    ])
    isAIEnabledMock.mockResolvedValue(false)

    const res = await GET(makeRequest('Bearer s'))
    const body = await res.json()

    expect(extractDocumentByIdMock).not.toHaveBeenCalled()
    // AI-gaten tjekkes kun én gang pr. org (begge docs hører til orgOff)
    expect(isAIEnabledMock).toHaveBeenCalledTimes(1)
    expect(body).toMatchObject({ processed: 0, skipped: 2, failed: 0 })
  })

  it('én fejlende doc stopper ikke resten af batchen', async () => {
    findManyMock.mockResolvedValue([
      { id: 'd1', organization_id: 'org1' },
      { id: 'd2', organization_id: 'org1' },
      { id: 'd3', organization_id: 'org1' },
    ])
    isAIEnabledMock.mockResolvedValue(true)
    extractDocumentByIdMock
      .mockResolvedValueOnce(SUCCESS_RESULT)
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce(SUCCESS_RESULT)

    const res = await GET(makeRequest('Bearer s'))
    const body = await res.json()

    expect(extractDocumentByIdMock).toHaveBeenCalledTimes(3)
    expect(body).toMatchObject({ processed: 2, skipped: 0, failed: 1 })
  })

  it('tæller intern skip (plan/cost-cap) som skipped, ikke processed', async () => {
    findManyMock.mockResolvedValue([{ id: 'd1', organization_id: 'org1' }])
    isAIEnabledMock.mockResolvedValue(true)
    extractDocumentByIdMock.mockResolvedValue({
      ...SUCCESS_RESULT,
      skipped: true,
      status: 'skipped',
    })

    const res = await GET(makeRequest('Bearer s'))
    const body = await res.json()

    expect(body).toMatchObject({ processed: 0, skipped: 1, failed: 0 })
  })
})
