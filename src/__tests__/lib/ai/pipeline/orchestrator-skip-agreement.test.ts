import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/ai/pipeline/pass1-type-detection', () => ({
  detectDocumentType: vi.fn(async () => ({
    detected_type: 'MINIMAL',
    confidence: 0.9,
    alternatives: [],
    model_used: 'claude-haiku-4-5',
    input_tokens: 100,
    output_tokens: 10,
  })),
}))

const { extractSpy } = vi.hoisted(() => ({ extractSpy: vi.fn() }))
vi.mock('@/lib/ai/pipeline/pass2-schema-extraction', () => ({
  extractWithSchema: extractSpy,
}))

vi.mock('@/lib/ai/pipeline/pass3-source-verification', () => ({
  verifySourceAttribution: () => [],
  extractDocumentText: () => '',
}))
vi.mock('@/lib/ai/pipeline/pass4-sanity-checks', () => ({ runSanityChecks: () => [] }))
vi.mock('@/lib/ai/pipeline/pass5-cross-validation', () => ({ crossValidate: async () => [] }))
vi.mock('@/lib/ai/client', () => ({
  createClaudeClient: () => ({ providerName: 'anthropic', complete: vi.fn() }),
  computeCostUsd: () => 0.01,
}))

vi.mock('@/lib/ai/schemas/registry', () => ({
  getSchema: () => ({
    contract_type: 'MINIMAL',
    schema_version: 'v1.0.0',
    display_name: 'Minimal',
    extraction_model: 'claude-sonnet-4-6',
    sanity_rules: [],
    tool_definition: {},
    field_metadata: {},
    system_prompt: 'test',
    user_prompt_prefix: 'test',
  }),
}))

vi.mock('@/lib/ai/pipeline/confidence', () => ({
  compareRuns: () => [],
  computeAllFieldConfidences: () => [],
}))

vi.mock('@/lib/ai/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}))

import { runExtractionPipeline } from '@/lib/ai/pipeline/orchestrator'

describe('orchestrator — skip_agreement default', () => {
  beforeEach(() => extractSpy.mockReset())

  it('default springer Pass 2b over når ikke eksplicit angivet', async () => {
    extractSpy.mockResolvedValue({
      fields: { party: { value: 'X', claude_confidence: 0.9, source_page: 1, source_text: 'x' } },
      additional_findings: [],
      extraction_warnings: [],
      model_used: 'claude-sonnet-4-6',
      input_tokens: 1000,
      output_tokens: 500,
      raw_response: {},
    })

    await runExtractionPipeline(
      { type: 'text_markdown', markdown: 'dok', detectedMime: 'text/markdown' },
      { document_id: 'd1' }
    )

    expect(extractSpy).toHaveBeenCalledTimes(1)
  })

  it('kører Pass 2b når Pass 2a har lav confidence', async () => {
    extractSpy.mockResolvedValue({
      fields: { party: { value: 'X', claude_confidence: 0.4, source_page: 1, source_text: 'x' } },
      additional_findings: [],
      extraction_warnings: [],
      model_used: 'claude-sonnet-4-6',
      input_tokens: 1000,
      output_tokens: 500,
      raw_response: {},
    })

    await runExtractionPipeline(
      { type: 'text_markdown', markdown: 'dok', detectedMime: 'text/markdown' },
      { document_id: 'd1' }
    )

    expect(extractSpy).toHaveBeenCalledTimes(2)
  })

  it('respekterer eksplicit skip_agreement: false (tvungen 2-run)', async () => {
    extractSpy.mockResolvedValue({
      fields: { party: { value: 'X', claude_confidence: 0.99, source_page: 1, source_text: 'x' } },
      additional_findings: [],
      extraction_warnings: [],
      model_used: 'claude-sonnet-4-6',
      input_tokens: 1000,
      output_tokens: 500,
      raw_response: {},
    })

    await runExtractionPipeline(
      { type: 'text_markdown', markdown: 'dok', detectedMime: 'text/markdown' },
      { document_id: 'd1', skip_agreement: false }
    )

    expect(extractSpy).toHaveBeenCalledTimes(2)
  })
})
