import { describe, it, expect, vi, beforeEach } from 'vitest'
import { isAIEnabled } from '@/lib/ai/feature-flags'

// Mock env for at undgå at env.ts kaster ved manglende DATABASE_URL i tests.
// Factory bruges med et mutable objekt — vi.mock er hoisted, så ingen closure-variabel.
vi.mock('@/lib/env', () => {
  const envMock = {
    AI_EXTRACTION_ENABLED: 'false' as 'true' | 'false',
    OPENAI_API_KEY: undefined as string | undefined,
    OPENAI_BASE_URL: undefined as string | undefined,
    DATABASE_URL: 'postgresql://test',
    NEXTAUTH_SECRET: 'test',
  }
  return { env: envMock, baseUrl: 'http://localhost:3000' }
})

// Mock the Prisma client
vi.mock('@/lib/db', () => ({
  prisma: {
    organizationAISettings: {
      findUnique: vi.fn(),
    },
  },
}))

import { prisma } from '@/lib/db'
import { env } from '@/lib/env'

// Cast så vi kan mutere AI_EXTRACTION_ENABLED i tests
const mutableEnv = env as { AI_EXTRACTION_ENABLED: 'true' | 'false' }

describe('isAIEnabled', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mutableEnv.AI_EXTRACTION_ENABLED = 'false'
  })

  it('returns false when global AI_EXTRACTION_ENABLED is false', async () => {
    mutableEnv.AI_EXTRACTION_ENABLED = 'false'
    const result = await isAIEnabled('org-1', 'extraction')
    expect(result).toBe(false)
    expect(prisma.organizationAISettings.findUnique).not.toHaveBeenCalled()
  })

  it('returns false when organization has no AI settings', async () => {
    mutableEnv.AI_EXTRACTION_ENABLED = 'true'
    vi.mocked(prisma.organizationAISettings.findUnique).mockResolvedValue(null)
    const result = await isAIEnabled('org-1', 'extraction')
    expect(result).toBe(false)
  })

  it('returns false when kill_switch is true', async () => {
    mutableEnv.AI_EXTRACTION_ENABLED = 'true'
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
    mutableEnv.AI_EXTRACTION_ENABLED = 'true'
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
    mutableEnv.AI_EXTRACTION_ENABLED = 'true'
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
    mutableEnv.AI_EXTRACTION_ENABLED = 'true'
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
    mutableEnv.AI_EXTRACTION_ENABLED = 'true'
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
    mutableEnv.AI_EXTRACTION_ENABLED = 'true'
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
