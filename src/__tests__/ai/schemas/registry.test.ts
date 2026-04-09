import { describe, it, expect } from 'vitest'
import { registerSchema, getSchema, getAllSchemaTypes, hasSchema } from '@/lib/ai/schemas/registry'
import type { ContractSchema } from '@/lib/ai/schemas/types'

describe('schema registry', () => {
  it('registers and retrieves a schema', () => {
    const mockSchema: ContractSchema = {
      contract_type: 'TEST_TYPE',
      schema_version: 'v1.0.0',
      display_name: 'Test Type',
      tool_definition: { name: 'extract_test', description: 'test', input_schema: {} },
      field_metadata: {},
      system_prompt: 'test prompt',
      user_prompt_prefix: 'test prefix',
      extraction_model: 'claude-sonnet-4-20250514',
      sanity_rules: [],
      cross_validation_rules: [],
    }

    registerSchema(mockSchema)

    expect(hasSchema('TEST_TYPE')).toBe(true)
    expect(getSchema('TEST_TYPE')).toBe(mockSchema)
    expect(getAllSchemaTypes()).toContain('TEST_TYPE')
  })

  it('returns null for unknown type', () => {
    expect(getSchema('NONEXISTENT')).toBeNull()
  })

  it('hasSchema returns false for unknown type', () => {
    expect(hasSchema('NONEXISTENT')).toBe(false)
  })
})
