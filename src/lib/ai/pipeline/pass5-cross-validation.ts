import type { CrossValidationResult } from './types'
import { createLogger } from '@/lib/ai/logger'

const log = createLogger('pass5-cross-validation')

// v1: Stub implementation. Full cross-validation requires human-verified data provenance
// tracking which will be added when the review UI is wired to real data.
export async function crossValidate(
  documentId: string,
  extractedFields: Record<string, { value: unknown }>,
): Promise<CrossValidationResult[]> {
  log.debug({ document_id: documentId, field_count: Object.keys(extractedFields).length }, 'Cross-validation (stub)')
  // Return empty — no cross-validation in v1 until data provenance tracking is implemented
  return []
}
