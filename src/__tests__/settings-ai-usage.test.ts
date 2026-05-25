import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({
  auth: vi.fn().mockResolvedValue({ user: { id: 'user-1', organizationId: 'org-1' } }),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    aIUsageLog: {
      count: vi.fn().mockResolvedValue(0),
    },
    organizationAISettings: {
      findUnique: vi.fn().mockResolvedValue({ monthly_cost_cap_usd: 50, rate_limit_per_day: 1000 }),
    },
  },
}))

vi.mock('@/lib/logger', () => ({
  captureError: vi.fn(),
  createLogger: vi.fn(() => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
}))

vi.mock('@/lib/permissions', () => ({
  canAccessModule: vi.fn().mockResolvedValue(true),
}))

vi.mock('@/lib/ai/cost-cap', () => ({
  getCostCapStatus: vi.fn().mockResolvedValue({
    capUsd: 50,
    currentUsd: 0,
    percentage: 0,
    threshold: 'none',
  }),
}))

import { getSettingsAIUsage } from '@/actions/ai-usage'
import { getCostCapStatus } from '@/lib/ai/cost-cap'

describe('getSettingsAIUsage', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returnerer nul-data for ny org uden forbrug', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.aIUsageLog.count).mockResolvedValue(0)

    const result = await getSettingsAIUsage()

    expect(result.used).toBe(0)
    expect(result.max).toBe(1000)
    expect(result.percent).toBe(0)
    expect(result.threshold).toBe('none')
    expect(result.currentUsd).toBe(0)
  })

  it('beregner percent korrekt ud fra extraction-count', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.aIUsageLog.count).mockResolvedValue(750)
    vi.mocked(getCostCapStatus).mockResolvedValue({
      capUsd: 50,
      currentUsd: 37.5,
      percentage: 75,
      threshold: '75-warn',
    })

    const result = await getSettingsAIUsage()

    expect(result.used).toBe(750)
    expect(result.max).toBe(1000)
    expect(result.percent).toBe(75)
    expect(result.threshold).toBe('75-warn')
  })

  it('bruger rate_limit_per_day som max', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.organizationAISettings.findUnique).mockResolvedValue({
      monthly_cost_cap_usd: 100,
      rate_limit_per_day: 500,
    } as never)
    vi.mocked(prisma.aIUsageLog.count).mockResolvedValue(250)

    const result = await getSettingsAIUsage()

    expect(result.max).toBe(500)
    expect(result.percent).toBe(50)
  })

  it('fallback til 1000 max hvis ingen ai-settings', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.organizationAISettings.findUnique).mockResolvedValue(null)
    vi.mocked(prisma.aIUsageLog.count).mockResolvedValue(100)

    const result = await getSettingsAIUsage()

    expect(result.max).toBe(1000)
    expect(result.percent).toBe(10)
  })

  it('clamper percent til 100 ved overskridelse', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.aIUsageLog.count).mockResolvedValue(1200)
    vi.mocked(getCostCapStatus).mockResolvedValue({
      capUsd: 50,
      currentUsd: 60,
      percentage: 120,
      threshold: 'exceeded',
    })

    const result = await getSettingsAIUsage()

    expect(result.percent).toBe(100)
    expect(result.threshold).toBe('exceeded')
  })

  it('returnerer fail-safe ved DB-fejl', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.aIUsageLog.count).mockRejectedValue(new Error('DB nede'))

    const result = await getSettingsAIUsage()

    // Fail-safe returner 0-data frem for at crashe siden
    expect(result.used).toBe(0)
    expect(result.max).toBe(1000)
    expect(result.percent).toBe(0)
  })
})

describe('getSettingsAIUsage konsolidering', () => {
  beforeEach(() => vi.clearAllMocks())

  it('kalder getCostCapStatus præcis én gang per kald', async () => {
    await getSettingsAIUsage()

    // Verificerer at vi ikke kalder getCostCapStatus mere end én gang
    expect(getCostCapStatus).toHaveBeenCalledTimes(1)
    expect(getCostCapStatus).toHaveBeenCalledWith('org-1')
  })

  it('returnerer capUsd og currentUsd fra getCostCapStatus — ingen separat USD-query', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.aIUsageLog.count).mockResolvedValue(0)
    vi.mocked(getCostCapStatus).mockResolvedValue({
      capUsd: 75,
      currentUsd: 30,
      percentage: 40,
      threshold: '50-info',
    })

    const result = await getSettingsAIUsage()

    expect(result.capUsd).toBe(75)
    expect(result.currentUsd).toBe(30)
    expect(result.threshold).toBe('50-info')
  })
})

describe('AI-usage tærskel-logik', () => {
  it('threshold matcher cost-cap spec: ingen advarsel under 50%', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.aIUsageLog.count).mockResolvedValue(400)
    vi.mocked(getCostCapStatus).mockResolvedValue({
      capUsd: 50,
      currentUsd: 20,
      percentage: 40,
      threshold: 'none',
    })

    const result = await getSettingsAIUsage()
    expect(result.threshold).toBe('none')
  })

  it('threshold matcher cost-cap spec: 50-info fra 50%', async () => {
    vi.mocked(getCostCapStatus).mockResolvedValue({
      capUsd: 50,
      currentUsd: 25,
      percentage: 50,
      threshold: '50-info',
    })

    const result = await getSettingsAIUsage()
    expect(result.threshold).toBe('50-info')
  })

  it('threshold matcher cost-cap spec: 90-alert fra 90%', async () => {
    vi.mocked(getCostCapStatus).mockResolvedValue({
      capUsd: 50,
      currentUsd: 45,
      percentage: 90,
      threshold: '90-alert',
    })

    const result = await getSettingsAIUsage()
    expect(result.threshold).toBe('90-alert')
  })
})
