import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mocks — hoisted FØR imports
// ---------------------------------------------------------------------------

const {
  mockIsAIEnabled,
  mockCheckCostCap,
  mockReserveAIBudget,
  mockCommitAIUsage,
  mockEstimateCost,
  mockLoadForExtraction,
  mockRunExtractionPipeline,
  mockRunEntityMatching,
  mockRecordAIUsage,
  mockPrismaUpsert,
  mockPrismaFindFirst,
  mockPrismaFindUnique,
  mockPrismaUpdate,
  mockSha256,
} = vi.hoisted(() => ({
  mockIsAIEnabled: vi.fn(),
  mockCheckCostCap: vi.fn(),
  mockReserveAIBudget: vi.fn(),
  mockCommitAIUsage: vi.fn(),
  mockEstimateCost: vi.fn(),
  mockLoadForExtraction: vi.fn(),
  mockRunExtractionPipeline: vi.fn(),
  mockRunEntityMatching: vi.fn(),
  mockRecordAIUsage: vi.fn(),
  mockPrismaUpsert: vi.fn(),
  mockPrismaFindFirst: vi.fn(),
  mockPrismaFindUnique: vi.fn(),
  mockPrismaUpdate: vi.fn(),
  mockSha256: vi.fn(),
}))

vi.mock('@/lib/ai/feature-flags', () => ({ isAIEnabled: mockIsAIEnabled }))
vi.mock('@/lib/ai/cost-cap', () => ({
  checkCostCap: mockCheckCostCap,
  reserveAIBudget: mockReserveAIBudget,
  commitAIUsage: mockCommitAIUsage,
  releaseReservation: vi.fn(),
  estimateExtractionCost: mockEstimateCost,
}))
vi.mock('@/lib/ai/usage', () => ({ recordAIUsage: mockRecordAIUsage }))
vi.mock('@/lib/ai/content-loader', () => ({ loadForExtraction: mockLoadForExtraction }))
vi.mock('@/lib/ai/pipeline/orchestrator', () => ({
  runExtractionPipeline: mockRunExtractionPipeline,
}))
vi.mock('@/lib/ai/pipeline/pass6-entity-matching', () => ({
  runEntityMatching: mockRunEntityMatching,
}))
vi.mock('@/lib/ai/content-hash', () => ({ sha256: mockSha256 }))
vi.mock('@/lib/ai/logger', () => ({
  createLogger: () => ({ info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}))
vi.mock('@/lib/db', () => ({
  prisma: {
    documentExtraction: {
      findFirst: mockPrismaFindFirst,
      findUnique: mockPrismaFindUnique,
      upsert: mockPrismaUpsert,
      update: mockPrismaUpdate,
    },
  },
}))

// Schema imports (sideffekt-only imports)
vi.mock('@/lib/ai/schemas/ejeraftale', () => ({}))
vi.mock('@/lib/ai/schemas/lejekontrakt', () => ({}))
vi.mock('@/lib/ai/schemas/forsikring', () => ({}))
vi.mock('@/lib/ai/schemas/vedtaegter', () => ({}))
vi.mock('@/lib/ai/schemas/ansaettelseskontrakt', () => ({}))
vi.mock('@/lib/ai/schemas/driftsaftale', () => ({}))
vi.mock('@/lib/ai/schemas/minimal', () => ({}))

import { extractDocument } from '@/lib/ai/jobs/extract-document'

// ---------------------------------------------------------------------------
// Fælles test-data
// ---------------------------------------------------------------------------

const ORG_ID = 'org-abc'
const DOC_ID = 'doc-xyz'

const BASE_PAYLOAD = {
  document_id: DOC_ID,
  organization_id: ORG_ID,
  file_buffer_base64: Buffer.from('dummy').toString('base64'),
  filename: 'aftale.docx',
}

const EXTRACTED_FIELDS = { cvr: '12345678', parter: ['Test ApS'] }

const PIPELINE_RESULT = {
  type_detection: { detected_type: 'EJERAFTALE', confidence: 0.9, alternatives: [] },
  extraction_run1: {
    fields: EXTRACTED_FIELDS,
    extracted_fields: EXTRACTED_FIELDS,
    model_used: 'gpt-5-mini',
    raw_response: {},
  },
  extraction_run2: null,
  agreement: [],
  source_verification: [],
  sanity_checks: [],
  cross_validation: [],
  field_confidences: [],
  total_input_tokens: 500,
  total_output_tokens: 200,
  total_cache_read_tokens: 0,
  total_cache_write_tokens: 0,
  total_cost_usd: 0.005,
}

const SAVED_EXTRACTION = {
  id: 'extraction-1',
  detected_type: 'EJERAFTALE',
  extracted_fields: EXTRACTED_FIELDS,
}

function setupHappyPath(entityMatchingEnabled = true) {
  // Feature flags
  mockIsAIEnabled.mockImplementation((_orgId: string, feature: string) => {
    if (feature === 'extraction') return Promise.resolve(true)
    if (feature === 'entity_matching') return Promise.resolve(entityMatchingEnabled)
    return Promise.resolve(false)
  })

  // Cost cap
  mockCheckCostCap.mockResolvedValue({ allowed: true })
  mockReserveAIBudget.mockResolvedValue({ reserved: true })
  mockCommitAIUsage.mockResolvedValue(undefined)
  mockEstimateCost.mockReturnValue(0.01)

  // Content loader — text_markdown simulerer docx → markdown
  mockLoadForExtraction.mockResolvedValue({
    type: 'text_markdown',
    markdown: 'Aftale indgås med Test ApS CVR 12345678',
    detectedMime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  })

  mockSha256.mockReturnValue('hash-abc')

  // Ingen eksisterende dedup
  mockPrismaFindFirst.mockResolvedValue(null)
  // Ingen eksisterende checkpoint
  mockPrismaFindUnique.mockResolvedValue(null)

  // Pipeline result
  mockRunExtractionPipeline.mockResolvedValue(PIPELINE_RESULT)

  // DB upsert returnerer extraction-objekt
  mockPrismaUpsert.mockResolvedValue(SAVED_EXTRACTION)
  mockPrismaUpdate.mockResolvedValue({ ...SAVED_EXTRACTION, entity_matches: [] })

  // recordAIUsage
  mockRecordAIUsage.mockResolvedValue(undefined)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('extract-document — Pass 6 entity matching integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('kalder runEntityMatching efter pipeline og DB-write ved succes', async () => {
    setupHappyPath(true)
    mockRunEntityMatching.mockResolvedValue({
      matches: [],
      input_tokens: 100,
      output_tokens: 40,
      cache_read_tokens: 0,
      cache_write_tokens: 0,
      cost_usd: 0.0001,
    })

    const result = await extractDocument(BASE_PAYLOAD)

    expect(result.status).toBe('success')
    expect(mockRunEntityMatching).toHaveBeenCalledOnce()
    expect(mockRunEntityMatching).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: ORG_ID,
        documentText: expect.stringContaining('Test ApS'),
        extractedFields: EXTRACTED_FIELDS,
      })
    )
  })

  it('gemmer entity_matches i DB når matches er fundet', async () => {
    setupHappyPath(true)

    const matches = [
      {
        entity_type: 'company',
        entity_id: 'company-1',
        entity_name: 'Test ApS',
        confidence: 0.95,
        match_reason: 'CVR 12345678',
      },
    ]
    mockRunEntityMatching.mockResolvedValue({
      matches,
      input_tokens: 300,
      output_tokens: 80,
      cache_read_tokens: 0,
      cache_write_tokens: 0,
      cost_usd: 0.0003,
    })

    await extractDocument(BASE_PAYLOAD)

    expect(mockPrismaUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { document_id: DOC_ID },
        data: expect.objectContaining({ entity_matches: matches }),
      })
    )
  })

  it('springer DB update over når ingen matches findes', async () => {
    setupHappyPath(true)
    mockRunEntityMatching.mockResolvedValue({
      matches: [],
      input_tokens: 50,
      output_tokens: 10,
      cache_read_tokens: 0,
      cache_write_tokens: 0,
      cost_usd: 0,
    })

    await extractDocument(BASE_PAYLOAD)

    expect(mockPrismaUpdate).not.toHaveBeenCalled()
  })

  it('logger entity_matching usage via recordAIUsage', async () => {
    setupHappyPath(true)
    mockRunEntityMatching.mockResolvedValue({
      matches: [],
      input_tokens: 200,
      output_tokens: 60,
      cache_read_tokens: 150,
      cache_write_tokens: 50,
      cost_usd: 0.0002,
    })

    await extractDocument(BASE_PAYLOAD)

    expect(mockRecordAIUsage).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: ORG_ID,
        feature: 'entity_matching',
        model: 'gpt-5-nano',
        provider: 'openai',
        inputTokens: 200,
        outputTokens: 60,
        cacheReadTokens: 150,
        cacheWriteTokens: 50,
        costUsd: 0.0002,
        resourceType: 'document',
        resourceId: DOC_ID,
      })
    )
  })

  it('job returnerer success selv når entity matching kaster fejl (non-blocking)', async () => {
    setupHappyPath(true)
    mockRunEntityMatching.mockRejectedValue(new Error('LLM timeout'))

    const result = await extractDocument(BASE_PAYLOAD)

    // Jobbet skal stadig returnere success
    expect(result.status).toBe('success')
    expect(result.extraction_id).toBe('extraction-1')
    // entity matching forsøgt
    expect(mockRunEntityMatching).toHaveBeenCalledOnce()
  })

  it('springer entity matching over når feature flag er slukket', async () => {
    setupHappyPath(false) // entity_matching disabled
    mockRunEntityMatching.mockResolvedValue({
      matches: [],
      input_tokens: 0,
      output_tokens: 0,
      cache_read_tokens: 0,
      cache_write_tokens: 0,
      cost_usd: 0,
    })

    await extractDocument(BASE_PAYLOAD)

    expect(mockRunEntityMatching).not.toHaveBeenCalled()
    expect(mockPrismaUpdate).not.toHaveBeenCalled()
  })

  it('bruger markdown-tekst som documentText ved text_markdown content', async () => {
    setupHappyPath(true)
    const markdownText = '# Aftale\nMed Test ApS CVR 12345678'
    mockLoadForExtraction.mockResolvedValue({
      type: 'text_markdown',
      markdown: markdownText,
      detectedMime: 'text/markdown',
    })
    mockRunEntityMatching.mockResolvedValue({
      matches: [],
      input_tokens: 100,
      output_tokens: 20,
      cache_read_tokens: 0,
      cache_write_tokens: 0,
      cost_usd: 0,
    })

    await extractDocument(BASE_PAYLOAD)

    expect(mockRunEntityMatching).toHaveBeenCalledWith(
      expect.objectContaining({ documentText: markdownText })
    )
  })

  it('bruger html som documentText ved text_html content', async () => {
    setupHappyPath(true)
    const htmlText = '<p>Aftale med <strong>Test ApS</strong></p>'
    mockLoadForExtraction.mockResolvedValue({
      type: 'text_html',
      html: htmlText,
      detectedMime: 'text/html',
    })
    mockRunEntityMatching.mockResolvedValue({
      matches: [],
      input_tokens: 100,
      output_tokens: 20,
      cache_read_tokens: 0,
      cache_write_tokens: 0,
      cost_usd: 0,
    })

    await extractDocument(BASE_PAYLOAD)

    expect(mockRunEntityMatching).toHaveBeenCalledWith(
      expect.objectContaining({ documentText: htmlText })
    )
  })

  it('bruger tom string som documentText ved pdf_binary content', async () => {
    setupHappyPath(true)
    mockLoadForExtraction.mockResolvedValue({
      type: 'pdf_binary',
      data: Buffer.from('pdf-bytes'),
      detectedMime: 'application/pdf',
      page_count: 3,
    })
    mockRunEntityMatching.mockResolvedValue({
      matches: [],
      input_tokens: 100,
      output_tokens: 20,
      cache_read_tokens: 0,
      cache_write_tokens: 0,
      cost_usd: 0,
    })

    await extractDocument(BASE_PAYLOAD)

    expect(mockRunEntityMatching).toHaveBeenCalledWith(
      expect.objectContaining({ documentText: '' })
    )
  })
})
