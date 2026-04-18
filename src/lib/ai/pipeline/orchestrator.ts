import { createClaudeClient, computeCostUsd } from '@/lib/ai/client'
import type { ClaudeModel } from '@/lib/ai/client'
import type { ExtractionContent } from '@/lib/ai/content-loader'
import { getSchema } from '@/lib/ai/schemas/registry'
import { detectDocumentType } from './pass1-type-detection'
import { extractWithSchema } from './pass2-schema-extraction'
import { verifySourceAttribution, extractDocumentText } from './pass3-source-verification'
import { runSanityChecks } from './pass4-sanity-checks'
import { crossValidate } from './pass5-cross-validation'
import { compareRuns, computeAllFieldConfidences } from './confidence'
import type { PipelineResult, PipelineOptions, TypeDetectionResult } from './types'
import { createLogger } from '@/lib/ai/logger'

const log = createLogger('pipeline-orchestrator')

export async function runExtractionPipeline(
  content: ExtractionContent,
  options: PipelineOptions
): Promise<PipelineResult> {
  const client = createClaudeClient()
  const startTime = Date.now()

  // Pass 1: Type detection (or skip if forced_type)
  let typeResult: TypeDetectionResult
  if (options.forced_type) {
    typeResult = {
      detected_type: options.forced_type,
      confidence: 1.0,
      alternatives: [],
      model_used: 'manual',
      input_tokens: 0,
      output_tokens: 0,
    }
    log.info({ forced_type: options.forced_type }, 'Using forced type (skip Pass 1)')
  } else {
    log.info('Pass 1: Detecting document type')
    typeResult = await detectDocumentType(content, client)
  }

  // Get schema (or MINIMAL fallback)
  const schema = getSchema(typeResult.detected_type) ?? getSchema('MINIMAL')
  if (!schema) {
    throw new Error(
      `No schema found for type ${typeResult.detected_type} and MINIMAL not registered`
    )
  }
  log.info({ type: schema.contract_type, schema_version: schema.schema_version }, 'Using schema')

  // Pass 2a: First extraction run
  log.info('Pass 2a: Schema extraction (run 1, temperature=0.2)')
  const run1 = await extractWithSchema(content, schema, client, { temperature: 0.2 })

  // Pass 2b: Second run for agreement (unless skipped)
  let run2 = null
  let agreement: ReturnType<typeof compareRuns> = []
  if (!options.skip_agreement) {
    log.info('Pass 2b: Schema extraction (run 2, temperature=0.4)')
    run2 = await extractWithSchema(content, schema, client, { temperature: 0.4 })
    agreement = compareRuns(run1.fields, run2.fields)
    const agreeCount = agreement.filter((a) => a.values_match).length
    log.info({ total_fields: agreement.length, agreed: agreeCount }, 'Agreement computed')
  }

  // Pass 3: Source verification
  log.info('Pass 3: Source verification')
  const docText = extractDocumentText(content as { type: string; html?: string; markdown?: string })
  const sourceVerification = verifySourceAttribution(docText, run1.fields)

  // Pass 4: Sanity checks
  log.info('Pass 4: Sanity checks')
  const sanityChecks = runSanityChecks(run1.fields, schema.sanity_rules)

  // Pass 5: Cross-validation
  log.info('Pass 5: Cross-validation')
  const crossValidation = await crossValidate(options.document_id, run1.fields)

  // Compute confidence per field
  const fieldConfidences = computeAllFieldConfidences(
    run1.fields,
    agreement,
    sourceVerification,
    sanityChecks
  )

  // Aggregate findings and warnings
  const additional_findings = run1.additional_findings
  const extraction_warnings = run1.extraction_warnings

  // Total cost
  const totalInputTokens = typeResult.input_tokens + run1.input_tokens + (run2?.input_tokens ?? 0)
  const totalOutputTokens =
    typeResult.output_tokens + run1.output_tokens + (run2?.output_tokens ?? 0)
  const totalCost = computeCostUsd(
    schema.extraction_model as ClaudeModel,
    totalInputTokens,
    totalOutputTokens
  )

  const durationMs = Date.now() - startTime
  log.info(
    {
      type: schema.contract_type,
      total_fields: Object.keys(run1.fields).length,
      total_cost: totalCost,
      duration_ms: durationMs,
      input_tokens: totalInputTokens,
      output_tokens: totalOutputTokens,
    },
    'Pipeline complete'
  )

  return {
    type_detection: typeResult,
    extraction_run1: run1,
    extraction_run2: run2,
    agreement,
    source_verification: sourceVerification,
    sanity_checks: sanityChecks,
    cross_validation: crossValidation,
    field_confidences: fieldConfidences,
    additional_findings,
    extraction_warnings,
    total_input_tokens: totalInputTokens,
    total_output_tokens: totalOutputTokens,
    total_cost_usd: totalCost,
  }
}
