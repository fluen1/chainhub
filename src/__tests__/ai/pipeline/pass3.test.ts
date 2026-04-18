import { describe, it, expect } from 'vitest'
import {
  verifySourceAttribution,
  findBestFuzzyMatch,
  extractDocumentText,
} from '@/lib/ai/pipeline/pass3-source-verification'
import type { ExtractedField } from '@/lib/ai/pipeline/types'

describe('Pass 3: Source verification', () => {
  describe('findBestFuzzyMatch', () => {
    it('returns 1.0 for exact match', () => {
      const score = findBestFuzzyMatch(
        'Dette er en kontrakt indgået mellem parterne.',
        'kontrakt indgået mellem parterne'
      )
      expect(score).toBe(1.0)
    })

    it('returns 1.0 for exact match with case difference', () => {
      const score = findBestFuzzyMatch(
        'KONTRAKT INDGÅET MELLEM PARTERNE',
        'kontrakt indgået mellem parterne'
      )
      expect(score).toBe(1.0)
    })

    it('returns 1.0 for match with extra whitespace', () => {
      const score = findBestFuzzyMatch(
        'kontrakt  indgået   mellem  parterne',
        'kontrakt indgået mellem parterne'
      )
      expect(score).toBe(1.0)
    })

    it('returns high score for close match above threshold', () => {
      // One character difference in a long string — should be above 0.85
      const score = findBestFuzzyMatch(
        'Dette er en lang kontrakt tekst med mange ord i dokumentet.',
        'lang kontrakt tekst med mange ord'
      )
      expect(score).toBeGreaterThanOrEqual(0.85)
    })

    it('returns low score for poor match below threshold', () => {
      const score = findBestFuzzyMatch('Dette er en juridisk aftale.', 'xyzqwerty foobar baz')
      expect(score).toBeLessThan(0.85)
    })

    it('returns 0 for empty needle', () => {
      const score = findBestFuzzyMatch('Some document text', '')
      expect(score).toBe(0)
    })

    it('returns 0 for empty haystack', () => {
      const score = findBestFuzzyMatch('', 'some text')
      expect(score).toBe(0)
    })

    it('returns 0 when needle is longer than haystack', () => {
      const score = findBestFuzzyMatch('short', 'this is a much longer needle text')
      expect(score).toBe(0)
    })
  })

  describe('verifySourceAttribution', () => {
    const documentText =
      'Aftalen er indgået den 1. januar 2024 mellem Tandlæge ApS og ChainGroup A/S.'

    it('verifies field with exact source_text match', () => {
      const fields: Record<string, ExtractedField> = {
        effective_date: {
          value: '2024-01-01',
          claude_confidence: 0.95,
          source_page: 1,
          source_text: '1. januar 2024',
        },
      }
      const results = verifySourceAttribution(documentText, fields)
      expect(results).toHaveLength(1)
      expect(results[0].field_name).toBe('effective_date')
      expect(results[0].verified).toBe(true)
      expect(results[0].match_score).toBe(1.0)
    })

    it('does not verify field with poor source_text match', () => {
      const fields: Record<string, ExtractedField> = {
        company_name: {
          value: 'Forkert ApS',
          claude_confidence: 0.5,
          source_page: 1,
          source_text: 'xyzqwerty hallucinated text not in document',
        },
      }
      const results = verifySourceAttribution(documentText, fields)
      expect(results[0].verified).toBe(false)
      expect(results[0].match_score).toBeLessThan(0.85)
    })

    it('returns not verified when source_text is null', () => {
      const fields: Record<string, ExtractedField> = {
        parties: {
          value: ['Tandlæge ApS'],
          claude_confidence: 0.8,
          source_page: 1,
          source_text: null,
        },
      }
      const results = verifySourceAttribution(documentText, fields)
      expect(results[0].verified).toBe(false)
      expect(results[0].match_score).toBe(0)
    })

    it('returns not verified when document text is empty', () => {
      const fields: Record<string, ExtractedField> = {
        summary: {
          value: 'En aftale',
          claude_confidence: 0.9,
          source_page: 1,
          source_text: 'En aftale',
        },
      }
      const results = verifySourceAttribution('', fields)
      expect(results[0].verified).toBe(false)
      expect(results[0].match_score).toBe(0)
    })

    it('filters out additional_findings and extraction_warnings fields', () => {
      const fields: Record<string, ExtractedField> = {
        additional_findings: {
          value: [],
          claude_confidence: 1,
          source_page: null,
          source_text: null,
        },
        extraction_warnings: {
          value: [],
          claude_confidence: 1,
          source_page: null,
          source_text: null,
        },
        effective_date: {
          value: '2024-01-01',
          claude_confidence: 0.95,
          source_page: 1,
          source_text: '1. januar 2024',
        },
      }
      const results = verifySourceAttribution(documentText, fields)
      const names = results.map((r) => r.field_name)
      expect(names).not.toContain('additional_findings')
      expect(names).not.toContain('extraction_warnings')
      expect(names).toContain('effective_date')
    })

    it('handles multiple fields correctly', () => {
      const fields: Record<string, ExtractedField> = {
        effective_date: {
          value: '2024-01-01',
          claude_confidence: 0.95,
          source_page: 1,
          source_text: '1. januar 2024',
        },
        party1: {
          value: 'Tandlæge ApS',
          claude_confidence: 0.9,
          source_page: 1,
          source_text: 'Tandlæge ApS',
        },
      }
      const results = verifySourceAttribution(documentText, fields)
      expect(results).toHaveLength(2)
      expect(results.every((r) => r.verified)).toBe(true)
    })
  })

  describe('extractDocumentText', () => {
    it('strips HTML tags from html content', () => {
      const text = extractDocumentText({
        type: 'text_html',
        html: '<p>Aftalen er <strong>indgået</strong> den 1. januar.</p>',
      })
      expect(text).toBe('Aftalen er indgået den 1. januar.')
      expect(text).not.toContain('<')
    })

    it('returns markdown as-is', () => {
      const text = extractDocumentText({
        type: 'text_markdown',
        markdown: '# Kontrakt\n\nAftalen er indgået.',
      })
      expect(text).toBe('# Kontrakt\n\nAftalen er indgået.')
    })

    it('returns empty string for PDF content (no text extraction in v1)', () => {
      const text = extractDocumentText({ type: 'pdf_pages' })
      expect(text).toBe('')
    })

    it('prefers html over markdown when both are present', () => {
      const text = extractDocumentText({
        type: 'text_html',
        html: '<p>HTML indhold</p>',
        markdown: '# Markdown indhold',
      })
      expect(text).toBe('HTML indhold')
    })
  })
})
