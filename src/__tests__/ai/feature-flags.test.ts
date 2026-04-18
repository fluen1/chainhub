import { describe, it, expect, vi, beforeEach } from 'vitest'
import { isAIEnabled } from '@/lib/ai/feature-flags'

// Mock the Prisma client
vi.mock('@/lib/db', () => ({
  prisma: {
    organizationAISettings: {
      findUnique: vi.fn(),
    },
  },
}))

import { prisma } from '@/lib/db'

describe('isAIEnabled', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns false when global AI_EXTRACTION_ENABLED is false', async () => {
    const oldEnv = process.env.AI_EXTRACTION_ENABLED
    process.env.AI_EXTRACTION_ENABLED = 'false'
    const result = await isAIEnabled('org-1', 'extraction')
    expect(result).toBe(false)
    expect(prisma.organizationAISettings.findUnique).not.toHaveBeenCalled()
    process.env.AI_EXTRACTION_ENABLED = oldEnv
  })

  it('returns false when organization has no AI settings', async () => {
    process.env.AI_EXTRACTION_ENABLED = 'true'
    vi.mocked(prisma.organizationAISettings.findUnique).mockResolvedValue(null)
    const result = await isAIEnabled('org-1', 'extraction')
    expect(result).toBe(false)
  })

  it('returns false when kill_switch is true', async () => {
    process.env.AI_EXTRACTION_ENABLED = 'true'
    vi.mocked(prisma.organizationAISettings.findUnique).mockResolvedValue({
      id: 's1',
      organization_id: 'org-1',
      ai_mode: 'LIVE',
      shadow_comparison_enabled: false,
      beta_features: [],
      rate_limit_per_day: 1000,
      monthly_cost_cap_usd: null,
      kill_switch: true,
      created_at: new Date(),
      updated_at: new Date(),
    } as never)
    const result = await isAIEnabled('org-1', 'extraction')
    expect(result).toBe(false)
  })

  it('returns false when ai_mode is OFF', async () => {
    process.env.AI_EXTRACTION_ENABLED = 'true'
    vi.mocked(prisma.organizationAISettings.findUnique).mockResolvedValue({
      id: 's1',
      organization_id: 'org-1',
      ai_mode: 'OFF',
      shadow_comparison_enabled: false,
      beta_features: [],
      rate_limit_per_day: 1000,
      monthly_cost_cap_usd: null,
      kill_switch: false,
      created_at: new Date(),
      updated_at: new Date(),
    } as never)
    const result = await isAIEnabled('org-1', 'extraction')
    expect(result).toBe(false)
  })

  it('returns true when ai_mode is SHADOW', async () => {
    process.env.AI_EXTRACTION_ENABLED = 'true'
    vi.mocked(prisma.organizationAISettings.findUnique).mockResolvedValue({
      id: 's1',
      organization_id: 'org-1',
      ai_mode: 'SHADOW',
      shadow_comparison_enabled: true,
      beta_features: [],
      rate_limit_per_day: 1000,
      monthly_cost_cap_usd: null,
      kill_switch: false,
      created_at: new Date(),
      updated_at: new Date(),
    } as never)
    const result = await isAIEnabled('org-1', 'extraction')
    expect(result).toBe(true)
  })

  it('returns true when ai_mode is BETA and feature is in beta_features', async () => {
    process.env.AI_EXTRACTION_ENABLED = 'true'
    vi.mocked(prisma.organizationAISettings.findUnique).mockResolvedValue({
      id: 's1',
      organization_id: 'org-1',
      ai_mode: 'BETA',
      shadow_comparison_enabled: false,
      beta_features: ['extraction', 'insights'],
      rate_limit_per_day: 1000,
      monthly_cost_cap_usd: null,
      kill_switch: false,
      created_at: new Date(),
      updated_at: new Date(),
    } as never)
    const result = await isAIEnabled('org-1', 'extraction')
    expect(result).toBe(true)
  })

  it('returns false when ai_mode is BETA but feature is not in beta_features', async () => {
    process.env.AI_EXTRACTION_ENABLED = 'true'
    vi.mocked(prisma.organizationAISettings.findUnique).mockResolvedValue({
      id: 's1',
      organization_id: 'org-1',
      ai_mode: 'BETA',
      shadow_comparison_enabled: false,
      beta_features: ['extraction'],
      rate_limit_per_day: 1000,
      monthly_cost_cap_usd: null,
      kill_switch: false,
      created_at: new Date(),
      updated_at: new Date(),
    } as never)
    const result = await isAIEnabled('org-1', 'search_ai')
    expect(result).toBe(false)
  })

  it('returns true when ai_mode is LIVE', async () => {
    process.env.AI_EXTRACTION_ENABLED = 'true'
    vi.mocked(prisma.organizationAISettings.findUnique).mockResolvedValue({
      id: 's1',
      organization_id: 'org-1',
      ai_mode: 'LIVE',
      shadow_comparison_enabled: false,
      beta_features: [],
      rate_limit_per_day: 1000,
      monthly_cost_cap_usd: null,
      kill_switch: false,
      created_at: new Date(),
      updated_at: new Date(),
    } as never)
    const result = await isAIEnabled('org-1', 'extraction')
    expect(result).toBe(true)
  })
})
