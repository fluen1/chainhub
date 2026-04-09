import type { ExtractedField, AgreementResult, SourceVerificationResult, SanityCheckResult, FieldConfidence } from './types'

/**
 * Compares extraction results from two runs to detect field-level agreement.
 * Skips meta-fields like additional_findings and extraction_warnings.
 */
export function compareRuns(
  run1: Record<string, ExtractedField>,
  run2: Record<string, ExtractedField>,
): AgreementResult[] {
  const results: AgreementResult[] = []
  const allFields = Array.from(new Set([...Object.keys(run1), ...Object.keys(run2)]))

  for (const fieldName of allFields) {
    if (fieldName === 'additional_findings' || fieldName === 'extraction_warnings') continue
    const v1 = run1[fieldName]
    const v2 = run2[fieldName]
    results.push({
      field_name: fieldName,
      run1_value: v1?.value ?? null,
      run2_value: v2?.value ?? null,
      values_match: valuesMatch(v1?.value, v2?.value),
    })
  }
  return results
}

/**
 * Compares two values for deep equality.
 * Handles null, primitives, and objects.
 */
export function valuesMatch(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (a == null && b == null) return true
  if (a == null || b == null) return false
  return JSON.stringify(a) === JSON.stringify(b)
}

/**
 * Computes confidence for a single field using weighted components:
 * - Agreement: 40% (if both runs extract the same value)
 * - Source verification: 30% (if value is sourced from document)
 * - Sanity check: 20% (if value passes validation rules)
 * - Claude self-confidence: 10% (Claude's own confidence score)
 */
export function computeFieldConfidence(
  fieldName: string,
  agreement: AgreementResult | undefined,
  sourceVerification: SourceVerificationResult | undefined,
  sanityCheck: SanityCheckResult | undefined,
  claudeConfidence: number,
): FieldConfidence {
  let confidence = 0
  const components = { agreement: 0, source_verified: 0, sanity_passed: 0, claude_self: 0 }

  // Agreement (40%)
  if (agreement?.values_match) {
    components.agreement = 0.4
    confidence += 0.4
  }

  // Source verification (30%)
  if (sourceVerification?.verified) {
    components.source_verified = 0.3
    confidence += 0.3
  }

  // Sanity check (20%)
  // Award points if either: sanity check passed, OR no sanity rule exists for this field
  if (sanityCheck === undefined || sanityCheck.passed) {
    components.sanity_passed = 0.2
    confidence += 0.2
  }

  // Claude self-confidence (10%)
  components.claude_self = 0.1 * Math.min(claudeConfidence, 1.0)
  confidence += components.claude_self

  return {
    field_name: fieldName,
    confidence: Math.min(1.0, confidence),
    components,
  }
}

/**
 * Computes confidence scores for all fields in an extraction result.
 * Combines agreement, source verification, sanity checks, and Claude's self-confidence.
 */
export function computeAllFieldConfidences(
  fields: Record<string, ExtractedField>,
  agreements: AgreementResult[],
  sourceVerifications: SourceVerificationResult[],
  sanityChecks: SanityCheckResult[],
): FieldConfidence[] {
  return Object.entries(fields)
    .filter(([name]) => name !== 'additional_findings' && name !== 'extraction_warnings')
    .map(([name, field]) => {
      const agreement = agreements.find(a => a.field_name === name)
      const source = sourceVerifications.find(s => s.field_name === name)
      const sanity = sanityChecks.find(s => s.field_name === name)
      return computeFieldConfidence(name, agreement, source, sanity, field.claude_confidence)
    })
}
