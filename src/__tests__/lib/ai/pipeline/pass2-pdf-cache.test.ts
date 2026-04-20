import { describe, it, expect, vi } from 'vitest'
import { extractWithSchema } from '@/lib/ai/pipeline/pass2-schema-extraction'
import type { ContractSchema } from '@/lib/ai/schemas/types'
import type {
  ClaudeClient,
  ClaudeRequest,
  ClaudeContentBlock,
  ClaudeResponse,
} from '@/lib/ai/client/types'

const fakeSchema = {
  contract_type: 'MINIMAL',
  schema_version: 'v1',
  display_name: 'Test',
  tool_definition: {
    name: 'extract',
    description: 'x',
    input_schema: { type: 'object' },
  },
  extraction_model: 'claude-sonnet-4-6',
  system_prompt: 'sys',
  user_prompt_prefix: 'prefix',
  field_metadata: {},
  sanity_rules: [],
} as unknown as ContractSchema

function makeFakeClient(captured: ClaudeRequest[]): ClaudeClient {
  return {
    providerName: 'anthropic',
    complete: vi.fn(async (req: ClaudeRequest): Promise<ClaudeResponse> => {
      captured.push(req)
      return {
        id: 'm1',
        model: 'claude-sonnet-4-6',
        stop_reason: 'tool_use',
        content: [{ type: 'tool_use', id: 't', name: 'extract', input: {} }],
        usage: { input_tokens: 100, output_tokens: 50 },
      }
    }),
  }
}

describe('Pass 2 — PDF cache_control', () => {
  it('tilføjer cache_control til document-block når PDF er stor nok', async () => {
    const captured: ClaudeRequest[] = []
    const client = makeFakeClient(captured)
    const fakePdf = Buffer.alloc(500_000, 0x20)
    await extractWithSchema(
      { type: 'pdf_binary', data: fakePdf, detectedMime: 'application/pdf', page_count: 15 },
      fakeSchema,
      client
    )
    const content = captured[0].messages[0].content as ClaudeContentBlock[]
    const docBlock = content.find((b) => b.type === 'document')
    expect(docBlock).toBeDefined()
    expect((docBlock as { cache_control?: unknown }).cache_control).toEqual({ type: 'ephemeral' })
  })

  it('springer cache_control over når PDF er for lille (page_count=0 → under Sonnet 2048-minimum)', async () => {
    const captured: ClaudeRequest[] = []
    const client = makeFakeClient(captured)
    const tinyPdf = Buffer.alloc(5_000, 0x20)
    // page_count=0 (ukendt/ulæsbar PDF) → 0 * 3800 = 0 tokens, langt under Sonnet 2048
    await extractWithSchema(
      { type: 'pdf_binary', data: tinyPdf, detectedMime: 'application/pdf', page_count: 0 },
      fakeSchema,
      client
    )
    const content = captured[0].messages[0].content as ClaudeContentBlock[]
    const docBlock = content.find((b) => b.type === 'document')
    expect((docBlock as { cache_control?: unknown }).cache_control).toBeUndefined()
  })
})
