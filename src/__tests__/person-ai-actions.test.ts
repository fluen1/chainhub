import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({
  auth: vi.fn().mockResolvedValue({
    user: { id: 'user-1', organizationId: 'org-1' },
  }),
}))

vi.mock('@/lib/permissions', () => ({
  canAccessCompany: vi.fn().mockResolvedValue(true),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    contractParty: { findMany: vi.fn() },
  },
}))

vi.mock('@/lib/logger', () => ({
  createLogger: vi.fn(() => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
  captureError: vi.fn(),
}))

import { getPersonAIExtractions } from '@/actions/person-ai'

describe('getPersonAIExtractions', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returnerer tom liste hvis ingen contract-parties', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.contractParty.findMany).mockImplementation((() =>
      Promise.resolve([])) as never)
    const result = await getPersonAIExtractions('p-1')
    expect('data' in result && result.data).toEqual([])
  })

  it('springer contracts uden extraction over', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.contractParty.findMany).mockImplementation((() =>
      Promise.resolve([
        {
          contract: {
            id: 'c-1',
            display_name: 'Test kontrakt',
            system_type: 'ANSAETTELSE_FUNKTIONAER',
            deleted_at: null,
            company_id: 'co-1',
            company: { id: 'co-1', name: 'Acme' },
            documents: [],
          },
        },
      ])) as never)
    const result = await getPersonAIExtractions('p-1')
    expect('data' in result && result.data).toEqual([])
  })

  it('normaliserer extracted_fields-JSON', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.contractParty.findMany).mockImplementation((() =>
      Promise.resolve([
        {
          contract: {
            id: 'c-1',
            display_name: 'Ansættelsesaftale',
            system_type: 'ANSAETTELSE_FUNKTIONAER',
            deleted_at: null,
            company_id: 'co-1',
            company: { id: 'co-1', name: 'Acme' },
            documents: [
              {
                id: 'd-1',
                deleted_at: null,
                extraction: {
                  id: 'ext-1',
                  detected_type: 'ANSAETTELSE_FUNKTIONAER',
                  created_at: new Date('2026-04-01'),
                  extracted_fields: {
                    salary_monthly_dkk: {
                      value: 45000,
                      claude_confidence: 0.92,
                      source_page: 1,
                      source_text: 'Månedlig grundløn er 45.000 DKK',
                    },
                    non_compete: {
                      value: null,
                      claude_confidence: 0.5,
                      source_page: null,
                      source_text: null,
                    },
                  },
                },
              },
            ],
          },
        },
      ])) as never)
    const result = await getPersonAIExtractions('p-1')
    if ('data' in result && result.data) {
      expect(result.data).toHaveLength(1)
      expect(result.data[0]!.fields.salary_monthly_dkk?.value).toBe(45000)
      expect(result.data[0]!.fields.salary_monthly_dkk?.confidence).toBeCloseTo(0.92)
      expect(result.data[0]!.fields.non_compete?.confidence).toBe(0.5)
    } else {
      throw new Error('Forventede data, fik fejl')
    }
  })

  it('filtrerer extractions uden company-adgang', async () => {
    const perms = await import('@/lib/permissions')
    vi.mocked(perms.canAccessCompany).mockResolvedValueOnce(false)
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.contractParty.findMany).mockImplementation((() =>
      Promise.resolve([
        {
          contract: {
            id: 'c-1',
            display_name: 'Hemmeligt',
            system_type: 'ANSAETTELSE_FUNKTIONAER',
            deleted_at: null,
            company_id: 'co-forbidden',
            company: { id: 'co-forbidden', name: 'Forbidden' },
            documents: [
              {
                id: 'd-1',
                deleted_at: null,
                extraction: { id: 'ext-1', extracted_fields: {} },
              },
            ],
          },
        },
      ])) as never)
    const result = await getPersonAIExtractions('p-1')
    expect('data' in result && result.data).toEqual([])
  })

  it('returnerer fejl uden session', async () => {
    const auth = await import('@/lib/auth')
    vi.mocked(auth.auth).mockResolvedValueOnce(null)
    const result = await getPersonAIExtractions('p-1')
    expect(result).toEqual({ error: 'Ikke autoriseret' })
  })
})
