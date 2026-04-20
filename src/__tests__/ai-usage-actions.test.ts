import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({
  auth: vi.fn().mockResolvedValue({
    user: { id: 'user-1', organizationId: 'org-1' },
  }),
}))

vi.mock('@/lib/permissions', () => ({
  canAccessModule: vi.fn().mockResolvedValue(true),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    aIUsageLog: {
      aggregate: vi.fn().mockResolvedValue({ _sum: { cost_usd: 0 } }),
      groupBy: vi.fn().mockResolvedValue([]),
      findMany: vi.fn().mockResolvedValue([]),
    },
    organizationAISettings: {
      findUnique: vi.fn().mockResolvedValue({ monthly_cost_cap_usd: 100 }),
    },
  },
}))

vi.mock('@/lib/logger', () => ({
  captureError: vi.fn(),
  createLogger: vi.fn(() => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
}))

import { getAIUsageDashboard } from '@/actions/ai-usage'

describe('getAIUsageDashboard', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returnerer samlet dashboard-data', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.aIUsageLog.aggregate).mockImplementation((() =>
      Promise.resolve({ _sum: { cost_usd: 12.5 } })) as never)
    vi.mocked(prisma.aIUsageLog.groupBy).mockImplementation((() =>
      Promise.resolve([
        { feature: 'insights', _sum: { cost_usd: 10 } },
        { feature: 'extraction', _sum: { cost_usd: 2.5 } },
      ])) as never)
    vi.mocked(prisma.aIUsageLog.findMany).mockImplementation((() =>
      Promise.resolve([
        {
          id: 'log-1',
          feature: 'insights',
          model: 'claude-haiku-4-5',
          cost_usd: 0.02,
          created_at: new Date(),
          resource_type: 'company',
          resource_id: 'c-1',
        },
      ])) as never)
    const result = await getAIUsageDashboard()
    expect('data' in result).toBe(true)
    if ('data' in result && result.data) {
      expect(result.data.totalCostUsd).toBe(12.5)
      expect(result.data.capUsd).toBe(100)
      expect(result.data.percentage).toBe(13)
      expect(result.data.byFeature).toHaveLength(2)
      expect(result.data.recent).toHaveLength(1)
    }
  })

  it('afviser uden module-adgang', async () => {
    const perms = await import('@/lib/permissions')
    vi.mocked(perms.canAccessModule).mockResolvedValueOnce(false)
    const result = await getAIUsageDashboard()
    expect('error' in result).toBe(true)
  })

  it('afviser uden session', async () => {
    const auth = await import('@/lib/auth')
    vi.mocked(auth.auth).mockResolvedValueOnce(null)
    const result = await getAIUsageDashboard()
    expect(result).toEqual({ error: 'Ikke autoriseret' })
  })
})
