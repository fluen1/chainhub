import { describe, it, expect } from 'vitest'
import { compareRuns, valuesMatch, computeFieldConfidence, computeAllFieldConfidences } from '@/lib/ai/pipeline/confidence'
import type { ExtractedField } from '@/lib/ai/pipeline/types'

describe('valuesMatch', () => {
  it('matches identical primitives', () => {
    expect(valuesMatch('a', 'a')).toBe(true)
  })

  it('matches identical numbers', () => {
    expect(valuesMatch(42, 42)).toBe(true)
  })

  it('matches both null', () => {
    expect(valuesMatch(null, null)).toBe(true)
  })

  it('matches both undefined', () => {
    expect(valuesMatch(undefined, undefined)).toBe(true)
  })

  it('does not match null vs value', () => {
    expect(valuesMatch(null, 'a')).toBe(false)
  })

  it('matches null vs undefined (both falsy)', () => {
    // The implementation uses `== null` which matches both null and undefined
    expect(valuesMatch(null, undefined)).toBe(true)
  })

  it('matches identical objects', () => {
    expect(valuesMatch({ a: 1 }, { a: 1 })).toBe(true)
  })

  it('does not match different objects', () => {
    expect(valuesMatch({ a: 1 }, { a: 2 })).toBe(false)
  })

  it('matches identical arrays', () => {
    expect(valuesMatch([1, 2, 3], [1, 2, 3])).toBe(true)
  })

  it('does not match arrays with different order', () => {
    expect(valuesMatch([1, 2, 3], [3, 2, 1])).toBe(false)
  })

  it('matches deeply nested structures', () => {
    const obj1 = { a: { b: { c: 1 } } }
    const obj2 = { a: { b: { c: 1 } } }
    expect(valuesMatch(obj1, obj2)).toBe(true)
  })
})

describe('compareRuns', () => {
  it('compares matching fields', () => {
    const run1: Record<string, ExtractedField> = {
      name: { value: 'Test', claude_confidence: 0.9, source_page: 1, source_text: 'Test' },
    }
    const run2: Record<string, ExtractedField> = {
      name: { value: 'Test', claude_confidence: 0.85, source_page: 1, source_text: 'Test' },
    }
    const result = compareRuns(run1, run2)
    expect(result).toHaveLength(1)
    expect(result[0].field_name).toBe('name')
    expect(result[0].values_match).toBe(true)
  })

  it('detects disagreement', () => {
    const run1: Record<string, ExtractedField> = {
      name: { value: 'A', claude_confidence: 0.9, source_page: 1, source_text: null },
    }
    const run2: Record<string, ExtractedField> = {
      name: { value: 'B', claude_confidence: 0.8, source_page: 1, source_text: null },
    }
    const result = compareRuns(run1, run2)
    expect(result).toHaveLength(1)
    expect(result[0].values_match).toBe(false)
  })

  it('skips additional_findings and extraction_warnings', () => {
    const run1: Record<string, ExtractedField> = {
      name: { value: 'Test', claude_confidence: 0.9, source_page: 1, source_text: null },
      additional_findings: { value: [], claude_confidence: 1, source_page: null, source_text: null },
      extraction_warnings: { value: [], claude_confidence: 1, source_page: null, source_text: null },
    }
    const result = compareRuns(run1, run1)
    expect(result).toHaveLength(1)
    expect(result[0].field_name).toBe('name')
  })

  it('handles fields present in only one run', () => {
    const run1: Record<string, ExtractedField> = {
      name: { value: 'Test', claude_confidence: 0.9, source_page: 1, source_text: null },
      phone: { value: '123456', claude_confidence: 0.8, source_page: 2, source_text: null },
    }
    const run2: Record<string, ExtractedField> = {
      name: { value: 'Test', claude_confidence: 0.85, source_page: 1, source_text: null },
    }
    const result = compareRuns(run1, run2)
    expect(result).toHaveLength(2)
    const phoneResult = result.find(r => r.field_name === 'phone')
    expect(phoneResult).toBeDefined()
    expect(phoneResult?.run1_value).toBe('123456')
    expect(phoneResult?.run2_value).toBeNull()
  })

  it('handles null values correctly', () => {
    const run1: Record<string, ExtractedField> = {
      name: { value: null, claude_confidence: 0.5, source_page: null, source_text: null },
    }
    const run2: Record<string, ExtractedField> = {
      name: { value: null, claude_confidence: 0.5, source_page: null, source_text: null },
    }
    const result = compareRuns(run1, run2)
    expect(result[0].values_match).toBe(true)
  })
})

