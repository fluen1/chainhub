import { describe, it, expect, vi, beforeEach } from 'vitest'

// vi.mock er hoisted — brug vi.hoisted() til at definere mocks FØR imports
const { prismaMock, mockDocument } = vi.hoisted(() => {
  const mockDocument = {
    id: '11111111-1111-1111-1111-111111111111',
    organization_id: 'org-1',
    company_id: 'c1',
    title: 'Kontrakt.pdf',
    file_name: 'kontrakt.pdf',
    file_size_bytes: 102400,
    file_url: 'https://storage.example.com/kontrakt.pdf',
    uploaded_at: new Date('2026-05-01'),
    deleted_at: null,
    contract_id: null,
    case_id: null,
    created_by: 'u1',
    created_at: new Date('2026-05-01'),
    updated_at: new Date('2026-05-01'),
    company: { id: 'c1', name: 'Klinik A' },
    contract: null,
    case: null,
    extraction: null,
  }

  const prismaMock = {
    document: {
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue(mockDocument),
      create: vi.fn().mockResolvedValue(mockDocument),
      update: vi.fn().mockResolvedValue(mockDocument),
      count: vi.fn().mockResolvedValue(0),
    },
    company: {
      findMany: vi.fn().mockResolvedValue([{ id: 'c1', name: 'Klinik A' }]),
    },
  }

  return { prismaMock, mockDocument }
})

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))
vi.mock('@/lib/db', () => ({ prisma: prismaMock }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/logger', () => ({ captureError: vi.fn() }))
vi.mock('@/lib/rate-limit', () => ({
  checkActionRateLimit: vi.fn().mockResolvedValue({ limited: false }),
}))
vi.mock('@/lib/permissions', () => ({
  canAccessCompany: vi.fn().mockResolvedValue(true),
  canAccessModule: vi.fn().mockResolvedValue(true),
  getAccessibleCompanies: vi.fn().mockResolvedValue(['c1']),
}))

import { auth } from '@/lib/auth'
import { canAccessCompany, canAccessModule } from '@/lib/permissions'
import {
  getDocumentsPageData,
  getDocumentUploadCompanies,
  getDocumentReviewPageData,
  getDocumentTitle,
  deleteDocument,
} from '@/actions/documents'

const SESSION = {
  user: { id: 'u1', organizationId: 'org-1', email: 'test@test.dk', name: 'Test' },
  expires: '',
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(auth).mockResolvedValue(SESSION as never)
  prismaMock.document.findFirst.mockResolvedValue(mockDocument)
  prismaMock.document.findMany.mockResolvedValue([])
  prismaMock.document.update.mockResolvedValue(mockDocument)
  prismaMock.company.findMany.mockResolvedValue([{ id: 'c1', name: 'Klinik A' }])
  vi.mocked(canAccessCompany).mockResolvedValue(true)
  vi.mocked(canAccessModule).mockResolvedValue(true)
})

// ─── getDocumentUploadCompanies ───────────────────────────────────────────────

describe('getDocumentUploadCompanies', () => {
  it('returnerer tom array uden session', async () => {
    vi.mocked(auth).mockResolvedValue(null)
    const result = await getDocumentUploadCompanies()
    expect(result).toEqual([])
  })

  it('returnerer tom array uden modul-adgang', async () => {
    vi.mocked(canAccessModule).mockResolvedValueOnce(false)
    const result = await getDocumentUploadCompanies()
    expect(result).toEqual([])
  })

  it('returnerer selskaber med korrekt organization_id-filter', async () => {
    prismaMock.company.findMany.mockResolvedValueOnce([{ id: 'c1', name: 'Klinik A' }])
    const result = await getDocumentUploadCompanies()
    expect(result).toHaveLength(1)
    expect(prismaMock.company.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ organization_id: 'org-1' }),
      })
    )
  })
})

// ─── getDocumentsPageData ─────────────────────────────────────────────────────

