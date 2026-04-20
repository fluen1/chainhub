import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { isAIEnabled } from '@/lib/ai/feature-flags'
import {
  checkCostCap,
  reserveAIBudget,
  commitAIUsage,
  releaseReservation,
  estimateExtractionCost,
} from '@/lib/ai/cost-cap'
import { recordAIUsage } from '@/lib/ai/usage'
import { loadForExtraction } from '@/lib/ai/content-loader'
import { runExtractionPipeline } from '@/lib/ai/pipeline/orchestrator'
import type { PipelineCheckpoint } from '@/lib/ai/pipeline/types'
import { sha256 } from '@/lib/ai/content-hash'
import { createLogger } from '@/lib/ai/logger'

const log = createLogger('extract-document')

export interface ExtractDocumentPayload {
  document_id: string
  organization_id: string
  file_buffer_base64: string
  filename: string
  forced_type?: string
}

export type ExtractDocumentStatus = 'success' | 'skipped' | 'error' | 'deduped' | 'budget_denied'

export interface ExtractDocumentResult {
  extraction_id: string
  detected_type: string
  field_count: number
  total_cost_usd: number
  skipped: boolean
  status?: ExtractDocumentStatus
  reason?: string
  deduped?: boolean
  source_extraction_id?: string
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

  // Content-hash dedup: SHA-256 af den faktiske content (raw buffer for PDF,
  // tekst-buffer for markdown/html) — så identiske re-uploads genbruger extraction.
  const hashBuffer =
    content.type === 'pdf_binary'
      ? content.data
      : content.type === 'text_markdown'
        ? Buffer.from(content.markdown)
        : content.type === 'text_html'
          ? Buffer.from(content.html)
          : buffer
  const contentHash = sha256(hashBuffer)

  const existingExtraction = await prisma.documentExtraction.findFirst({
    where: {
      organization_id: payload.organization_id,
      content_hash: contentHash,
      document_id: { not: payload.document_id },
    },
    orderBy: { created_at: 'desc' },
  })

  if (existingExtraction) {
    log.info(
      {
        document_id: payload.document_id,
        content_hash: contentHash,
        source_extraction_id: existingExtraction.id,
      },
      'Identisk content fundet — genbruger extraction'
    )

    const deduped = await prisma.documentExtraction.upsert({
      where: { document_id: payload.document_id },
      create: {
        document_id: payload.document_id,
        organization_id: payload.organization_id,
        content_hash: contentHash,
        detected_type: existingExtraction.detected_type,
        type_confidence: existingExtraction.type_confidence,
        type_alternatives: existingExtraction.type_alternatives as Prisma.InputJsonValue,
        schema_version: existingExtraction.schema_version,
        prompt_version: existingExtraction.prompt_version,
        model_name: existingExtraction.model_name,
        model_temperature: existingExtraction.model_temperature,
        extracted_fields: existingExtraction.extracted_fields as Prisma.InputJsonValue,
        extracted_fields_run2:
          (existingExtraction.extracted_fields_run2 as Prisma.InputJsonValue) ?? Prisma.JsonNull,
        agreement_score: existingExtraction.agreement_score,
        source_verification:
          (existingExtraction.source_verification as Prisma.InputJsonValue) ?? Prisma.JsonNull,
        sanity_check_results:
          (existingExtraction.sanity_check_results as Prisma.InputJsonValue) ?? Prisma.JsonNull,
        discrepancies:
          (existingExtraction.discrepancies as Prisma.InputJsonValue) ?? Prisma.JsonNull,
        raw_response: existingExtraction.raw_response as Prisma.InputJsonValue,
        input_tokens: 0,
        output_tokens: 0,
        total_cost_usd: 0,
        extraction_status: existingExtraction.extraction_status,
      },
      update: {
        content_hash: contentHash,
        detected_type: existingExtraction.detected_type,
        type_confidence: existingExtraction.type_confidence,
        type_alternatives: existingExtraction.type_alternatives as Prisma.InputJsonValue,
        schema_version: existingExtraction.schema_version,
        prompt_version: existingExtraction.prompt_version,
        model_name: existingExtraction.model_name,
        extracted_fields: existingExtraction.extracted_fields as Prisma.InputJsonValue,
        extracted_fields_run2:
          (existingExtraction.extracted_fields_run2 as Prisma.InputJsonValue) ?? Prisma.JsonNull,
        agreement_score: existingExtraction.agreement_score,
        source_verification:
          (existingExtraction.source_verification as Prisma.InputJsonValue) ?? Prisma.JsonNull,
        sanity_check_results:
          (existingExtraction.sanity_check_results as Prisma.InputJsonValue) ?? Prisma.JsonNull,
        discrepancies:
          (existingExtraction.discrepancies as Prisma.InputJsonValue) ?? Prisma.JsonNull,
        extraction_status: existingExtraction.extraction_status,
      },
    })

    return {
      extraction_id: deduped.id,
      detected_type: deduped.detected_type ?? '',
      field_count: Object.keys((deduped.extracted_fields as Record<string, unknown>) ?? {}).length,
      total_cost_usd: 0,
      skipped: false,
      status: 'deduped',
      deduped: true,
      source_extraction_id: existingExtraction.id,
    }
  }

