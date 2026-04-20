import { describe, it, expect } from 'vitest'
import { registerSchema, getSchema, getAllSchemaTypes, hasSchema } from '@/lib/ai/schemas/registry'
import type { ContractSchema } from '@/lib/ai/schemas/types'

describe('schema registry', () => {
  it('all 7 schemas are registered', async () => {
    await import('@/lib/ai/schemas/ejeraftale')
    await import('@/lib/ai/schemas/lejekontrakt')
    await import('@/lib/ai/schemas/forsikring')
    await import('@/lib/ai/schemas/vedtaegter')
    await import('@/lib/ai/schemas/ansaettelseskontrakt')
    await import('@/lib/ai/schemas/driftsaftale')
    await import('@/lib/ai/schemas/minimal')

    const types = getAllSchemaTypes()
    expect(types).toContain('EJERAFTALE')
    expect(types).toContain('LEJEKONTRAKT')
    expect(types).toContain('FORSIKRING')
    expect(types).toContain('VEDTAEGTER')
    expect(types).toContain('ANSAETTELSESKONTRAKT')
    expect(types).toContain('DRIFTSAFTALE')
    expect(types).toContain('MINIMAL')
    expect(types.length).toBeGreaterThanOrEqual(7)
  })

  it('registers and retrieves a schema', () => {
    const mockSchema: ContractSchema = {
      contract_type: 'TEST_TYPE',
      schema_version: 'v1.0.0',
      display_name: 'Test Type',
      tool_definition: { name: 'extract_test', description: 'test', input_schema: {} },
      field_metadata: {},
      system_prompt: 'test prompt',
      user_prompt_prefix: 'test prefix',
      extraction_model: 'claude-sonnet-4-6',
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
