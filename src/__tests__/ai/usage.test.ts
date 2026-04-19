import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  prisma: {
    aIUsageLog: {
      create: vi.fn().mockResolvedValue({ id: 'log-1' }),
      aggregate: vi.fn().mockResolvedValue({ _sum: { cost_usd: null } }),
      groupBy: vi.fn().mockResolvedValue([]),
    },
  },
}))

vi.mock('@/lib/logger', () => ({
  captureError: vi.fn(),
  createLogger: vi.fn(() => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
}))

import { recordAIUsage, getMonthlyUsage } from '@/lib/ai/usage'

describe('recordAIUsage', () => {
  beforeEach(() => vi.clearAllMocks())

  it('logger cost + tokens til AIUsageLog', async () => {
    const { prisma } = await import('@/lib/db')
    await recordAIUsage({
      organizationId: 'org-1',
      feature: 'insights',
      model: 'claude-haiku-4-5-20260101',
      provider: 'anthropic',
      inputTokens: 10000,
      outputTokens: 2000,
      costUsd: 0.02,
      resourceType: 'company',
      resourceId: 'company-1',
    })
    expect(prisma.aIUsageLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organization_id: 'org-1',
        feature: 'insights',
        model: 'claude-haiku-4-5-20260101',
        input_tokens: 10000,
        output_tokens: 2000,
        cost_usd: 0.02,
      }),
    })
  })

  it('sluger DB-fejl stille (logger ikke thrower)', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.aIUsageLog.create).mockImplementation((() =>
      Promise.reject(new Error('DB down'))) as never)
    await expect(
      recordAIUsage({
        organizationId: 'org-1',
        feature: 'insights',
        model: 'claude-haiku-4-5-20260101',
        provider: 'anthropic',
        inputTokens: 100,
        outputTokens: 50,
        costUsd: 0.001,
      })
    ).resolves.toBeUndefined()
  })
})

describe('getMonthlyUsage', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returnerer total + breakdown pr. feature', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.aIUsageLog.aggregate).mockImplementation((() =>
      Promise.resolve({ _sum: { cost_usd: 5.42 } })) as never)
    vi.mocked(prisma.aIUsageLog.groupBy).mockImplementation((() =>
      Promise.resolve([
        { feature: 'insights', _sum: { cost_usd: 3.2 } },
        { feature: 'extraction', _sum: { cost_usd: 2.22 } },
      ])) as never)
    const result = await getMonthlyUsage('org-1')
    expect(result.totalCostUsd).toBe(5.42)
    expect(result.byFeature).toHaveLength(2)
    expect(result.byFeature.find((f) => f.feature === 'insights')?.costUsd).toBe(3.2)
  })

  it('returnerer 0 når ingen forbrug', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.aIUsageLog.aggregate).mockImplementation((() =>
      Promise.resolve({ _sum: { cost_usd: null } })) as never)
    vi.mocked(prisma.aIUsageLog.groupBy).mockImplementation((() => Promise.resolve([])) as never)
    const result = await getMonthlyUsage('org-1')
    expect(result.totalCostUsd).toBe(0)
    expect(result.byFeature).toEqual([])
  })
})
