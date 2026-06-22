import { describe, it, expect, vi, beforeEach } from 'vitest'

// Fang payloaden der sendes til OpenAI's Responses API
const createMock = vi.fn()

vi.mock('openai', () => ({
  default: class {
    responses = { create: createMock }
  },
}))

import { OpenAIDirectClient, supportsCustomTemperature } from '@/lib/ai/client/openai-direct'

function okResponse(model: string) {
  return {
    id: 'resp_1',
    model,
    output_text: 'ok',
    output: [],
    usage: { input_tokens: 5, output_tokens: 3 },
    status: 'completed',
  }
}

describe('supportsCustomTemperature', () => {
  it('returnerer false for gpt-5 reasoning-modeller', () => {
    expect(supportsCustomTemperature('gpt-5-mini')).toBe(false)
    expect(supportsCustomTemperature('gpt-5')).toBe(false)
    expect(supportsCustomTemperature('gpt-5-nano')).toBe(false)
  })

  it('returnerer true for ikke-reasoning-modeller (fremtidssikring)', () => {
    expect(supportsCustomTemperature('gpt-4o-mini')).toBe(true)
  })
})

describe('OpenAIDirectClient — temperature udelades for gpt-5 (regression)', () => {
  beforeEach(() => {
    createMock.mockReset()
  })

  it('sender IKKE temperature til Responses API for gpt-5-mini, selv når kalderen beder om det', async () => {
    createMock.mockResolvedValue(okResponse('gpt-5-mini'))
    const client = new OpenAIDirectClient('sk-test')

    await client.complete({
      model: 'gpt-5-mini',
      system: 'sys',
      messages: [{ role: 'user', content: 'hej' }],
      max_tokens: 100,
      temperature: 0.3, // ville ellers give "temperature does not support 0.3 with this model"
    })

    expect(createMock).toHaveBeenCalledTimes(1)
    const payload = (createMock.mock.calls[0]?.[0] ?? {}) as Record<string, unknown>
    expect(payload.model).toBe('gpt-5-mini')
    expect(payload).not.toHaveProperty('temperature')
    expect(payload.max_output_tokens).toBe(100)
  })
})
