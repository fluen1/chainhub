import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock tunge afhængigheder — vi tester KUN auth-laget her
vi.mock('@/lib/db', () => ({
  prisma: {
    user: { findMany: vi.fn().mockResolvedValue([]) },
    case: { count: vi.fn().mockResolvedValue(0) },
  },
}))
vi.mock('@/lib/email/resend', () => ({
  resend: { emails: { send: vi.fn() } },
  DIGEST_FROM: 'noreply@example.com',
}))
vi.mock('@/lib/notifications/deadlines', () => ({
  getExpiringContracts: vi.fn().mockResolvedValue({}),
  getOverdueTasks: vi.fn().mockResolvedValue([]),
  getUpcomingTasks: vi.fn().mockResolvedValue([]),
}))
vi.mock('@/lib/logger', () => ({
  captureError: vi.fn(),
}))

import { POST } from '@/app/api/cron/daily-digest/route'
import { NextRequest } from 'next/server'

function makeRequest(authHeader?: string) {
  return new NextRequest('http://localhost/api/cron/daily-digest', {
    method: 'POST',
    headers: authHeader ? { authorization: authHeader } : {},
  })
}

describe('POST /api/cron/daily-digest — auth', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('returnerer 401 når ingen secret er konfigureret', async () => {
    delete process.env.CRON_SECRET
    delete process.env.DIGEST_CRON_SECRET
    const res = await POST(makeRequest('Bearer whatever'))
    expect(res.status).toBe(401)
  })

  it('returnerer 401 ved forkert bearer-token', async () => {
    process.env.CRON_SECRET = 'korrekt-secret'
    const res = await POST(makeRequest('Bearer forkert-secret'))
    expect(res.status).toBe(401)
  })

  it('returnerer 401 når Authorization-header mangler', async () => {
    process.env.CRON_SECRET = 'korrekt-secret'
    const res = await POST(makeRequest())
    expect(res.status).toBe(401)
  })

  it('autoriserer med CRON_SECRET (Vercels standard)', async () => {
    process.env.CRON_SECRET = 'vercel-injected-secret'
    delete process.env.DIGEST_CRON_SECRET
    const res = await POST(makeRequest('Bearer vercel-injected-secret'))
    expect(res.status).toBe(200)
  })

  it('autoriserer med DIGEST_CRON_SECRET (bagudkompatibel)', async () => {
    delete process.env.CRON_SECRET
    process.env.DIGEST_CRON_SECRET = 'legacy-digest-secret'
    const res = await POST(makeRequest('Bearer legacy-digest-secret'))
    expect(res.status).toBe(200)
  })

  it('autoriserer med DIGEST_CRON_SECRET når begge er sat', async () => {
    process.env.CRON_SECRET = 'vercel-secret'
    process.env.DIGEST_CRON_SECRET = 'legacy-secret'
    const res = await POST(makeRequest('Bearer legacy-secret'))
    expect(res.status).toBe(200)
  })
})
