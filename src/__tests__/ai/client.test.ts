import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AnthropicDirectClient } from '@/lib/ai/client/anthropic-direct'
import type { ClaudeRequest } from '@/lib/ai/client/types'
import { ClaudeClientError, computeCostUsd, MODEL_COSTS } from '@/lib/ai/client/types'

const mockCreate = vi.fn()
vi.mock('@anthropic-ai/sdk', () => {
  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    default: vi.fn().mockImplementation(function (this: any) {
      this.messages = { create: mockCreate }
    }),
  }
})

describe('AnthropicDirectClient', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('has providerName "anthropic"', () => {
    const client = new AnthropicDirectClient('sk-test')
    expect(client.providerName).toBe('anthropic')
  })

  it('throws if API key is missing', () => {
    expect(() => new AnthropicDirectClient('')).toThrow('ANTHROPIC_API_KEY is required')
  })

  it('sends request and returns normalized response', async () => {
    mockCreate.mockResolvedValue({
      id: 'msg_123',
      model: 'claude-sonnet-4-20250514',
      stop_reason: 'end_turn',
      content: [{ type: 'text', text: 'Hello back' }],
      usage: { input_tokens: 10, output_tokens: 5 },
    })
    const client = new AnthropicDirectClient('sk-test')
    const request: ClaudeRequest = {
      model: 'claude-sonnet-4-20250514',
      max_tokens: 100,
      messages: [{ role: 'user', content: 'Hello' }],
    }
    const response = await client.complete(request)
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'claude-sonnet-4-20250514', max_tokens: 100 })
    )
    expect(response.id).toBe('msg_123')
    expect(response.content).toEqual([{ type: 'text', text: 'Hello back' }])
    expect(response.usage.input_tokens).toBe(10)
  })

  it('wraps 429 errors as retryable', async () => {
    const err: Error & { status?: number } = new Error('Rate limited')
    err.status = 429
    mockCreate.mockRejectedValue(err)
    const client = new AnthropicDirectClient('sk-test')
    const request: ClaudeRequest = {
      model: 'claude-sonnet-4-20250514',
      max_tokens: 100,
      messages: [{ role: 'user', content: 'Hello' }],
    }
    try {
      await client.complete(request)
    } catch (e) {
      expect(e).toBeInstanceOf(ClaudeClientError)
      expect((e as ClaudeClientError).retryable).toBe(true)
    }
  })

  it('marks 4xx errors (except 429) as non-retryable', async () => {
    const err: Error & { status?: number } = new Error('Bad request')
    err.status = 400
    mockCreate.mockRejectedValue(err)
    const client = new AnthropicDirectClient('sk-test')
    const request: ClaudeRequest = {
      model: 'claude-sonnet-4-20250514',
      max_tokens: 100,
      messages: [{ role: 'user', content: 'Hello' }],
    }
    try {
      await client.complete(request)
    } catch (e) {
      expect((e as ClaudeClientError).retryable).toBe(false)
    }
  })

  it('marks 5xx errors as retryable', async () => {
    const err: Error & { status?: number } = new Error('Server error')
    err.status = 500
    mockCreate.mockRejectedValue(err)
    const client = new AnthropicDirectClient('sk-test')
    const request: ClaudeRequest = {
      model: 'claude-sonnet-4-20250514',
      max_tokens: 100,
      messages: [{ role: 'user', content: 'Hello' }],
    }
    try {
      await client.complete(request)
    } catch (e) {
      expect((e as ClaudeClientError).retryable).toBe(true)
    }
  })
})

describe('computeCostUsd', () => {
  it('beregner korrekt cost for Haiku 4.5', () => {
    const cost = computeCostUsd('claude-haiku-4-5-20260101', 10_000, 2_000)
    // 10k * $1/M + 2k * $5/M = $0.01 + $0.01 = $0.02
    expect(cost).toBeCloseTo(0.02, 6)
  })

  it('beregner korrekt cost for Sonnet 4.6', () => {
    const cost = computeCostUsd('claude-sonnet-4-6-20251201', 15_000, 3_000)
    // 15k * $3/M + 3k * $15/M = $0.045 + $0.045 = $0.09
    expect(cost).toBeCloseTo(0.09, 6)
  })

  it('inkluderer cache-write når leveret', () => {
    const cost = computeCostUsd('claude-haiku-4-5-20260101', 0, 0, {
      cacheWriteTokens: 1_000_000,
    })
    expect(cost).toBeCloseTo(1.25, 6)
  })

  it('inkluderer cache-read når leveret', () => {
    const cost = computeCostUsd('claude-haiku-4-5-20260101', 0, 0, {
      cacheReadTokens: 1_000_000,
    })
    expect(cost).toBeCloseTo(0.1, 6)
  })

  it('alle modeller er defineret i MODEL_COSTS', () => {
    const keys: Array<keyof typeof MODEL_COSTS> = [
      'claude-opus-4-7-20260101',
      'claude-sonnet-4-6-20251201',
      'claude-sonnet-4-20250514',
      'claude-3-5-haiku-20241022',
      'claude-haiku-4-5-20260101',
    ]
    keys.forEach((k) => {
      expect(MODEL_COSTS[k]).toBeDefined()
      expect(MODEL_COSTS[k].input).toBeGreaterThan(0)
    })
  })
})
