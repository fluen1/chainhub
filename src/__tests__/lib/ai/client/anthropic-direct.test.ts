import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AnthropicDirectClient } from '@/lib/ai/client/anthropic-direct'

const mockCreate = vi.fn().mockResolvedValue({
  id: 'msg_123',
  model: 'claude-sonnet-4-6',
  stop_reason: 'end_turn',
  content: [{ type: 'text', text: 'hej' }],
  usage: {
    input_tokens: 50,
    output_tokens: 20,
    cache_creation_input_tokens: 3000,
    cache_read_input_tokens: 0,
  },
})

vi.mock('@anthropic-ai/sdk', () => {
  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    default: vi.fn().mockImplementation(function (this: any) {
      this.messages = { create: mockCreate }
    }),
  }
})

describe('AnthropicDirectClient', () => {
  let client: AnthropicDirectClient
  beforeEach(() => {
    client = new AnthropicDirectClient('test-key')
  })

  it('parser cache_creation_input_tokens fra API response', async () => {
    const response = await client.complete({
      model: 'claude-sonnet-4-6',
      max_tokens: 100,
      messages: [{ role: 'user', content: 'test' }],
    })
    expect(response.usage.cache_creation_input_tokens).toBe(3000)
  })

  it('parser cache_read_input_tokens fra API response', async () => {
    const response = await client.complete({
      model: 'claude-sonnet-4-6',
      max_tokens: 100,
      messages: [{ role: 'user', content: 'test' }],
    })
    expect(response.usage.cache_read_input_tokens).toBe(0)
  })
})
