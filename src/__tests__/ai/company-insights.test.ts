import { describe, it, expect, vi, beforeEach } from 'vitest'
import { generateCompanyInsights, type CompanySnapshot } from '@/lib/ai/jobs/company-insights'

vi.mock('@/lib/ai/client', () => ({
  createClaudeClient: vi.fn(),
  computeCostUsd: vi.fn(() => 0.0123),
}))

import { createClaudeClient } from '@/lib/ai/client'

const mockSnapshot: CompanySnapshot = {
  company: {
    name: 'Testklinik',
    cvr: '12345678',
    city: 'Odense',
    status: 'Aktiv',
    founded_year: 2020,
    company_type: 'Tandlaege',
  },
  cluster: {
    name: 'Odense',
    peers: [{ name: 'Andre', omsaetning_2025: 3500000 }],
  },
  contracts: [],
  cases: [],
  finance: null,
  visits: { last_visit_date: null, days_since_last: null, planned_count: 0 },
  persons: [],
  documents: { total: 0, recently_uploaded: 0, awaiting_review: 0 },
}

describe('generateCompanyInsights', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returnerer valid result ved happy path', async () => {
    const mockComplete = vi.fn().mockResolvedValue({
      id: 'msg_1',
      model: 'claude-sonnet-4-20250514',
      stop_reason: 'end_turn',
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            alerts: [
              {
                severity: 'critical',
                title: 'Ejeraftale udloebet',
                sub: 'Dr. Petersen — frist overskredet',
                action_label: 'Se kontrakt',
                action_href: '/contracts/abc',
                roles: ['owner', 'legal'],
              },
            ],
            insight: {
              headline_md: '**Prioriter** ejeraftalen.',
              body_md: 'Uddybende forklaring her.',
            },
          }),
        },
      ],
      usage: { input_tokens: 100, output_tokens: 50 },
    })
    ;(createClaudeClient as ReturnType<typeof vi.fn>).mockReturnValue({
      complete: mockComplete,
      providerName: 'anthropic',
    })

    const result = await generateCompanyInsights(mockSnapshot)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.alerts).toHaveLength(1)
      expect(result.data.alerts[0].severity).toBe('critical')
      expect(result.data.insight?.headline_md).toContain('ejeraftalen')
      expect(result.cost_usd).toBe(0.0123)
      expect(result.model_name).toBe('claude-sonnet-4-20250514')
    }
  })

  it('haandterer JSON i markdown fence', async () => {
    const mockComplete = vi.fn().mockResolvedValue({
      id: 'msg_2',
      model: 'claude-sonnet-4-20250514',
      stop_reason: 'end_turn',
      content: [
        {
          type: 'text',
          text: '```json\n{"alerts":[],"insight":null}\n```',
        },
      ],
      usage: { input_tokens: 50, output_tokens: 10 },
    })
    ;(createClaudeClient as ReturnType<typeof vi.fn>).mockReturnValue({
      complete: mockComplete,
      providerName: 'anthropic',
    })

    const result = await generateCompanyInsights(mockSnapshot)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.alerts).toHaveLength(0)
      expect(result.data.insight).toBeNull()
    }
  })

  it('returnerer failure ved malformed JSON', async () => {
    const mockComplete = vi.fn().mockResolvedValue({
      id: 'msg_3',
      model: 'claude-sonnet-4-20250514',
      stop_reason: 'end_turn',
      content: [{ type: 'text', text: 'ikke-json-tekst' }],
      usage: { input_tokens: 50, output_tokens: 10 },
    })
    ;(createClaudeClient as ReturnType<typeof vi.fn>).mockReturnValue({
      complete: mockComplete,
      providerName: 'anthropic',
    })

    const result = await generateCompanyInsights(mockSnapshot)
    expect(result.ok).toBe(false)
  })

  it('returnerer failure ved schema mismatch', async () => {
    const mockComplete = vi.fn().mockResolvedValue({
      id: 'msg_4',
      model: 'claude-sonnet-4-20250514',
      stop_reason: 'end_turn',
      content: [
        {
          type: 'text',
          text: '{"alerts":[{"severity":"INVALID"}],"insight":null}',
        },
      ],
      usage: { input_tokens: 50, output_tokens: 10 },
    })
    ;(createClaudeClient as ReturnType<typeof vi.fn>).mockReturnValue({
      complete: mockComplete,
      providerName: 'anthropic',
    })

    const result = await generateCompanyInsights(mockSnapshot)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('Schema validation')
    }
  })

  it('returnerer failure ved client-fejl', async () => {
    ;(createClaudeClient as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new Error('API key missing')
    })

    const result = await generateCompanyInsights(mockSnapshot)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('API key')
    }
  })
})
