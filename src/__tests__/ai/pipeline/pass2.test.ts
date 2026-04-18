import { describe, it, expect, vi } from 'vitest'
import { extractWithSchema } from '@/lib/ai/pipeline/pass2-schema-extraction'
import type { ClaudeClient } from '@/lib/ai/client/types'
import type { ContractSchema } from '@/lib/ai/schemas/types'
import type { ExtractionContent } from '@/lib/ai/content-loader'

const mockSchema: ContractSchema = {
  contract_type: 'TEST',
  schema_version: 'v1',
  display_name: 'Test',
  tool_definition: {
    name: 'extract_test',
    description: 'Test extraction',
    input_schema: {
      type: 'object',
      properties: {
        company_name: {
          type: 'object',
          properties: {
            value: { type: 'string' },
            claude_confidence: { type: 'number' },
            source_page: { type: 'number' },
            source_text: { type: 'string' },
          },
        },
      },
    },
  },
  field_metadata: {
    company_name: { legal_critical: true, required: true, description: 'Company name' },
  },
  system_prompt: 'Test prompt',
  user_prompt_prefix: 'Extract fields.',
  extraction_model: 'claude-sonnet-4-20250514',
  sanity_rules: [],
  cross_validation_rules: [],
}

const testContent: ExtractionContent = {
  type: 'text_html',
  html: '<p>Test document</p>',
  detectedMime: 'text/html',
}