  // Import all schemas to ensure they're registered
  await import('@/lib/ai/schemas/ejeraftale')
  await import('@/lib/ai/schemas/lejekontrakt')
  await import('@/lib/ai/schemas/forsikring')
  await import('@/lib/ai/schemas/vedtaegter')
  await import('@/lib/ai/schemas/ansaettelseskontrakt')
  await import('@/lib/ai/schemas/driftsaftale')
  await import('@/lib/ai/schemas/minimal')

  // Atomisk pre-debet: reserver estimeret cost FØR pipeline kører. Dette
  // forhindrer race condition hvor parallelle jobs alle passerer cost-cap
  // samtidigt. Reservationen frigives ved commit eller release nedenfor.
  // Dedup-stien ovenfor springer dette over (ingen AI-cost).
  const pageCount = content.type === 'pdf_binary' ? content.page_count : 1
  const estimatedCost = estimateExtractionCost(pageCount)

  const reservation = await reserveAIBudget(payload.organization_id, estimatedCost)
  if (!reservation.reserved) {
    log.warn(
      { document_id: payload.document_id, reason: reservation.reason, estimatedCost },
      'AI-budget afvist — pre-debet reservation fejlede'
    )
    return {
      extraction_id: '',
      detected_type: '',
      field_count: 0,
      total_cost_usd: 0,
      skipped: true,
      status: 'budget_denied',
      reason: reservation.reason ?? 'Cap ville overskrides — reservation afvist',
    }
  }

  // Hent eksisterende extraction for at finde tidligere checkpoint.
  // Hvis et tidligere job-forsøg fejlede mellem Pass 1 og Pass 2b, er
  // typeResult (og evt. run1) persisteret — vi springer dem over ved retry.
  const existingForCheckpoint = await prisma.documentExtraction.findUnique({
    where: { document_id: payload.document_id },
    select: { pipeline_checkpoint: true },
  })
  const checkpoint =
    (existingForCheckpoint?.pipeline_checkpoint as PipelineCheckpoint | null) ?? undefined

  if (checkpoint) {
    log.info(
      {
        document_id: payload.document_id,
        has_type_result: !!checkpoint.type_result,
        has_run1: !!checkpoint.run1,
      },
      'Genoptager extraction fra checkpoint'
    )
  }

  let result
  try {
    // Run pipeline — skip_agreement udeladt => confidence-gated default (spar ~50% cost).
    result = await runExtractionPipeline(content, {
      document_id: payload.document_id,
      organization_id: payload.organization_id,
      forced_type: payload.forced_type,
      checkpoint,
      onCheckpoint: async (cp) => {
        // Persistér checkpoint så retry kan genoptage. Bemærk: create-branch
        // skal levere alle NOT NULL-felter; vi bruger placeholdere indtil
        // det endelige extraction-upsert skriver de rigtige værdier.
        await prisma.documentExtraction.upsert({
          where: { document_id: payload.document_id },
          create: {
            document_id: payload.document_id,
            organization_id: payload.organization_id,
            content_hash: contentHash,
            model_name: 'pending',
            extracted_fields: {} as Prisma.InputJsonValue,
            raw_response: {} as Prisma.InputJsonValue,
            input_tokens: 0,
            output_tokens: 0,
            total_cost_usd: 0,
            extraction_status: 'in_progress',
            pipeline_checkpoint: cp as unknown as Prisma.InputJsonValue,
          },
          update: {
            pipeline_checkpoint: cp as unknown as Prisma.InputJsonValue,
          },
        })
      },
    })
  } catch (err) {
    // Pipeline fejlede — frigiv reservation så budgettet ikke lækker.
    // Checkpoint bevares i DB så næste retry kan resume fra sidste succesfulde pass.
    await releaseReservation(payload.organization_id, estimatedCost)
    throw err
  }

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
      content_hash: contentHash,
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
      pipeline_checkpoint: Prisma.JsonNull,
    },
    update: {
      content_hash: contentHash,
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
      pipeline_checkpoint: Prisma.JsonNull,
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

  // Log AI-forbrug til AIUsageLog — non-fatal hvis DB fejler.
  // Cache-tokens threades igennem fra pipeline så cache_read/write-kolonnerne
  // i AIUsageLog faktisk reflekterer cache-effektivitet (ellers altid 0).
  await recordAIUsage({
    organizationId: payload.organization_id,
    feature: 'extraction',
    model: result.extraction_run1.model_used ?? 'claude-sonnet-4-6',
    provider: 'anthropic',
    inputTokens: result.total_input_tokens,
    outputTokens: result.total_output_tokens,
    cacheReadTokens: result.total_cache_read_tokens,
    cacheWriteTokens: result.total_cache_write_tokens,
    costUsd: result.total_cost_usd,
    resourceType: 'document',
    resourceId: payload.document_id,
  })

  // Frigiv reservationen: faktiske omkostninger er nu logget via recordAIUsage,
  // så reservationen er ikke længere nødvendig. Eventuel diff mellem estimat
  // og faktisk cost er ikke et problem — usage-log er kilden til sandhed.
  await commitAIUsage(payload.organization_id, estimatedCost, result.total_cost_usd)

  return {
    extraction_id: extraction.id,
    detected_type: result.type_detection.detected_type,
    field_count: Object.keys(result.extraction_run1.fields).length,
    total_cost_usd: result.total_cost_usd,
    skipped: false,
    status: 'success',
  }
}
