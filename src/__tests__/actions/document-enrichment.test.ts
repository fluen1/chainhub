import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(async () => ({
    user: { id: 'user-1', organizationId: 'org-1' },
  })),
}))

vi.mock('@/lib/permissions', () => ({
  canAccessCompany: vi.fn(async () => true),
  canAccessSensitivity: vi.fn(async () => true),
  getAllowedSensitivityLevels: vi
    .fn()
    .mockResolvedValue(['PUBLIC', 'STANDARD', 'INTERN', 'FORTROLIG', 'STRENGT_FORTROLIG']),
}))

const { prismaMock, mockDocument, mockExtraction } = vi.hoisted(() => {
  const mockDocument = {
    id: 'doc-1',
    company_id: 'company-1',
  }

  const mockExtraction = {
    id: 'ext-1',
    detected_type: 'ANSAETTELSESKONTRAKT',
    type_confidence: 0.92,
    extracted_fields: {
      effective_date: { value: '2026-01-01', claude_confidence: 0.95 },
    },
    entity_matches: [
      {
        entity_type: 'company',
        entity_id: 'company-1',
        entity_name: 'Tandlæge Østerbro ApS',
        confidence: 0.9,
        match_reason: 'CVR-nummer matcher',
      },
    ],
    extraction_status: 'completed',
  }

  const prismaMock = {
    document: {
      findFirst: vi.fn(async () => mockDocument),
    },
    documentExtraction: {
      findFirst: vi.fn(async () => mockExtraction),
    },
  }

  return { prismaMock, mockDocument, mockExtraction }
})

vi.mock('@/lib/db', () => ({ prisma: prismaMock }))

import { getDocumentEnrichment } from '@/actions/document-enrichment'
import { auth } from '@/lib/auth'
import { canAccessCompany } from '@/lib/permissions'

describe('getDocumentEnrichment', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'user-1', organizationId: 'org-1' },
    } as never)
    vi.mocked(canAccessCompany).mockResolvedValue(true)
    prismaMock.document.findFirst.mockResolvedValue(mockDocument)
    prismaMock.documentExtraction.findFirst.mockResolvedValue(mockExtraction)
  })

  it('returnerer error uden session', async () => {
    vi.mocked(auth).mockResolvedValue(null)
    const result = await getDocumentEnrichment('doc-1')
    expect(result).toEqual({ error: 'Ikke autoriseret' })
  })

  it('returnerer error når dokument ikke findes', async () => {
    prismaMock.document.findFirst.mockResolvedValueOnce(null as never)
    const result = await getDocumentEnrichment('doc-missing')
    expect(result).toEqual({ error: 'Dokument ikke fundet' })
  })

  it('returnerer error uden selskabsadgang', async () => {
    vi.mocked(canAccessCompany).mockResolvedValueOnce(false)
    const result = await getDocumentEnrichment('doc-1')
    expect(result).toEqual({ error: 'Ingen adgang til dette dokument' })
  })

  it('returnerer null data når ingen ekstraktion findes', async () => {
    prismaMock.documentExtraction.findFirst.mockResolvedValueOnce(null as never)
    const result = await getDocumentEnrichment('doc-1')
    expect(result).toEqual({ data: null })
  })

  it('happy path: returnerer ekstraktion med entity matches', async () => {
    const result = await getDocumentEnrichment('doc-1')
    expect(result).toEqual({
      data: {
        extractionId: 'ext-1',
        detectedType: 'ANSAETTELSESKONTRAKT',
        typeConfidence: 0.92,
        extractedFields: {
          effective_date: { value: '2026-01-01', claude_confidence: 0.95 },
        },
        entityMatches: [
          {
            entity_type: 'company',
            entity_id: 'company-1',
            entity_name: 'Tandlæge Østerbro ApS',
            confidence: 0.9,
            match_reason: 'CVR-nummer matcher',
          },
        ],
        status: 'completed',
      },
    })
  })

  it('returnerer tom entityMatches ved ugyldig JSON-struktur', async () => {
    prismaMock.documentExtraction.findFirst.mockResolvedValueOnce({
      ...mockExtraction,
      entity_matches: 'not-an-array' as unknown as typeof mockExtraction.entity_matches,
    })
    const result = await getDocumentEnrichment('doc-1')
    expect(result.data?.entityMatches).toEqual([])
  })

  it('kalder ikke canAccessCompany for dokument uden company_id', async () => {
    prismaMock.document.findFirst.mockResolvedValueOnce({
      id: 'doc-1',
      company_id: null as unknown as string,
    })
    const result = await getDocumentEnrichment('doc-1')
    expect(canAccessCompany).not.toHaveBeenCalled()
    expect(result.data).not.toBeNull()
  })
})