describe('Pass 2: Schema extraction', () => {
  it('extracts fields from tool_use response', async () => {
    const client: ClaudeClient = {
      providerName: 'anthropic',
      complete: vi.fn().mockResolvedValue({
        id: 'msg_1',
        model: 'claude-sonnet-4-20250514',
        stop_reason: 'tool_use',
        content: [
          {
            type: 'tool_use',
            id: 'tu_1',
            name: 'extract_test',
            input: {
              company_name: {
                value: 'Test ApS',
                claude_confidence: 0.95,
                source_page: 1,
                source_text: 'Test ApS',
              },
              additional_findings: [],
              extraction_warnings: [],
            },
          },
        ],
        usage: { input_tokens: 1000, output_tokens: 200 },
      }),
    }

    const result = await extractWithSchema(testContent, mockSchema, client)

    expect(result.fields.company_name.value).toBe('Test ApS')
    expect(result.fields.company_name.claude_confidence).toBe(0.95)
    expect(result.fields.company_name.source_page).toBe(1)
    expect(result.input_tokens).toBe(1000)
    expect(result.output_tokens).toBe(200)
  })

  it('handles missing tool_use gracefully', async () => {
    const client: ClaudeClient = {
      providerName: 'anthropic',
      complete: vi.fn().mockResolvedValue({
        id: 'msg_1',
        model: 'claude-sonnet-4-20250514',
        stop_reason: 'end_turn',
        content: [{ type: 'text', text: 'Could not extract.' }],
        usage: { input_tokens: 100, output_tokens: 20 },
      }),
    }

    const result = await extractWithSchema(testContent, mockSchema, client)

    expect(Object.keys(result.fields)).toHaveLength(0)
    expect(result.extraction_warnings).toHaveLength(1)
  })

  it('handles unwrapped field values (fallback)', async () => {
    const client: ClaudeClient = {
      providerName: 'anthropic',
      complete: vi.fn().mockResolvedValue({
        id: 'msg_1',
        model: 'claude-sonnet-4-20250514',
        stop_reason: 'tool_use',
        content: [
          {
            type: 'tool_use',
            id: 'tu_1',
            name: 'extract_test',
            input: {
              company_name: 'Direct Value',
              additional_findings: [],
              extraction_warnings: [],
            },
          },
        ],
        usage: { input_tokens: 100, output_tokens: 50 },
      }),
    }

    const result = await extractWithSchema(testContent, mockSchema, client)
    expect(result.fields.company_name.value).toBe('Direct Value')
    expect(result.fields.company_name.claude_confidence).toBe(0.5)
  })

  it('passes temperature option to Claude', async () => {
    const completeFn = vi.fn().mockResolvedValue({
      id: 'msg_1',
      model: 'claude-sonnet-4-20250514',
      stop_reason: 'tool_use',
      content: [
        {
          type: 'tool_use',
          id: 'tu_1',
          name: 'extract_test',
          input: {
            company_name: { value: 'X', claude_confidence: 0.9, source_page: 1, source_text: 'X' },
            additional_findings: [],
            extraction_warnings: [],
          },
        },
      ],
      usage: { input_tokens: 100, output_tokens: 50 },
    })
    const client: ClaudeClient = { providerName: 'anthropic', complete: completeFn }

    await extractWithSchema(testContent, mockSchema, client, { temperature: 0.4 })
    expect(completeFn).toHaveBeenCalledWith(expect.objectContaining({ temperature: 0.4 }))
  })

  it('sætter null-felter for felter ikke returneret af Claude', async () => {
    const client: ClaudeClient = {
      providerName: 'anthropic',
      complete: vi.fn().mockResolvedValue({
        id: 'msg_1',
        model: 'claude-sonnet-4-20250514',
        stop_reason: 'tool_use',
        content: [
          {
            type: 'tool_use',
            id: 'tu_1',
            name: 'extract_test',
            // company_name mangler i output
            input: { additional_findings: [], extraction_warnings: [] },
          },
        ],
        usage: { input_tokens: 100, output_tokens: 30 },
      }),
    }

    const result = await extractWithSchema(testContent, mockSchema, client)
    expect(result.fields.company_name.value).toBeNull()
    expect(result.fields.company_name.claude_confidence).toBe(0)
    expect(result.fields.company_name.source_page).toBeNull()
  })

  it('sender korrekt tool_choice til Claude', async () => {
    const completeFn = vi.fn().mockResolvedValue({
      id: 'msg_1',
      model: 'claude-sonnet-4-20250514',
      stop_reason: 'tool_use',
      content: [
        {
          type: 'tool_use',
          id: 'tu_1',
          name: 'extract_test',
          input: { additional_findings: [], extraction_warnings: [] },
        },
      ],
      usage: { input_tokens: 100, output_tokens: 30 },
    })
    const client: ClaudeClient = { providerName: 'anthropic', complete: completeFn }

    await extractWithSchema(testContent, mockSchema, client)
    expect(completeFn).toHaveBeenCalledWith(
      expect.objectContaining({
        tool_choice: { type: 'tool', name: 'extract_test' },
      })
    )
  })

  it('inkluderer additional_findings og extraction_warnings fra svar', async () => {
    const client: ClaudeClient = {
      providerName: 'anthropic',
      complete: vi.fn().mockResolvedValue({
        id: 'msg_1',
        model: 'claude-sonnet-4-20250514',
        stop_reason: 'tool_use',
        content: [
          {
            type: 'tool_use',
            id: 'tu_1',
            name: 'extract_test',
            input: {
              company_name: {
                value: 'Test ApS',
                claude_confidence: 0.9,
                source_page: 1,
                source_text: 'Test ApS',
              },
              additional_findings: [
                { finding: 'Usædvanlig klausul fundet', source_page: 3, importance: 'critical' },
              ],
              extraction_warnings: [{ warning: 'Lav billedkvalitet på side 2', severity: 'low' }],
            },
          },
        ],
        usage: { input_tokens: 500, output_tokens: 100 },
      }),
    }

    const result = await extractWithSchema(testContent, mockSchema, client)
    expect(result.additional_findings).toHaveLength(1)
    expect(result.additional_findings[0].finding).toBe('Usædvanlig klausul fundet')
    expect(result.extraction_warnings).toHaveLength(1)
    expect(result.extraction_warnings[0].severity).toBe('low')
  })
})
