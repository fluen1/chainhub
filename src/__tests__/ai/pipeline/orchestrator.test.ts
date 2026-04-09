import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock all pass modules and dependencies before importing orchestrator
vi.mock('@/lib/ai/client', () => ({
  createClaudeClient: vi.fn(() => ({ providerName: 'anthropic', complete: vi.fn() })),
  computeCostUsd: vi.fn(() => 0.042),
}))

vi.mock('@/lib/ai/schemas/registry', () => ({
  getSchema: vi.fn(),
}))

vi.mock('@/lib/ai/pipeline/pass1-type-detection', () => ({
  detectDocumentType: vi.fn(),
}))

vi.mock('@/lib/ai/pipeline/pass2-schema-extraction', () => ({
  extractWithSchema: vi.fn(),
}))

vi.mock('@/lib/ai/pipeline/pass3-source-verification', () => ({
  verifySourceAttribution: vi.fn(),
  extractDocumentText: vi.fn(),
}))

vi.mock('@/lib/ai/pipeline/pass4-sanity-checks', () => ({
  runSanityChecks: vi.fn(),
}))

vi.mock('@/lib/ai/pipeline/pass5-cross-validation', () => ({
  crossValidate: vi.fn(),
}))

vi.mock('@/lib/ai/pipeline/confidence', () => ({
  compareRuns: vi.fn(),
  computeAllFieldConfidences: vi.fn(),
}))

