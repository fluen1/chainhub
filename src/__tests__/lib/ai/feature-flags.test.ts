import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock Prisma before importing the module under test
vi.mock('@/lib/db', () => ({
  prisma: {
    organizationAISettings: {
      findUnique: vi.fn(),
    },
  },
}))

import { isAIEnabled, type AIFeature } from '@/lib/ai/feature-flags'
import { prisma } from '@/lib/db'

const mockFindUnique = vi.mocked(prisma.organizationAISettings.findUnique)

const ORG_ID = 'org-test-123'

function mockSettings(overrides: Record<string, unknown> = {}) {
  return {
    organization_id: ORG_ID,
    kill_switch: false,
    ai_mode: 'LIVE',
    beta_features: [] as string[],
    ...overrides,
  }
}

describe('isAIEnabled', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    process.env.AI_EXTRACTION_ENABLED = 'true'
  })

  it('returnerer false når AI_EXTRACTION_ENABLED ikke er true', async () => {
    process.env.AI_EXTRACTION_ENABLED = 'false'
    const result = await isAIEnabled(ORG_ID, 'extraction')
    expect(result).toBe(false)
    expect(mockFindUnique).not.toHaveBeenCalled()
  })

  it('returnerer false når settings ikke findes', async () => {
    mockFindUnique.mockResolvedValueOnce(null)
    const result = await isAIEnabled(ORG_ID, 'extraction')
    expect(result).toBe(false)
  })

  it('returnerer false når kill_switch er aktiv', async () => {
    mockFindUnique.mockResolvedValueOnce(mockSettings({ kill_switch: true }) as never)
    const result = await isAIEnabled(ORG_ID, 'extraction')
    expect(result).toBe(false)
  })

  it('returnerer false når ai_mode er OFF', async () => {
    mockFindUnique.mockResolvedValueOnce(mockSettings({ ai_mode: 'OFF' }) as never)
    const result = await isAIEnabled(ORG_ID, 'insights')
    expect(result).toBe(false)
  })

  it('returnerer true i LIVE-tilstand for alle eksisterende features', async () => {
    const features: AIFeature[] = ['extraction', 'insights', 'search_ai', 'calendar_events']
    for (const feature of features) {
      mockFindUnique.mockResolvedValueOnce(mockSettings({ ai_mode: 'LIVE' }) as never)
      expect(await isAIEnabled(ORG_ID, feature)).toBe(true)
    }
  })

  it('returnerer true i SHADOW-tilstand', async () => {
    mockFindUnique.mockResolvedValueOnce(mockSettings({ ai_mode: 'SHADOW' }) as never)
    const result = await isAIEnabled(ORG_ID, 'extraction')
    expect(result).toBe(true)
  })

  // Nye feature-typer
  describe('nye features: entity_matching, autofill, alerts, assistant', () => {
    const newFeatures: AIFeature[] = ['entity_matching', 'autofill', 'alerts', 'assistant']

    it('returnerer true for alle nye features i LIVE-tilstand', async () => {
      for (const feature of newFeatures) {
        mockFindUnique.mockResolvedValueOnce(mockSettings({ ai_mode: 'LIVE' }) as never)
        expect(await isAIEnabled(ORG_ID, feature)).toBe(true)
      }
    })

    it('returnerer true for nye features i SHADOW-tilstand', async () => {
      for (const feature of newFeatures) {
        mockFindUnique.mockResolvedValueOnce(mockSettings({ ai_mode: 'SHADOW' }) as never)
        expect(await isAIEnabled(ORG_ID, feature)).toBe(true)
      }
    })

    it('returnerer true i BETA-tilstand når feature er whitelisted', async () => {
      for (const feature of newFeatures) {
        mockFindUnique.mockResolvedValueOnce(
          mockSettings({ ai_mode: 'BETA', beta_features: [feature] }) as never
        )
        expect(await isAIEnabled(ORG_ID, feature)).toBe(true)
      }
    })

    it('returnerer false i BETA-tilstand når feature ikke er whitelisted', async () => {
      for (const feature of newFeatures) {
        mockFindUnique.mockResolvedValueOnce(
          mockSettings({ ai_mode: 'BETA', beta_features: [] }) as never
        )
        expect(await isAIEnabled(ORG_ID, feature)).toBe(false)
      }
    })
  })
})
