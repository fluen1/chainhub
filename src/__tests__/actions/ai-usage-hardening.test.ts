import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))
vi.mock('@/lib/db', () => ({
  prisma: {
    aIUsageLog: { count: vi.fn(), groupBy: vi.fn(), findMany: vi.fn() },
    organizationAISettings: { findUnique: vi.fn() },
  },
}))
vi.mock('@/lib/ai/cost-cap', () => ({
  getCostCapStatus: vi.fn().mockResolvedValue({
    threshold: 'none',
    capUsd: 50,
    currentUsd: 0,
    percentage: 0,
  }),
}))
vi.mock('@/lib/logger', () => ({ captureError: vi.fn() }))
vi.mock('@/lib/permissions', () => ({
  canAccessModule: vi.fn(),
}))

import { auth } from '@/lib/auth'
import { canAccessModule } from '@/lib/permissions'
import { getSettingsAIUsage } from '@/actions/ai-usage'

describe('ai-usage hardening', () => {
  beforeEach(() => vi.clearAllMocks())

  it('getSettingsAIUsage afviser uden settings-adgang', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'u1', organizationId: 'o1', email: 'a@b.dk', name: 'A' },
    } as never)
    vi.mocked(canAccessModule).mockResolvedValue(false)

    const result = await getSettingsAIUsage()
    expect(result.used).toBe(0)
    expect(result.max).toBe(1000)
    expect(canAccessModule).toHaveBeenCalledWith('u1', 'settings', 'o1')
  })
})
