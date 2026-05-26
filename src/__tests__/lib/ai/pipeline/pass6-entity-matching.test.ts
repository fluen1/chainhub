import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mocks — hoist before imports so vi.mock() sees them
// ---------------------------------------------------------------------------

const { mockComplete, mockPrismaFindMany } = vi.hoisted(() => ({
  mockComplete: vi.fn(),
  mockPrismaFindMany: vi.fn(),
}))

vi.mock('@/lib/ai/client', () => ({
  createClaudeClient: () => ({
    providerName: 'openai',
    complete: mockComplete,
  }),
  computeCostUsd: vi.fn(() => 0.0001),
}))

vi.mock('@/lib/ai/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    company: { findMany: mockPrismaFindMany },
    person: { findMany: mockPrismaFindMany },
  },
}))

import { runEntityMatching } from '@/lib/ai/pipeline/pass6-entity-matching'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeClaudeTextResponse(text: string, inputTokens = 200, outputTokens = 100) {
  return {
    id: 'resp-1',
    model: 'gpt-5-nano',
    stop_reason: 'end_turn' as const,
    content: [{ type: 'text' as const, text }],
    usage: {
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      cache_read_input_tokens: 0,
      cache_creation_input_tokens: 0,
    },
  }
}

const ORG_ID = 'org-123'

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('pass6-entity-matching — runEntityMatching', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returnerer tom result (ingen LLM-kald) når org har ingen entiteter', async () => {
    // Prisma returnerer tomme lister for både company og person
    mockPrismaFindMany.mockResolvedValue([])

    const result = await runEntityMatching({
      extractedFields: { cvr: '12345678' },
      organizationId: ORG_ID,
      documentText: 'Aftale med selskab CVR 12345678',
    })

    expect(result.matches).toEqual([])
    expect(result.cost_usd).toBe(0)
    expect(result.input_tokens).toBe(0)
    expect(result.output_tokens).toBe(0)
    // Ingen LLM-kald
    expect(mockComplete).not.toHaveBeenCalled()
  })

  it('returnerer matches med confidence >= 0.7 når CVR findes i extracted fields', async () => {
    // Prisma returnerer ét selskab og ingen personer
    mockPrismaFindMany
      .mockResolvedValueOnce([{ id: 'company-1', name: 'Test ApS', cvr: '12345678' }])
      .mockResolvedValueOnce([])

    const matchJson = JSON.stringify([
      {
        entity_type: 'company',
        entity_id: 'company-1',
        entity_name: 'Test ApS',
        confidence: 0.95,
        match_reason: 'CVR 12345678 matcher direkte',
      },
    ])
    mockComplete.mockResolvedValueOnce(makeClaudeTextResponse(matchJson, 300, 80))

    const result = await runEntityMatching({
      extractedFields: { cvr: '12345678' },
      organizationId: ORG_ID,
      documentText: 'Aftale med selskab CVR 12345678',
    })

    expect(result.matches).toHaveLength(1)
    expect(result.matches[0]).toMatchObject({
      entity_type: 'company',
      entity_id: 'company-1',
      confidence: 0.95,
    })
    expect(result.input_tokens).toBe(300)
    expect(result.output_tokens).toBe(80)
  })

  it('filtrerer matches med confidence < 0.7 fra', async () => {
    mockPrismaFindMany
      .mockResolvedValueOnce([{ id: 'company-1', name: 'Usikker ApS', cvr: '99999999' }])
      .mockResolvedValueOnce([])

    const matchJson = JSON.stringify([
      {
        entity_type: 'company',
        entity_id: 'company-1',
        entity_name: 'Usikker ApS',
        confidence: 0.5,
        match_reason: 'Mulig navne-lighed',
      },
    ])
    mockComplete.mockResolvedValueOnce(makeClaudeTextResponse(matchJson))

    const result = await runEntityMatching({
      extractedFields: {},
      organizationId: ORG_ID,
      documentText: 'Et dokument',
    })

    expect(result.matches).toEqual([])
  })

  it('indeholder token-forbrug i result', async () => {
    mockPrismaFindMany
      .mockResolvedValueOnce([{ id: 'c-1', name: 'Kæden ApS', cvr: '11223344' }])
      .mockResolvedValueOnce([{ id: 'p-1', first_name: 'Lars', last_name: 'Hansen' }])

    mockComplete.mockResolvedValueOnce(makeClaudeTextResponse('[]', 500, 200))

    const result = await runEntityMatching({
      extractedFields: {},
      organizationId: ORG_ID,
      documentText: 'Intet at matche her',
    })

    expect(result.input_tokens).toBe(500)
    expect(result.output_tokens).toBe(200)
    expect(typeof result.cost_usd).toBe('number')
  })

  it('håndterer ugyldig JSON fra LLM — returnerer tomme matches uden at kaste fejl', async () => {
    mockPrismaFindMany
      .mockResolvedValueOnce([{ id: 'c-1', name: 'Et Selskab', cvr: '55667788' }])
      .mockResolvedValueOnce([])

    mockComplete.mockResolvedValueOnce(
      makeClaudeTextResponse('Dette er ikke JSON, bare en forklaring', 200, 50)
    )

    const result = await runEntityMatching({
      extractedFields: {},
      organizationId: ORG_ID,
      documentText: 'Dokument',
    })

    expect(result.matches).toEqual([])
    expect(result.input_tokens).toBe(200)
    expect(result.output_tokens).toBe(50)
  })

  it('matcher person når fuldt navn fremgår af dokumenttekst', async () => {
    mockPrismaFindMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 'person-1', first_name: 'Maria', last_name: 'Jensen' }])

    const matchJson = JSON.stringify([
      {
        entity_type: 'person',
        entity_id: 'person-1',
        entity_name: 'Maria Jensen',
        confidence: 0.88,
        match_reason: 'Fuldt navn fundet i dokumenttekst',
      },
    ])
    mockComplete.mockResolvedValueOnce(makeClaudeTextResponse(matchJson))

    const result = await runEntityMatching({
      extractedFields: {},
      organizationId: ORG_ID,
      documentText: 'Kontrakten indgås med Maria Jensen som lokal partner.',
    })

    expect(result.matches).toHaveLength(1)
    expect(result.matches[0]).toMatchObject({
      entity_type: 'person',
      entity_id: 'person-1',
      entity_name: 'Maria Jensen',
    })
  })

  it('returnerer cache-tokens i result', async () => {
    mockPrismaFindMany
      .mockResolvedValueOnce([{ id: 'c-1', name: 'Cached Corp', cvr: '12341234' }])
      .mockResolvedValueOnce([])

    mockComplete.mockResolvedValueOnce({
      id: 'resp-cache',
      model: 'gpt-5-nano',
      stop_reason: 'end_turn',
      content: [{ type: 'text', text: '[]' }],
      usage: {
        input_tokens: 400,
        output_tokens: 60,
        cache_read_input_tokens: 350,
        cache_creation_input_tokens: 50,
      },
    })

    const result = await runEntityMatching({
      extractedFields: {},
      organizationId: ORG_ID,
      documentText: 'Dokument med caching',
    })

    expect(result.cache_read_tokens).toBe(350)
    expect(result.cache_write_tokens).toBe(50)
  })
})
