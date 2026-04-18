import { describe, it, expect, vi, beforeAll } from 'vitest'
import { detectDocumentType } from '@/lib/ai/pipeline/pass1-type-detection'
import type { ClaudeClient, ClaudeResponse } from '@/lib/ai/client/types'
import type { ExtractionContent } from '@/lib/ai/content-loader'

// Registrér mindst ét schema så getAllSchemaTypes returnerer noget
beforeAll(async () => {
  try {
    await import('@/lib/ai/schemas/ejeraftale')
  } catch {}
})

function mockClient(response: Partial<ClaudeResponse>): ClaudeClient {
  return {
    providerName: 'anthropic',
    complete: vi.fn().mockResolvedValue({
      id: 'msg_test',
      model: 'claude-3-5-haiku-20241022',
      stop_reason: 'tool_use',
      content: [
        {
          type: 'tool_use',
          id: 'tu_1',
          name: 'classify_document',
          input: {
            detected_type: 'EJERAFTALE',
            confidence: 0.92,
            alternatives: [{ type: 'VEDTAEGTER', confidence: 0.05 }],
          },
        },
      ],
      usage: { input_tokens: 500, output_tokens: 50 },
      ...response,
    }),
  }
}

describe('Pass 1: Type detection', () => {
  const testContent: ExtractionContent = {
    type: 'text_html',
    html: '<p>EJERAFTALE mellem Kædegruppen og Dr. Petersen</p>',
    detectedMime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  }

  it('detects EJERAFTALE with high confidence', async () => {
    const client = mockClient({})
    const result = await detectDocumentType(testContent, client)

    expect(result.detected_type).toBe('EJERAFTALE')
    expect(result.confidence).toBe(0.92)
    expect(result.alternatives).toHaveLength(1)
    expect(result.model_used).toContain('haiku')
    expect(result.input_tokens).toBeGreaterThan(0)
  })

  it('maps UNKNOWN to MINIMAL', async () => {
    const client: ClaudeClient = {
      providerName: 'anthropic',
      complete: vi.fn().mockResolvedValue({
        id: 'msg_test',
        model: 'claude-3-5-haiku-20241022',
        stop_reason: 'tool_use',
        content: [
          {
            type: 'tool_use',
            id: 'tu_1',
            name: 'classify_document',
            input: { detected_type: 'UNKNOWN', confidence: 0.3, alternatives: [] },
          },
        ],
        usage: { input_tokens: 100, output_tokens: 30 },
      }),
    }

    const result = await detectDocumentType(testContent, client)
    expect(result.detected_type).toBe('MINIMAL')
    expect(result.confidence).toBe(0.3)
  })

  it('handles missing tool_use response gracefully', async () => {
    const client: ClaudeClient = {
      providerName: 'anthropic',
      complete: vi.fn().mockResolvedValue({
        id: 'msg_test',
        model: 'claude-3-5-haiku-20241022',
        stop_reason: 'end_turn',
        content: [{ type: 'text', text: 'I could not classify.' }],
        usage: { input_tokens: 100, output_tokens: 30 },
      }),
    }

    const result = await detectDocumentType(testContent, client)
    expect(result.detected_type).toBe('UNKNOWN')
    expect(result.confidence).toBe(0)
  })

  it('tracks token usage', async () => {
    const client = mockClient({})
    const result = await detectDocumentType(testContent, client)
    expect(result.input_tokens).toBe(500)
    expect(result.output_tokens).toBe(50)
  })
})