vi.mock('@/lib/ai/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}))

import { runExtractionPipeline } from '@/lib/ai/pipeline/orchestrator'
import { getSchema } from '@/lib/ai/schemas/registry'
import { detectDocumentType } from '@/lib/ai/pipeline/pass1-type-detection'
import { extractWithSchema } from '@/lib/ai/pipeline/pass2-schema-extraction'
import { verifySourceAttribution, extractDocumentText } from '@/lib/ai/pipeline/pass3-source-verification'
import { runSanityChecks } from '@/lib/ai/pipeline/pass4-sanity-checks'
import { crossValidate } from '@/lib/ai/pipeline/pass5-cross-validation'
import { compareRuns, computeAllFieldConfidences } from '@/lib/ai/pipeline/confidence'
import type { ExtractionContent } from '@/lib/ai/content-loader'
import type { PipelineOptions } from '@/lib/ai/pipeline/types'

const mockSchema = {
  contract_type: 'EJERAFTALE',
  schema_version: 'v1.0.0',
  display_name: 'Ejeraftale',
  extraction_model: 'claude-3-5-haiku-20241022',
  sanity_rules: [],
  tool_definition: {},
  field_metadata: {},
  system_prompt: 'test',
  user_prompt_prefix: 'test',
}

const mockRun1 = {
  fields: {
    company_name: { value: 'Test ApS', claude_confidence: 0.9, source_page: 1, source_text: 'Test ApS' },
    ownership_percentage: { value: 51, claude_confidence: 0.85, source_page: 2, source_text: '51%' },
  },
  additional_findings: [{ finding: 'Found penalty clause', source_page: 3, importance: 'high' }],
  extraction_warnings: [{ warning: 'Signature page missing', severity: 'low' }],
  model_used: 'claude-3-5-haiku-20241022',
  input_tokens: 1000,
  output_tokens: 200,
  raw_response: {},
}

const mockRun2 = {
  fields: {
    company_name: { value: 'Test ApS', claude_confidence: 0.88, source_page: 1, source_text: 'Test ApS' },
    ownership_percentage: { value: 51, claude_confidence: 0.82, source_page: 2, source_text: '51%' },
  },
  additional_findings: [],
  extraction_warnings: [],
  model_used: 'claude-3-5-haiku-20241022',
  input_tokens: 950,
  output_tokens: 190,
  raw_response: {},
}

const mockAgreement = [
  { field_name: 'company_name', run1_value: 'Test ApS', run2_value: 'Test ApS', values_match: true },
  { field_name: 'ownership_percentage', run1_value: 51, run2_value: 51, values_match: true },
]

const mockSourceVerification = [
  { field_name: 'company_name', verified: true, match_score: 0.98 },
  { field_name: 'ownership_percentage', verified: true, match_score: 0.92 },
]

const mockSanityChecks = [
  { field_name: 'ownership_percentage', passed: true, rule: 'Must be between 0 and 100' },
]

const mockCrossValidation = [
  { field_name: 'company_name', ai_value: 'Test ApS', existing_value: 'Test ApS', match: true },
]

const mockFieldConfidences = [
  { field_name: 'company_name', confidence: 0.95, components: { agreement: 0.4, source_verified: 0.3, sanity_passed: 0.2, claude_self: 0.09 } },
  { field_name: 'ownership_percentage', confidence: 0.9, components: { agreement: 0.4, source_verified: 0.3, sanity_passed: 0.2, claude_self: 0.085 } },
]

const testContent: ExtractionContent = {
  type: 'text_html',
  html: '<p>Ejeraftale mellem Kædegruppen og Dr. Petersen</p>',
  detectedMime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
}

const baseOptions: PipelineOptions = {
  document_id: 'doc-123',
  organization_id: 'org-456',
  skip_agreement: false,
}

describe('Pipeline Orchestrator', () => {
  beforeEach(() => {
    vi.resetAllMocks()

    vi.mocked(getSchema).mockReturnValue(mockSchema as never)
    vi.mocked(detectDocumentType).mockResolvedValue({
      detected_type: 'EJERAFTALE',
      confidence: 0.93,
      alternatives: [],
      model_used: 'claude-3-5-haiku-20241022',
      input_tokens: 500,
      output_tokens: 50,
    })
    vi.mocked(extractWithSchema)
      .mockResolvedValueOnce(mockRun1 as never)
      .mockResolvedValueOnce(mockRun2 as never)
    vi.mocked(extractDocumentText).mockReturnValue('Ejeraftale mellem Kædegruppen og Dr. Petersen')
    vi.mocked(verifySourceAttribution).mockReturnValue(mockSourceVerification)
    vi.mocked(runSanityChecks).mockReturnValue(mockSanityChecks)
    vi.mocked(crossValidate).mockResolvedValue(mockCrossValidation)
    vi.mocked(compareRuns).mockReturnValue(mockAgreement)
    vi.mocked(computeAllFieldConfidences).mockReturnValue(mockFieldConfidences)
  })

  it('calls all passes in correct order', async () => {
    const callOrder: string[] = []

    vi.mocked(detectDocumentType).mockReset()
    vi.mocked(detectDocumentType).mockImplementation(async () => {
      callOrder.push('pass1')
      return { detected_type: 'EJERAFTALE', confidence: 0.93, alternatives: [], model_used: 'claude-3-5-haiku-20241022', input_tokens: 500, output_tokens: 50 }
    })
    vi.mocked(extractWithSchema).mockReset()
    vi.mocked(extractWithSchema)
      .mockImplementationOnce(async () => { callOrder.push('pass2a'); return mockRun1 as never })
      .mockImplementationOnce(async () => { callOrder.push('pass2b'); return mockRun2 as never })
    vi.mocked(verifySourceAttribution).mockReset()
    vi.mocked(verifySourceAttribution).mockImplementation(() => { callOrder.push('pass3'); return mockSourceVerification })
    vi.mocked(runSanityChecks).mockReset()
    vi.mocked(runSanityChecks).mockImplementation(() => { callOrder.push('pass4'); return mockSanityChecks })
    vi.mocked(crossValidate).mockReset()
    vi.mocked(crossValidate).mockImplementation(async () => { callOrder.push('pass5'); return mockCrossValidation })

    await runExtractionPipeline(testContent, baseOptions)

    expect(callOrder).toEqual(['pass1', 'pass2a', 'pass2b', 'pass3', 'pass4', 'pass5'])
  })

  it('returns aggregated PipelineResult with correct structure', async () => {
    const result = await runExtractionPipeline(testContent, baseOptions)

    expect(result.type_detection.detected_type).toBe('EJERAFTALE')
    expect(result.extraction_run1).toBe(mockRun1)
    expect(result.extraction_run2).toBe(mockRun2)
    expect(result.agreement).toEqual(mockAgreement)
    expect(result.source_verification).toEqual(mockSourceVerification)
    expect(result.sanity_checks).toEqual(mockSanityChecks)
    expect(result.cross_validation).toEqual(mockCrossValidation)
    expect(result.field_confidences).toEqual(mockFieldConfidences)
    expect(result.additional_findings).toEqual(mockRun1.additional_findings)
    expect(result.extraction_warnings).toEqual(mockRun1.extraction_warnings)
  })

  it('computes total token counts correctly', async () => {
    const result = await runExtractionPipeline(testContent, baseOptions)

    // type detection: 500+50, run1: 1000+200, run2: 950+190
    expect(result.total_input_tokens).toBe(500 + 1000 + 950)
    expect(result.total_output_tokens).toBe(50 + 200 + 190)
  })

  it('skips pass1 and uses forced_type when provided', async () => {
    const options = { ...baseOptions, forced_type: 'LEJEKONTRAKT' }

    await runExtractionPipeline(testContent, options)

    expect(detectDocumentType).not.toHaveBeenCalled()
    expect(getSchema).toHaveBeenCalledWith('LEJEKONTRAKT')
  })

  it('skips pass2b (run2) when skip_agreement=true', async () => {
    const options = { ...baseOptions, skip_agreement: true }

    const result = await runExtractionPipeline(testContent, options)

    expect(extractWithSchema).toHaveBeenCalledTimes(1)
    expect(result.extraction_run2).toBeNull()
    expect(result.agreement).toEqual([])
  })

  it('falls back to MINIMAL schema when detected type has no schema', async () => {
    vi.mocked(getSchema)
      .mockReturnValueOnce(null) // first call for detected type
      .mockReturnValueOnce(mockSchema as never) // second call for MINIMAL
    vi.mocked(detectDocumentType).mockResolvedValue({
      detected_type: 'UNKNOWN_TYPE',
      confidence: 0.3,
      alternatives: [],
      model_used: 'claude-3-5-haiku-20241022',
      input_tokens: 500,
      output_tokens: 50,
    })

    await runExtractionPipeline(testContent, baseOptions)

    expect(getSchema).toHaveBeenCalledWith('UNKNOWN_TYPE')
    expect(getSchema).toHaveBeenCalledWith('MINIMAL')
  })

  it('throws when neither detected type nor MINIMAL schema exists', async () => {
    vi.mocked(getSchema).mockReturnValue(null)
    vi.mocked(detectDocumentType).mockResolvedValue({
      detected_type: 'UNKNOWN_TYPE',
      confidence: 0.3,
      alternatives: [],
      model_used: 'claude-3-5-haiku-20241022',
      input_tokens: 500,
      output_tokens: 50,
    })

    await expect(runExtractionPipeline(testContent, baseOptions)).rejects.toThrow(
      'No schema found for type UNKNOWN_TYPE and MINIMAL not registered',
    )
  })

  it('passes document_id to crossValidate', async () => {
    await runExtractionPipeline(testContent, baseOptions)

    expect(crossValidate).toHaveBeenCalledWith('doc-123', mockRun1.fields)
  })

  it('passes schema sanity_rules to runSanityChecks', async () => {
    await runExtractionPipeline(testContent, baseOptions)

    expect(runSanityChecks).toHaveBeenCalledWith(mockRun1.fields, mockSchema.sanity_rules)
  })

  it('uses forced_type tokens=0 in token aggregation', async () => {
    const options = { ...baseOptions, forced_type: 'EJERAFTALE', skip_agreement: true }
    // beforeEach already sets up extractWithSchema to return mockRun1 first

    const result = await runExtractionPipeline(testContent, options)

    // forced_type: 0+0, run1: 1000+200, no run2
    expect(result.total_input_tokens).toBe(0 + 1000)
    expect(result.total_output_tokens).toBe(0 + 200)
  })
})
