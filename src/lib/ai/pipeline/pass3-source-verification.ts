import { distance } from 'fastest-levenshtein'
import type { ExtractedField, SourceVerificationResult } from './types'
import { createLogger } from '@/lib/ai/logger'

const log = createLogger('pass3-source-verification')

const MATCH_THRESHOLD = 0.85

export function verifySourceAttribution(
  documentText: string,
  fields: Record<string, ExtractedField>,
): SourceVerificationResult[] {
  return Object.entries(fields)
    .filter(([name]) => name !== 'additional_findings' && name !== 'extraction_warnings')
    .map(([name, field]) => {
      if (!field.source_text || !documentText) {
        return { field_name: name, verified: false, match_score: 0 }
      }
      const matchScore = findBestFuzzyMatch(documentText, field.source_text)
      const verified = matchScore >= MATCH_THRESHOLD
      if (!verified) {
        log.debug({ field: name, match_score: matchScore, threshold: MATCH_THRESHOLD }, 'Source not verified')
      }
      return { field_name: name, verified, match_score: matchScore }
    })
}

export function findBestFuzzyMatch(haystack: string, needle: string): number {
  if (!needle || !haystack) return 0
  const normalizedNeedle = normalizeText(needle)
  const normalizedHaystack = normalizeText(haystack)
  if (normalizedHaystack.includes(normalizedNeedle)) return 1.0

  // Sliding window
  const windowSize = normalizedNeedle.length
  if (windowSize === 0 || windowSize > normalizedHaystack.length) return 0

  let bestScore = 0
  const step = Math.max(1, Math.floor(windowSize / 4))

  for (let i = 0; i <= normalizedHaystack.length - windowSize; i += step) {
    const window = normalizedHaystack.slice(i, i + windowSize)
    const dist = distance(window, normalizedNeedle)
    const score = 1 - (dist / Math.max(window.length, normalizedNeedle.length))
    bestScore = Math.max(bestScore, score)
    if (bestScore >= MATCH_THRESHOLD) break
  }

  return bestScore
}

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

// For PDF content, we don't have page-level text extraction yet.
// This helper extracts available text from ExtractionContent.
export function extractDocumentText(content: { type: string; html?: string; markdown?: string }): string {
  if ('html' in content && content.html) {
    return content.html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  }
  if ('markdown' in content && content.markdown) {
    return content.markdown
  }
  // PDF: no text extraction in v1 — return empty (source verification skipped)
  return ''
}
