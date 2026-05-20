import { describe, it, expect } from 'vitest'
import { MODEL_COSTS, computeCostUsd, type ClaudeModel } from '@/lib/ai/client/types'

describe('MODEL_COSTS — OpenAI pricing pr. 1M tokens', () => {
  it('gpt-5-mini priser', () => {
    expect(MODEL_COSTS['gpt-5-mini']).toEqual({
      input: 0.25,
      output: 2.0,
      cachedInput: 0.025,
    })
  })

  it('gpt-5 priser', () => {
    expect(MODEL_COSTS['gpt-5']).toEqual({
      input: 1.25,
      output: 10.0,
      cachedInput: 0.125,
    })
  })

  it('gpt-5-nano priser', () => {
    expect(MODEL_COSTS['gpt-5-nano']).toEqual({
      input: 0.05,
      output: 0.4,
      cachedInput: 0.005,
    })
  })

  it('computeCostUsd beregner basisk input+output korrekt', () => {
    // gpt-5-mini: 1M input @ $0.25 + 1M output @ $2.00 = $2.25
    const cost = computeCostUsd('gpt-5-mini', 1_000_000, 1_000_000)
    expect(cost).toBeCloseTo(2.25, 4)
  })

  it('computeCostUsd anvender cachedInput-pris på cacheReadTokens', () => {
    // 1M input hvoraf 1M er cached + 0 output → 1M × $0.025/M = $0.025
    const cost = computeCostUsd('gpt-5-mini', 1_000_000, 0, {
      cacheReadTokens: 1_000_000,
    })
    expect(cost).toBeCloseTo(0.025, 4)
  })

  it('computeCostUsd ignorerer cacheWriteTokens (OpenAI har ingen separat cache-write-pris)', () => {
    const withWrite = computeCostUsd('gpt-5-mini', 1_000_000, 0, {
      cacheWriteTokens: 1_000_000,
    })
    const withoutWrite = computeCostUsd('gpt-5-mini', 1_000_000, 0)
    expect(withWrite).toBeCloseTo(withoutWrite, 6)
  })

  it('alle modeller er defineret', () => {
    const models: ClaudeModel[] = ['gpt-5', 'gpt-5-mini', 'gpt-5-nano']
    models.forEach((m) => expect(MODEL_COSTS[m]).toBeDefined())
  })
})