describe('computeFieldConfidence', () => {
  it('returns ~1.0 for full agreement + verified + sanity + high claude', () => {
    const result = computeFieldConfidence(
      'test',
      { field_name: 'test', run1_value: 'x', run2_value: 'x', values_match: true },
      { field_name: 'test', verified: true, match_score: 0.95 },
      { field_name: 'test', passed: true, rule: 'test' },
      0.95,
    )
    expect(result.confidence).toBeGreaterThanOrEqual(0.95)
    expect(result.confidence).toBeLessThanOrEqual(1.0)
  })

  it('returns ~0.5 for no agreement but verified + sanity passed', () => {
    const result = computeFieldConfidence(
      'test',
      { field_name: 'test', run1_value: 'x', run2_value: 'y', values_match: false },
      { field_name: 'test', verified: true, match_score: 0.9 },
      { field_name: 'test', passed: true, rule: 'test' },
      0.5,
    )
    expect(result.confidence).toBeGreaterThan(0.5)
    expect(result.confidence).toBeLessThan(0.7)
  })

  it('returns ~0.05 for all failed', () => {
    const result = computeFieldConfidence(
      'test',
      { field_name: 'test', run1_value: 'x', run2_value: 'y', values_match: false },
      { field_name: 'test', verified: false, match_score: 0.1 },
      { field_name: 'test', passed: false, rule: 'test', message: 'failed' },
      0.5,
    )
    expect(result.confidence).toBeLessThan(0.1)
  })

  it('grants sanity points when no sanity rule exists', () => {
    const result = computeFieldConfidence(
      'test',
      { field_name: 'test', run1_value: 'x', run2_value: 'x', values_match: true },
      undefined,
      undefined, // no sanity rule
      0.8,
    )
    expect(result.components.sanity_passed).toBe(0.2)
    expect(result.confidence).toBeCloseTo(0.68, 2)
  })

  it('caps confidence at 1.0', () => {
    const result = computeFieldConfidence(
      'test',
      { field_name: 'test', run1_value: 'x', run2_value: 'x', values_match: true },
      { field_name: 'test', verified: true, match_score: 1.0 },
      { field_name: 'test', passed: true, rule: 'test' },
      1.0, // This would sum to 1.0 + 0.1 = 1.1 without cap
    )
    expect(result.confidence).toBeCloseTo(1.0, 5)
  })

  it('handles missing agreement result', () => {
    const result = computeFieldConfidence(
      'test',
      undefined, // no agreement
      { field_name: 'test', verified: true, match_score: 0.9 },
      { field_name: 'test', passed: true, rule: 'test' },
      0.8,
    )
    expect(result.components.agreement).toBe(0)
    expect(result.confidence).toBeCloseTo(0.58, 2)
  })

  it('handles sanity check failure', () => {
    const result = computeFieldConfidence(
      'test',
      { field_name: 'test', run1_value: 'x', run2_value: 'x', values_match: true },
      { field_name: 'test', verified: true, match_score: 0.9 },
      { field_name: 'test', passed: false, rule: 'test', message: 'sanity failed' },
      0.8,
    )
    expect(result.components.sanity_passed).toBe(0)
    expect(result.confidence).toBeCloseTo(0.78, 2)
  })

  it('clamps claude_confidence to 0-1 range', () => {
    const result = computeFieldConfidence(
      'test',
      undefined,
      undefined,
      undefined,
      1.5, // Out of range
    )
    expect(result.components.claude_self).toBe(0.1) // 0.1 * min(1.5, 1.0) = 0.1 * 1.0
  })
})

describe('computeAllFieldConfidences', () => {
  it('computes confidences for all fields', () => {
    const fields: Record<string, ExtractedField> = {
      name: { value: 'Test', claude_confidence: 0.9, source_page: 1, source_text: null },
      phone: { value: '123456', claude_confidence: 0.8, source_page: 2, source_text: null },
    }
    const agreements = [
      { field_name: 'name', run1_value: 'Test', run2_value: 'Test', values_match: true },
      { field_name: 'phone', run1_value: '123456', run2_value: '123456', values_match: true },
    ]
    const result = computeAllFieldConfidences(fields, agreements, [], [])
    expect(result).toHaveLength(2)
    expect(result[0].field_name).toBe('name')
    expect(result[1].field_name).toBe('phone')
  })

  it('skips meta-fields', () => {
    const fields: Record<string, ExtractedField> = {
      name: { value: 'Test', claude_confidence: 0.9, source_page: 1, source_text: null },
      additional_findings: { value: [], claude_confidence: 1, source_page: null, source_text: null },
    }
    const result = computeAllFieldConfidences(fields, [], [], [])
    expect(result).toHaveLength(1)
    expect(result[0].field_name).toBe('name')
  })

  it('handles empty fields', () => {
    const result = computeAllFieldConfidences({}, [], [], [])
    expect(result).toHaveLength(0)
  })

  it('matches fields across all signals', () => {
    const fields: Record<string, ExtractedField> = {
      name: { value: 'Test', claude_confidence: 0.85, source_page: 1, source_text: null },
    }
    const agreements = [
      { field_name: 'name', run1_value: 'Test', run2_value: 'Test', values_match: true },
    ]
    const sourceVerifications = [
      { field_name: 'name', verified: true, match_score: 0.95 },
    ]
    const sanityChecks = [
      { field_name: 'name', passed: true, rule: 'name_length' },
    ]
    const result = computeAllFieldConfidences(fields, agreements, sourceVerifications, sanityChecks)
    expect(result).toHaveLength(1)
    expect(result[0].confidence).toBeGreaterThanOrEqual(0.95)
  })

  it('handles partial signal coverage', () => {
    const fields: Record<string, ExtractedField> = {
      name: { value: 'Test', claude_confidence: 0.9, source_page: 1, source_text: null },
      phone: { value: '123456', claude_confidence: 0.8, source_page: null, source_text: null },
    }
    const agreements = [
      { field_name: 'name', run1_value: 'Test', run2_value: 'Test', values_match: true },
      // phone has no agreement result
    ]
    const result = computeAllFieldConfidences(fields, agreements, [], [])
    expect(result).toHaveLength(2)
    expect(result[0].confidence).toBeGreaterThan(result[1].confidence) // name should have higher confidence
  })
})
