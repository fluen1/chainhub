import { describe, it, expect } from 'vitest'
import { runSanityChecks } from '@/lib/ai/pipeline/pass4-sanity-checks'
import type { SanityRule } from '@/lib/ai/schemas/types'
import type { ExtractedField } from '@/lib/ai/pipeline/types'

// Eksempel-regler til test
const ownershipRule: SanityRule = {
  field: 'ownership_percentage',
  check: (value) => {
    if (value === null || value === undefined) return true
    return typeof value === 'number' && value > 0 && value <= 100
  },
  message: 'Ejerandel skal være mellem 0 og 100',
}

const dateNotInPastRule: SanityRule = {
  field: 'effective_date',
  check: (value) => {
    if (!value || typeof value !== 'string') return true
    const date = new Date(value)
    return !isNaN(date.getTime())
  },
  message: 'Ikrafttrædelsesdato skal være en gyldig dato',
}

const crossFieldRule: SanityRule = {
  field: 'exit_date',
  check: (value, allFields) => {
    if (!value || !allFields['effective_date']) return true
    return new Date(value as string) > new Date(allFields['effective_date'] as string)
  },
  message: 'Exitdato skal være efter ikrafttrædelsesdato',
}

function makeField(value: unknown, confidence = 0.9): ExtractedField {
  return { value, claude_confidence: confidence, source_page: 1, source_text: null }
}

describe('Pass 4: Sanity checks', () => {
  it('passes valid ownership percentage', () => {
    const fields = { ownership_percentage: makeField(51) }
    const results = runSanityChecks(fields, [ownershipRule])
    expect(results).toHaveLength(1)
    expect(results[0].passed).toBe(true)
    expect(results[0].message).toBeUndefined()
  })

  it('fails ownership percentage over 100', () => {
    const fields = { ownership_percentage: makeField(150) }
    const results = runSanityChecks(fields, [ownershipRule])
    expect(results[0].passed).toBe(false)
    expect(results[0].message).toBe('Ejerandel skal være mellem 0 og 100')
    expect(results[0].rule).toBe('Ejerandel skal være mellem 0 og 100')
  })

  it('fails ownership percentage of 0', () => {
    const fields = { ownership_percentage: makeField(0) }
    const results = runSanityChecks(fields, [ownershipRule])
    expect(results[0].passed).toBe(false)
  })

  it('passes when field value is null (optional field)', () => {
    const fields = { ownership_percentage: makeField(null) }
    const results = runSanityChecks(fields, [ownershipRule])
    expect(results[0].passed).toBe(true)
  })

  it('passes when field is missing from extraction result', () => {
    // Felt findes ikke i fields — sanity check skal passere (ikke blokere)
    const fields: Record<string, ExtractedField> = {}
    const results = runSanityChecks(fields, [ownershipRule])
    expect(results[0].passed).toBe(true)
  })

  it('passes valid ISO date string', () => {
    const fields = { effective_date: makeField('2024-01-15') }
    const results = runSanityChecks(fields, [dateNotInPastRule])
    expect(results[0].passed).toBe(true)
  })

  it('fails invalid date string', () => {
    const fields = { effective_date: makeField('ikke-en-dato') }
    const results = runSanityChecks(fields, [dateNotInPastRule])
    expect(results[0].passed).toBe(false)
  })

  it('runs cross-field validation correctly', () => {
    const fields = {
      effective_date: makeField('2024-01-01'),
      exit_date: makeField('2029-12-31'),
    }
    const results = runSanityChecks(fields, [crossFieldRule])
    expect(results[0].passed).toBe(true)
  })

  it('fails cross-field rule when exit date is before effective date', () => {
    const fields = {
      effective_date: makeField('2024-01-01'),
      exit_date: makeField('2020-01-01'),
    }
    const results = runSanityChecks(fields, [crossFieldRule])
    expect(results[0].passed).toBe(false)
    expect(results[0].message).toBe('Exitdato skal være efter ikrafttrædelsesdato')
  })

  it('returns results for all rules', () => {
    const fields = {
      ownership_percentage: makeField(51),
      effective_date: makeField('2024-01-01'),
    }
    const results = runSanityChecks(fields, [ownershipRule, dateNotInPastRule])
    expect(results).toHaveLength(2)
    expect(results.every((r) => r.passed)).toBe(true)
  })

  it('returns empty array when no rules provided', () => {
    const fields = { some_field: makeField('value') }
    const results = runSanityChecks(fields, [])
    expect(results).toHaveLength(0)
  })

  it('extracts values from all fields for cross-field checks', () => {
    // Tjek at extractValues sender alle felters værdier videre
    let capturedAllFields: Record<string, unknown> = {}
    const capturingRule: SanityRule = {
      field: 'field_a',
      check: (value, allFields) => {
        capturedAllFields = allFields
        return true
      },
      message: 'test',
    }
    const fields = {
      field_a: makeField('a'),
      field_b: makeField('b'),
      field_c: makeField(42),
    }
    runSanityChecks(fields, [capturingRule])
    expect(capturedAllFields['field_a']).toBe('a')
    expect(capturedAllFields['field_b']).toBe('b')
    expect(capturedAllFields['field_c']).toBe(42)
  })
})
