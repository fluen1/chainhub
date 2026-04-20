import { describe, it, expect, vi } from 'vitest'
import { extractWithSchema } from '@/lib/ai/pipeline/pass2-schema-extraction'
import type { ContractSchema } from '@/lib/ai/schemas/types'
import type { ClaudeClient, ClaudeRequest, ClaudeResponse } from '@/lib/ai/client/types'

const fakeSchema = {
  contract_type: 'MINIMAL',
  schema_version: 'v1',
  display_name: 'Test',
  tool_definition: {
    name: 'extract_test',
    description: 'test',
    input_schema: { type: 'object', properties: {} },
  },
  extraction_model: 'claude-sonnet-4-6',
  system_prompt: 'test system',
  user_prompt_prefix: 'test prefix',
  field_metadata: {},
  sanity_rules: [],
} as unknown as ContractSchema

describe('Pass 2 — prompt-caching', () => {
  it('tilføjer cache_control til tool_definition ved kald', async () => {
    const capturedRequests: ClaudeRequest[] = []
    const fakeClient: ClaudeClient = {
      providerName: 'anthropic',
      complete: vi.fn(async (req: ClaudeRequest): Promise<ClaudeResponse> => {
        capturedRequests.push(req)
        return {
          id: 'msg_1',
          model: 'claude-sonnet-4-6',
          stop_reason: 'tool_use',
          content: [{ type: 'tool_use', id: 't1', name: 'extract_test', input: {} }],
          usage: { input_tokens: 100, output_tokens: 50 },
        }
      }),
    }

    await extractWithSchema(
      { type: 'text_markdown', markdown: 'test', detectedMime: 'text/markdown' },
      fakeSchema,
      fakeClient
    )

    expect(capturedRequests).toHaveLength(1)
    const tools = capturedRequests[0].tools!
    expect(tools[0].cache_control).toEqual({ type: 'ephemeral' })
  })
})