describe('getDocumentsPageData', () => {
  it('returnerer tom array uden session', async () => {
    vi.mocked(auth).mockResolvedValue(null)
    const result = await getDocumentsPageData()
    expect(result).toEqual([])
  })

  it('returnerer tom array uden modul-adgang', async () => {
    vi.mocked(canAccessModule).mockResolvedValueOnce(false)
    const result = await getDocumentsPageData()
    expect(result).toEqual([])
  })

  it('returnerer DocRow-array med korrekt struktur', async () => {
    prismaMock.document.findMany.mockResolvedValueOnce([mockDocument])
    const result = await getDocumentsPageData()
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      id: mockDocument.id,
      navn: 'kontrakt.pdf',
      selskab: 'Klinik A',
      aiStatus: 'Ikke AI',
    })
  })

  it('inkluderer organization_id i where-klausulen', async () => {
    await getDocumentsPageData()
    const whereArg = prismaMock.document.findMany.mock.calls[0]?.[0]?.where
    expect(whereArg?.organization_id).toBe('org-1')
  })

  it('formaterer filstørrelse korrekt (KB)', async () => {
    const docKb = { ...mockDocument, file_size_bytes: 2048 }
    prismaMock.document.findMany.mockResolvedValueOnce([docKb])
    const result = await getDocumentsPageData()
    expect(result[0]?.size).toBe('2 KB')
  })

  it('returnerer "Ikke AI" aiStatus når extraction mangler', async () => {
    prismaMock.document.findMany.mockResolvedValueOnce([{ ...mockDocument, extraction: null }])
    const result = await getDocumentsPageData()
    expect(result[0]?.aiStatus).toBe('Ikke AI')
  })

  it('returnerer "AI ✓" aiStatus når extraction er completed og reviewed', async () => {
    const docWithExtraction = {
      ...mockDocument,
      extraction: {
        extraction_status: 'completed',
        reviewed_at: new Date(),
        agreement_score: 0.92,
        extracted_fields: {},
      },
    }
    prismaMock.document.findMany.mockResolvedValueOnce([docWithExtraction])
    const result = await getDocumentsPageData()
    expect(result[0]?.aiStatus).toBe('AI ✓')
    expect(result[0]?.konf).toBe(92)
  })

  it('returnerer "Afventer" aiStatus når extraction er pending', async () => {
    const docPending = {
      ...mockDocument,
      extraction: {
        extraction_status: 'pending',
        reviewed_at: null,
        agreement_score: null,
        extracted_fields: {},
      },
    }
    prismaMock.document.findMany.mockResolvedValueOnce([docPending])
    const result = await getDocumentsPageData()
    expect(result[0]?.aiStatus).toBe('Afventer')
  })
})

// ─── getDocumentReviewPageData ────────────────────────────────────────────────

describe('getDocumentReviewPageData', () => {
  const validId = '11111111-1111-1111-1111-111111111111'

  it('returnerer null uden session', async () => {
    vi.mocked(auth).mockResolvedValue(null)
    const result = await getDocumentReviewPageData(validId)
    expect(result).toBeNull()
  })

  it('returnerer null når dokument ikke findes', async () => {
    prismaMock.document.findFirst.mockResolvedValueOnce(null)
    const result = await getDocumentReviewPageData(validId)
    expect(result).toBeNull()
  })

  it('returnerer null uden selskabsadgang', async () => {
    const docWithCompany = {
      ...mockDocument,
      company_id: 'c1',
      company: { name: 'Klinik A' },
      contract: null,
      case: null,
      extraction: null,
    }
    prismaMock.document.findFirst.mockResolvedValueOnce(docWithCompany)
    vi.mocked(canAccessCompany).mockResolvedValueOnce(false)

    const result = await getDocumentReviewPageData(validId)
    expect(result).toBeNull()
  })

  it('returnerer pagedata med doc og reviewQueue', async () => {
    const fullDoc = {
      ...mockDocument,
      company: { name: 'Klinik A' },
      contract: null,
      case: null,
      extraction: null,
    }
    prismaMock.document.findFirst.mockResolvedValueOnce(fullDoc)
    prismaMock.document.findMany.mockResolvedValueOnce([])

    const result = await getDocumentReviewPageData(validId)
    expect(result).not.toBeNull()
    expect(result?.doc.id).toBe(validId)
    expect(result?.reviewQueue).toEqual([])
  })
})

