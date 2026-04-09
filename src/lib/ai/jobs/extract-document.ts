import { prisma } from '@/lib/db'
import { isAIEnabled } from '@/lib/ai/feature-flags'
import { loadForExtraction } from '@/lib/ai/content-loader'
import { runExtractionPipeline } from '@/lib/ai/pipeline/orchestrator'
import { createLogger } from '@/lib/ai/logger'

const log = createLogger('extract-document')

export interface ExtractDocumentPayload {
  document_id: string
  organization_id: string
  file_buffer_base64: string
  filename: string
  forced_type?: string
}

export interface ExtractDocumentResult {
  extraction_id: string
  detected_type: string
  field_count: number
  total_cost_usd: number
  skipped: boolean
}

export async function extractDocument(
  payload: ExtractDocumentPayload,
): Promise<ExtractDocumentResult> {
  // Check feature flag
  const enabled = await isAIEnabled(payload.organization_id, 'extraction')
  if (!enabled) {
    log.info({ document_id: payload.document_id }, 'AI extraction disabled for org — skipping')
    return { extraction_id: '', detected_type: '', field_count: 0, total_cost_usd: 0, skipped: true }
  }

  log.info({ document_id: payload.document_id, filename: payload.filename }, 'Starting extraction')

  // Load content
  const buffer = Buffer.from(payload.file_buffer_base64, 'base64')
  const content = await loadForExtraction(buffer, payload.filename)

  // Import all schemas to ensure they're registered
  await import('@/lib/ai/schemas/ejeraftale')
  await import('@/lib/ai/schemas/minimal')
  // Plan 2 Task 13 will add: lejekontrakt, forsikring, vedtaegter, ansaettelseskontrakt, driftsaftale

  // Run pipeline
  const result = await runExtractionPipeline(content, {
    document_id: payload.document_id,
    organization_id: payload.organization_id,
    skip_agreement: false,
    forced_type: payload.forced_type,
  })

  // Determine extraction status
  const lowConfCount = result.field_confidences.filter(f => f.confidence < 0.5).length
  let extractionStatus = 'completed'
  if (lowConfCount > Object.keys(result.extraction_run1.fields).length / 2) {
    extractionStatus = 'requires_manual_review'
  }

  // Save to DB
  const extraction = await prisma.documentExtraction.upsert({
    where: { document_id: payload.document_id },
    create: {
      document_id: payload.document_id,
      organization_id: payload.organization_id,
      detected_type: result.type_detection.detected_type,
      type_confidence: result.type_detection.confidence,
      type_alternatives: result.type_detection.alternatives as never,
      schema_version: 'v1.0.0',
      prompt_version: 'v1.0.0',
      model_name: result.extraction_run1.model_used,
      model_temperature: 0.2,
      extracted_fields: result.extraction_run1.fields as never,
      extracted_fields_run2: result.extraction_run2?.fields as never ?? null,
      agreement_score: result.agreement.length > 0
        ? result.agreement.filter(a => a.values_match).length / result.agreement.length
        : null,
      source_verification: result.source_verification as never,
      sanity_check_results: result.sanity_checks as never,
      discrepancies: result.cross_validation as never,
      raw_response: result.extraction_run1.raw_response as never,
      input_tokens: result.total_input_tokens,
      output_tokens: result.total_output_tokens,
      total_cost_usd: result.total_cost_usd,
      extraction_status: extractionStatus,
    },
    update: {
      detected_type: result.type_detection.detected_type,
      type_confidence: result.type_detection.confidence,
      type_alternatives: result.type_detection.alternatives as never,
      schema_version: 'v1.0.0',
      prompt_version: 'v1.0.0',
      model_name: result.extraction_run1.model_used,
      extracted_fields: result.extraction_run1.fields as never,
      extracted_fields_run2: result.extraction_run2?.fields as never ?? null,
      agreement_score: result.agreement.length > 0
        ? result.agreement.filter(a => a.values_match).length / result.agreement.length
        : null,
      source_verification: result.source_verification as never,
      sanity_check_results: result.sanity_checks as never,
      discrepancies: result.cross_validation as never,
      raw_response: result.extraction_run1.raw_response as never,
      input_tokens: result.total_input_tokens,
      output_tokens: result.total_output_tokens,
      total_cost_usd: result.total_cost_usd,
      extraction_status: extractionStatus,
    },
  })

  log.info({
    extraction_id: extraction.id,
    type: result.type_detection.detected_type,
    fields: Object.keys(result.extraction_run1.fields).length,
    cost: result.total_cost_usd,
    status: extractionStatus,
  }, 'Extraction saved')

  return {
    extraction_id: extraction.id,
    detected_type: result.type_detection.detected_type,
    field_count: Object.keys(result.extraction_run1.fields).length,
    total_cost_usd: result.total_cost_usd,
    skipped: false,
  }
}
