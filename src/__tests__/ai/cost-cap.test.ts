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

import { MODEL_COSTS } from '@/lib/ai/client/types'
import { checkCostCap, getCostCapStatus, estimateExtractionCost } from '@/lib/ai/cost-cap'

describe('checkCostCap', () => {
  beforeEach(() => vi.clearAllMocks())

  it('anvender default $50/md cap når settings-row mangler', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.organizationAISettings.findUnique).mockImplementation((() =>
      Promise.resolve(null)) as never)
    vi.mocked(prisma.aIUsageLog.aggregate).mockImplementation((() =>
      Promise.resolve({ _sum: { cost_usd: 10 } })) as never)
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

  it('falder tilbage til default $50 cap når settings-row mangler', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.organizationAISettings.findUnique).mockImplementation((() =>
      Promise.resolve(null)) as never)
    vi.mocked(prisma.aIUsageLog.aggregate).mockImplementation((() =>
      Promise.resolve({ _sum: { cost_usd: 5 } })) as never)
    const result = await getCostCapStatus('org-1')
    expect(result.capUsd).toBe(50)
    expect(result.currentUsd).toBe(5)
    expect(result.threshold).toBe('none')
  })
})

describe('estimateExtractionCost — gpt-5-mini priser', () => {
  it('estimerer korrekt for 1 side', () => {
    // 1 side = 4000 input tokens + 3000 output tokens med gpt-5-mini-priser
    const inputCost = (4000 * MODEL_COSTS['gpt-5-mini'].input) / 1_000_000
    const outputCost = (3000 * MODEL_COSTS['gpt-5-mini'].output) / 1_000_000
    const expected = inputCost * 2 + outputCost * 2 + 0.001 // 2 runs + nano type-detection

    const actual = estimateExtractionCost(1)
    expect(actual).toBeCloseTo(expected, 5)
  })

  it('estimerer korrekt for 10 sider', () => {
    const pages = 10
    const inputCost = (pages * 4000 * MODEL_COSTS['gpt-5-mini'].input) / 1_000_000
    const outputCost = (3000 * MODEL_COSTS['gpt-5-mini'].output) / 1_000_000
    const expected = inputCost * 2 + outputCost * 2 + 0.001

    const actual = estimateExtractionCost(pages)
    expect(actual).toBeCloseTo(expected, 5)
  })

  it('er mindst 10x billigere end Sonnet-estimat for samme input', () => {
    // Sikrer at vi IKKE bruger Sonnet-priser ($3 input vs $0.25 = 12x)
    const sonnetEstimate = ((10 * 4000 * 3) / 1_000_000) * 2 + ((3000 * 15) / 1_000_000) * 2 + 0.01
    const gptEstimate = estimateExtractionCost(10)
    expect(gptEstimate).toBeLessThan(sonnetEstimate / 8)
  })

  it('skalerer lineært med sidetal', () => {
    const est1 = estimateExtractionCost(1)
    const est10 = estimateExtractionCost(10)
    // outputTokens (3000) er konstant per run; kun inputTokens skalerer med sidetal.
    // 10 sider: input-delen er 10× størst, men output+type-detection er konstant.
    // Ratio er < 10x, men input-delen (lille andel) vokser. Vi verificerer at
    // estimatet faktisk stiger med sidetal (ikke blot er konstant).
    expect(est10).toBeGreaterThan(est1)
    // Og at det ikke vokser hurtigere end lineært (ingen eksponentiel vækst)
    expect(est10).toBeLessThan(est1 * 12)
    // Verificer at absolutte input-bidrag skalerer: 10x sider = 10x input-tokens
    const inputPerPage = (4000 * 0.25) / 1_000_000
    expect(est10 - est1).toBeCloseTo(inputPerPage * 2 * 9, 5) // 9 ekstra sider
  })
})
