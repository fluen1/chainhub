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
import type {
  PipelineResult,
  PipelineOptions,
  TypeDetectionResult,
  SchemaExtractionResult,
} from './types'
import { createLogger } from '@/lib/ai/logger'

const log = createLogger('pipeline-orchestrator')

/**
 * Fjerner raw_response før checkpoint-persistering. Anthropic SDK kan returnere
 * objekter med circular refs / non-serializable felter der fejler ved JSON.stringify
 * når Prisma persisterer til JSONB. Feltet er kun logging-data, så det er sikkert
 * at droppe i checkpointet.
 */
function stripRawResponse(r: SchemaExtractionResult): SchemaExtractionResult {
  return { ...r, raw_response: null }
}

export async function runExtractionPipeline(
  content: ExtractionContent,
  options: PipelineOptions
): Promise<PipelineResult> {
  const client = createClaudeClient()
  const startTime = Date.now()

  // Pass 1: Type detection (or skip if forced_type or resumed from checkpoint)
  let typeResult: TypeDetectionResult
  if (options.checkpoint?.type_result) {
    typeResult = options.checkpoint.type_result
    log.info({ type: typeResult.detected_type }, 'Genbruger Pass 1 fra checkpoint')
  } else if (options.forced_type) {
    typeResult = {
      detected_type: options.forced_type,
      confidence: 1.0,
      alternatives: [],
      model_used: 'manual',
      input_tokens: 0,
      output_tokens: 0,
    }
    log.info({ forced_type: options.forced_type }, 'Using forced type (skip Pass 1)')
    if (options.onCheckpoint) {
      await options.onCheckpoint({ type_result: typeResult })
    }
  } else {
    log.info('Pass 1: Detecting document type')
    typeResult = await detectDocumentType(content, client)
    if (options.onCheckpoint) {
      await options.onCheckpoint({ type_result: typeResult })
    }
  }

  // Get schema (or MINIMAL fallback)
  const schema = getSchema(typeResult.detected_type) ?? getSchema('MINIMAL')
  if (!schema) {
    throw new Error(
      `No schema found for type ${typeResult.detected_type} and MINIMAL not registered`
    )
  }
  log.info({ type: schema.contract_type, schema_version: schema.schema_version }, 'Using schema')

  // Pass 2a: First extraction run (or reuse from checkpoint)
  let run1: SchemaExtractionResult
  if (options.checkpoint?.run1) {
    run1 = options.checkpoint.run1
    log.info('Genbruger Pass 2a fra checkpoint')
  } else {
    log.info('Pass 2a: Schema extraction (run 1, temperature=0.2)')
    run1 = await extractWithSchema(content, schema, client, { temperature: 0.2 })
    if (options.onCheckpoint) {
      // Strip raw_response før persistering — kan indeholde non-serializable SDK-objekter.
      await options.onCheckpoint({
        type_result: typeResult,
        run1: stripRawResponse(run1),
      })
    }
  }

  // Pass 2b: Kør kun hvis lav confidence i Pass 2a, eller eksplicit forlangt.
  // Default: skip_agreement=undefined → confidence-gated (spar ~50% cost).
  //   - skip_agreement === false  → tvungen 2-run (eksplicit opt-in)
  //   - skip_agreement === true   → tvungen 1-run
  //   - skip_agreement === undefined → 2-run kun hvis minConfidence < 0.75
  const run1Confidences = Object.values(run1.fields).map((f) => f.claude_confidence ?? 1.0)
  const minConfidence = run1Confidences.length > 0 ? Math.min(...run1Confidences) : 1.0
  const shouldRun2 = options.skip_agreement === false || minConfidence < 0.75

  let run2 = null
  let agreement: ReturnType<typeof compareRuns> = []
  if (shouldRun2) {
    log.info(
      { minConfidence, reason: options.skip_agreement === false ? 'forced' : 'low-confidence' },
      'Pass 2b: Schema extraction (run 2, temperature=0.4)'
    )
    run2 = await extractWithSchema(content, schema, client, { temperature: 0.4 })
    agreement = compareRuns(run1.fields, run2.fields)
    const agreeCount = agreement.filter((a) => a.values_match).length
    log.info({ total_fields: agreement.length, agreed: agreeCount }, 'Agreement computed')
  } else {
    log.info({ minConfidence }, 'Pass 2b skipped (skip_agreement default + høj confidence)')
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
  // Cache-tokens aggregeret på tværs af alle passes. Vigtig for AIUsageLog:
  // uden disse ville cache_read/write-kolonnerne være 0 for extraction og
  // modvirke målet om at tracke cache-effektivitet. Anthropic API returnerer
  // feltet som null når cache er inaktiv — `?? 0` håndterer begge.
  const totalCacheReadTokens =
    (typeResult.cache_read_input_tokens ?? 0) +
    (run1.cache_read_input_tokens ?? 0) +
    (run2?.cache_read_input_tokens ?? 0)
  const totalCacheWriteTokens =
    (typeResult.cache_creation_input_tokens ?? 0) +
    (run1.cache_creation_input_tokens ?? 0) +
    (run2?.cache_creation_input_tokens ?? 0)
  // NB: computeCostUsd bruger MODEL_COSTS for extraction_model, men typeResult
  // kører på Haiku. Vi accepterer den lille unøjagtighed (Haiku er ~30% af
  // Sonnet per token), da total extraction-cost domineres af Pass 2.
  // Cache-tokens er pris-differentiated i computeCostUsd (1.25x write, 0.1x read).
  const totalCost = computeCostUsd(
    schema.extraction_model as ClaudeModel,
    totalInputTokens,
    totalOutputTokens,
    {
      cacheReadTokens: totalCacheReadTokens,
      cacheWriteTokens: totalCacheWriteTokens,
    }
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
    total_cache_read_tokens: totalCacheReadTokens,
    total_cache_write_tokens: totalCacheWriteTokens,
    total_cost_usd: totalCost,
  }
}
