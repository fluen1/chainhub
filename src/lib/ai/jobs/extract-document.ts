import { prisma } from '@/lib/db'
import { isAIEnabled } from '@/lib/ai/feature-flags'
import { checkCostCap } from '@/lib/ai/cost-cap'
import { recordAIUsage } from '@/lib/ai/usage'
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

export type ExtractDocumentStatus = 'success' | 'skipped' | 'error'

export interface ExtractDocumentResult {
  extraction_id: string
  detected_type: string
  field_count: number
  total_cost_usd: number
  skipped: boolean
  status?: ExtractDocumentStatus
  reason?: string
}

export async function extractDocument(
  payload: ExtractDocumentPayload
): Promise<ExtractDocumentResult> {
  // Check feature flag
  const enabled = await isAIEnabled(payload.organization_id, 'extraction')
  if (!enabled) {
    log.info({ document_id: payload.document_id }, 'AI extraction disabled for org — skipping')
    return {
      extraction_id: '',
      detected_type: '',
      field_count: 0,
      total_cost_usd: 0,
      skipped: true,
      status: 'skipped',
      reason: 'AI extraction ikke aktiveret for denne organisation',
    }
  }

  // Check månedlig cost-cap inden vi starter pipeline (dyrt kald)
  const capCheck = await checkCostCap(payload.organization_id)
  if (!capCheck.allowed) {
    log.warn(
      { document_id: payload.document_id, reason: capCheck.reason },
      'AI extraction blocked by cost cap'
    )
    return {
      extraction_id: '',
      detected_type: '',
      field_count: 0,
      total_cost_usd: 0,
      skipped: true,
      status: 'skipped',
      reason: capCheck.reason ?? 'Månedlig AI-cap er nået',
    }
  }

  log.info({ document_id: payload.document_id, filename: payload.filename }, 'Starting extraction')

  // Load content
  const buffer = Buffer.from(payload.file_buffer_base64, 'base64')
  const content = await loadForExtraction(buffer, payload.filename)

  // Import all schemas to ensure they're registered
  await import('@/lib/ai/schemas/ejeraftale')
  await import('@/lib/ai/schemas/lejekontrakt')
  await import('@/lib/ai/schemas/forsikring')
  await import('@/lib/ai/schemas/vedtaegter')
  await import('@/lib/ai/schemas/ansaettelseskontrakt')
  await import('@/lib/ai/schemas/driftsaftale')
  await import('@/lib/ai/schemas/minimal')

  // Run pipeline
  const result = await runExtractionPipeline(content, {
    document_id: payload.document_id,
    organization_id: payload.organization_id,
    skip_agreement: false,
    forced_type: payload.forced_type,
  })

  // Determine extraction status
  const lowConfCount = result.field_confidences.filter((f) => f.confidence < 0.5).length
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
      extracted_fields_run2: (result.extraction_run2?.fields as never) ?? null,
      agreement_score:
        result.agreement.length > 0
          ? result.agreement.filter((a) => a.values_match).length / result.agreement.length
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
      extracted_fields_run2: (result.extraction_run2?.fields as never) ?? null,
      agreement_score:
        result.agreement.length > 0
          ? result.agreement.filter((a) => a.values_match).length / result.agreement.length
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

  log.info(
    {
      extraction_id: extraction.id,
      type: result.type_detection.detected_type,
      fields: Object.keys(result.extraction_run1.fields).length,
      cost: result.total_cost_usd,
      status: extractionStatus,
    },
    'Extraction saved'
  )

  // Log AI-forbrug til AIUsageLog — non-fatal hvis DB fejler
  await recordAIUsage({
    organizationId: payload.organization_id,
    feature: 'extraction',
    model: result.extraction_run1.model_used ?? 'claude-sonnet-4-20250514',
    provider: 'anthropic',
    inputTokens: result.total_input_tokens,
    outputTokens: result.total_output_tokens,
    costUsd: result.total_cost_usd,
    resourceType: 'document',
    resourceId: payload.document_id,
  })

  return {
    extraction_id: extraction.id,
    detected_type: result.type_detection.detected_type,
    field_count: Object.keys(result.extraction_run1.fields).length,
    total_cost_usd: result.total_cost_usd,
    skipped: false,
    status: 'success',
  }
}
