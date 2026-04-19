import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  prisma: {
    organizationAISettings: {
      findUnique: vi.fn(),
    },
    aIUsageLog: {
      aggregate: vi.fn().mockResolvedValue({ _sum: { cost_usd: null } }),
    },
  },
}))

vi.mock('@/lib/logger', () => ({
  captureError: vi.fn(),
  createLogger: vi.fn(() => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
}))

import { checkCostCap, getCostCapStatus } from '@/lib/ai/cost-cap'

describe('checkCostCap', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returnerer allowed=true når ingen cap konfigureret', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.organizationAISettings.findUnique).mockImplementation((() =>
      Promise.resolve({ monthly_cost_cap_usd: null })) as never)
    const result = await checkCostCap('org-1')
    expect(result.allowed).toBe(true)
    expect(result.reason).toBeUndefined()
  })

  it('returnerer allowed=true når forbrug under cap', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.organizationAISettings.findUnique).mockImplementation((() =>
      Promise.resolve({ monthly_cost_cap_usd: 50 })) as never)
    vi.mocked(prisma.aIUsageLog.aggregate).mockImplementation((() =>
      Promise.resolve({ _sum: { cost_usd: 10 } })) as never)
    const result = await checkCostCap('org-1')
    expect(result.allowed).toBe(true)
  })

  it('returnerer allowed=false når forbrug over cap', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.organizationAISettings.findUnique).mockImplementation((() =>
      Promise.resolve({ monthly_cost_cap_usd: 50 })) as never)
    vi.mocked(prisma.aIUsageLog.aggregate).mockImplementation((() =>
      Promise.resolve({ _sum: { cost_usd: 55 } })) as never)
    const result = await checkCostCap('org-1')
    expect(result.allowed).toBe(false)
    expect(result.reason).toMatch(/cap/i)
  })
})

describe('getCostCapStatus', () => {
  beforeEach(() => vi.clearAllMocks())

  it('beregner percentage når cap er sat', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.organizationAISettings.findUnique).mockImplementation((() =>
      Promise.resolve({ monthly_cost_cap_usd: 100 })) as never)
    vi.mocked(prisma.aIUsageLog.aggregate).mockImplementation((() =>
      Promise.resolve({ _sum: { cost_usd: 75 } })) as never)
    const result = await getCostCapStatus('org-1')
    expect(result.capUsd).toBe(100)
    expect(result.currentUsd).toBe(75)
    expect(result.percentage).toBe(75)
    expect(result.threshold).toBe('75-warn')
  })

  it('returnerer threshold=none når <50%', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.organizationAISettings.findUnique).mockImplementation((() =>
      Promise.resolve({ monthly_cost_cap_usd: 100 })) as never)
    vi.mocked(prisma.aIUsageLog.aggregate).mockImplementation((() =>
      Promise.resolve({ _sum: { cost_usd: 20 } })) as never)
    const result = await getCostCapStatus('org-1')
    expect(result.threshold).toBe('none')
  })

  it('returnerer threshold=exceeded når >=100%', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.organizationAISettings.findUnique).mockImplementation((() =>
      Promise.resolve({ monthly_cost_cap_usd: 100 })) as never)
    vi.mocked(prisma.aIUsageLog.aggregate).mockImplementation((() =>
      Promise.resolve({ _sum: { cost_usd: 110 } })) as never)
    const result = await getCostCapStatus('org-1')
    expect(result.threshold).toBe('exceeded')
  })

  it('returnerer threshold=none når ingen cap', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.organizationAISettings.findUnique).mockImplementation((() =>
      Promise.resolve({ monthly_cost_cap_usd: null })) as never)
    const result = await getCostCapStatus('org-1')
    expect(result.capUsd).toBeNull()
    expect(result.threshold).toBe('none')
  })
})
