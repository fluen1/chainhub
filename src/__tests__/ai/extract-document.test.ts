import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock alle eksterne afhængigheder før import af SUT
vi.mock('@/lib/ai/feature-flags', () => ({
  isAIEnabled: vi.fn(),
}))
vi.mock('@/lib/ai/cost-cap', () => ({
  checkCostCap: vi.fn(),
  reserveAIBudget: vi.fn().mockResolvedValue({ reserved: true, reservationId: 'test' }),
  commitAIUsage: vi.fn().mockResolvedValue(undefined),
  releaseReservation: vi.fn().mockResolvedValue(undefined),
  estimateExtractionCost: vi.fn().mockReturnValue(0.12),
}))
vi.mock('@/lib/ai/usage', () => ({
  recordAIUsage: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('@/lib/ai/content-loader', () => ({
  loadForExtraction: vi.fn(),
}))
vi.mock('@/lib/ai/pipeline/orchestrator', () => ({
  runExtractionPipeline: vi.fn(),
}))
vi.mock('@/lib/db', () => ({
  prisma: {
    documentExtraction: {
      upsert: vi.fn(),
      findFirst: vi.fn().mockResolvedValue(null),
      findUnique: vi.fn().mockResolvedValue(null),
    },
  },
}))

import { extractDocument } from '@/lib/ai/jobs/extract-document'
import { isAIEnabled } from '@/lib/ai/feature-flags'
import { checkCostCap } from '@/lib/ai/cost-cap'
import { recordAIUsage } from '@/lib/ai/usage'
import { loadForExtraction } from '@/lib/ai/content-loader'
import { runExtractionPipeline } from '@/lib/ai/pipeline/orchestrator'
import { prisma } from '@/lib/db'

const basePayload = {
  document_id: 'doc-1',
  organization_id: 'org-1',
  file_buffer_base64: Buffer.from('hello').toString('base64'),
  filename: 'test.pdf',
}

describe('extractDocument enforcement', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returnerer status=skipped naar feature flag er disabled', async () => {
    ;(isAIEnabled as ReturnType<typeof vi.fn>).mockResolvedValue(false)

    const result = await extractDocument(basePayload)

    expect(result.skipped).toBe(true)
    expect(result.status).toBe('skipped')
    expect(result.reason).toContain('ikke aktiveret')
    expect(checkCostCap).not.toHaveBeenCalled()
    expect(runExtractionPipeline).not.toHaveBeenCalled()
    expect(recordAIUsage).not.toHaveBeenCalled()
  })

  it('returnerer status=skipped naar cost cap er naaet', async () => {
    ;(isAIEnabled as ReturnType<typeof vi.fn>).mockResolvedValue(true)
    ;(checkCostCap as ReturnType<typeof vi.fn>).mockResolvedValue({
      allowed: false,
      reason: 'Månedlig AI-cap er nået — kontakt admin',
    })

    const result = await extractDocument(basePayload)

    expect(result.skipped).toBe(true)
    expect(result.status).toBe('skipped')
    expect(result.reason).toContain('AI-cap')
    expect(runExtractionPipeline).not.toHaveBeenCalled()
    expect(recordAIUsage).not.toHaveBeenCalled()
  })

  it('kalder recordAIUsage ved success og returnerer status=success', async () => {
    ;(isAIEnabled as ReturnType<typeof vi.fn>).mockResolvedValue(true)
    ;(checkCostCap as ReturnType<typeof vi.fn>).mockResolvedValue({ allowed: true })
    ;(loadForExtraction as ReturnType<typeof vi.fn>).mockResolvedValue({
      type: 'pdf_pages',
      pages: [],
    })
    ;(runExtractionPipeline as ReturnType<typeof vi.fn>).mockResolvedValue({
      type_detection: { detected_type: 'EJERAFTALE', confidence: 0.95, alternatives: [] },
      extraction_run1: {
        fields: { field_a: 'value' },
        model_used: 'claude-sonnet-4-6',
        raw_response: {},
      },
      extraction_run2: null,
      agreement: [],
      source_verification: [],
      sanity_checks: [],
      cross_validation: [],
      field_confidences: [],
      additional_findings: [],
      extraction_warnings: [],
      total_input_tokens: 500,
      total_output_tokens: 250,
      total_cache_read_tokens: 300,
      total_cache_write_tokens: 100,
      total_cost_usd: 0.042,
    })
    ;(prisma.documentExtraction.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null)
    ;(prisma.documentExtraction.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'extraction-1',
    })

    const result = await extractDocument(basePayload)

    expect(result.status).toBe('success')
    expect(result.skipped).toBe(false)
    expect(result.extraction_id).toBe('extraction-1')
    expect(result.total_cost_usd).toBe(0.042)
    expect(recordAIUsage).toHaveBeenCalledWith({
      organizationId: 'org-1',
      feature: 'extraction',
      model: 'claude-sonnet-4-6',
      provider: 'anthropic',
      inputTokens: 500,
      outputTokens: 250,
      cacheReadTokens: 300,
      cacheWriteTokens: 100,
      costUsd: 0.042,
      resourceType: 'document',
      resourceId: 'doc-1',
    })
  })
})