// ─── getDocumentTitle ─────────────────────────────────────────────────────────

describe('getDocumentTitle', () => {
  it('returnerer "Review" uden session', async () => {
    vi.mocked(auth).mockResolvedValue(null)
    const result = await getDocumentTitle('d1')
    expect(result).toBe('Review')
  })

  it('returnerer "Review · dokument" hvis dokument ikke findes', async () => {
    prismaMock.document.findFirst.mockResolvedValueOnce(null)
    const result = await getDocumentTitle('d1')
    expect(result).toBe('Review · dokument')
  })

  it('returnerer "Review · {filnavn}" ved gyldig session + dokument', async () => {
    prismaMock.document.findFirst.mockResolvedValueOnce({
      file_name: 'kontrakt.pdf',
      title: 'Kontrakt',
    })
    const result = await getDocumentTitle('d1')
    expect(result).toBe('Review · kontrakt.pdf')
  })
})

// ─── deleteDocument ───────────────────────────────────────────────────────────

describe('deleteDocument', () => {
  const validId = '11111111-1111-1111-1111-111111111111'

  it('returnerer error uden session', async () => {
    vi.mocked(auth).mockResolvedValue(null)
    const result = await deleteDocument(validId)
    expect(result).toMatchObject({ error: expect.any(String) })
  })

  it('returnerer error ved ugyldigt UUID-format', async () => {
    const result = await deleteDocument('ikke-et-uuid')
    expect(result).toMatchObject({ error: expect.any(String) })
  })

  it('returnerer error når dokument ikke findes', async () => {
    prismaMock.document.findFirst.mockResolvedValueOnce(null)
    const result = await deleteDocument(validId)
    expect(result).toMatchObject({ error: expect.any(String) })
  })

  it('returnerer error uden selskabsadgang', async () => {
    vi.mocked(canAccessCompany).mockResolvedValueOnce(false)
    const result = await deleteDocument(validId)
    expect(result).toMatchObject({ error: expect.any(String) })
  })

  it('returnerer error ved rate-limit', async () => {
    const { checkActionRateLimit } = await import('@/lib/rate-limit')
    vi.mocked(checkActionRateLimit).mockResolvedValueOnce({ limited: true })
    const result = await deleteDocument(validId)
    expect(result).toMatchObject({ error: expect.any(String) })
  })

  it('soft-sletter dokument med korrekt where-klausul', async () => {
    const result = await deleteDocument(validId)
    expect(result).toMatchObject({ data: undefined })
    expect(prismaMock.document.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: validId },
        data: expect.objectContaining({ deleted_at: expect.any(Date) }),
      })
    )
  })

  it('tenant-isolation: finder kun dokument i egen organisation', async () => {
    await deleteDocument(validId)
    const whereArg = prismaMock.document.findFirst.mock.calls[0]?.[0]?.where
    expect(whereArg?.organization_id).toBe('org-1')
  })

  it('tillader sletning af dokument uden selskabstilknytning (org-niveau)', async () => {
    const docWithoutCompany = { ...mockDocument, company_id: null }
    prismaMock.document.findFirst.mockResolvedValueOnce(docWithoutCompany)

    const result = await deleteDocument(validId)
    expect(result).toMatchObject({ data: undefined })
    // canAccessCompany skal ikke kaldes når company_id er null
    expect(canAccessCompany).not.toHaveBeenCalled()
  })
})
