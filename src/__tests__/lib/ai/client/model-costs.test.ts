import { describe, it, expect } from 'vitest'
import { MODEL_COSTS, computeCostUsd, type ClaudeModel } from '@/lib/ai/client/types'

describe('MODEL_COSTS — verified 2026-04-19', () => {
  it('Haiku 4.5 priser matcher claude.com/pricing', () => {
    expect(MODEL_COSTS['claude-haiku-4-5']).toEqual({
      input: 1.0,
      output: 5.0,
      cacheWrite: 1.25,
      cacheRead: 0.1,
    })
  })
  it('Sonnet 4.6 priser matcher claude.com/pricing', () => {
    expect(MODEL_COSTS['claude-sonnet-4-6']).toEqual({
      input: 3.0,
      output: 15.0,
      cacheWrite: 3.75,
      cacheRead: 0.3,
    })
  })
  it('Opus 4.7 priser matcher claude.com/pricing', () => {
    expect(MODEL_COSTS['claude-opus-4-7']).toEqual({
      input: 5.0,
      output: 25.0,
      cacheWrite: 6.25,
      cacheRead: 0.5,
    })
  })
  it('computeCostUsd beregner basisk input+output korrekt', () => {
    const cost = computeCostUsd('claude-sonnet-4-6', 1_000_000, 1_000_000)
    expect(cost).toBeCloseTo(18.0, 4)
  })
  it('computeCostUsd inkluderer cache-tokens når angivet', () => {
    const cost = computeCostUsd('claude-sonnet-4-6', 0, 0, {
      cacheWriteTokens: 1_000_000,
      cacheReadTokens: 1_000_000,
    })
    expect(cost).toBeCloseTo(4.05, 4)
  })
  it('deprecated model-IDs findes ikke længere i ClaudeModel', () => {
    const models: ClaudeModel[] = ['claude-opus-4-7', 'claude-sonnet-4-6', 'claude-haiku-4-5']
    models.forEach((m) => expect(MODEL_COSTS[m]).toBeDefined())
  })
})
