import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(async () => ({
    user: { id: 'user-1', organizationId: 'org-1' },
  })),
}))

vi.mock('@/lib/permissions', () => ({
  canAccessCompany: vi.fn(async () => true),
}))

const { prismaMock, mockExtraction, mockDocument } = vi.hoisted(() => {
  const mockDocument = {
    id: 'doc-1',
    organization_id: 'org-1',
    company_id: 'c-1',
    status: 'KLADDE',
    deleted_at: null,
  }
  const prismaMockDocument = {
    findFirst: vi.fn(async () => mockDocument),
    update: vi.fn(async () => mockDocument),
  }

  const mockExtraction = {
    id: 'ext-1',
    organization_id: 'org-1',
    schema_version: 'v1.0.0',
    prompt_version: 'v1',
    field_decisions: null,
    document: { company_id: 'company-1', deleted_at: null },
  }
  const prismaMock = {
    documentExtraction: {
      findFirst: vi.fn(async () => mockExtraction),
      update: vi.fn(async () => mockExtraction),
    },
    aIFieldCorrection: {
      create: vi.fn(async () => ({ id: 'corr-1' })),
    },
    document: prismaMockDocument,
  }
  return { prismaMock, mockExtraction, mockDocument }
})

vi.mock('@/lib/db', () => ({ prisma: prismaMock }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

import { saveFieldDecision } from '@/actions/document-review'

describe('saveFieldDecision — manualValue', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.documentExtraction.findFirst.mockResolvedValue(mockExtraction)
    prismaMock.documentExtraction.update.mockResolvedValue(mockExtraction)
    prismaMock.aIFieldCorrection.create.mockResolvedValue({ id: 'corr-1' })
  })

  it('gemmer manualValue som user_value ved decision=manual', async () => {
    const result = await saveFieldDecision({
      extractionId: 'ext-1',
      fieldName: 'effective_date',
      decision: 'manual',
      aiValue: '2026-01-01',
      existingValue: null,
      confidence: 0.65,
      manualValue: '2026-03-15',
    })

    expect(result).toEqual({ data: { correctionId: 'corr-1' } })
    expect(prismaMock.aIFieldCorrection.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          field_name: 'effective_date',
          ai_value: '2026-01-01',
          user_value: '2026-03-15',
        }),
      })
    )
  })

  it('gemmer manual_value i field_decisions JSON', async () => {
    await saveFieldDecision({
      extractionId: 'ext-1',
      fieldName: 'effective_date',
      decision: 'manual',
      aiValue: '2026-01-01',
      existingValue: null,
      confidence: 0.65,
      manualValue: '2026-03-15',
    })

    const calls = prismaMock.documentExtraction.update.mock.calls as unknown as Array<
      [{ data: { field_decisions: Record<string, Record<string, unknown>> } }]
    >
    const updateCall = calls[0]?.[0] as {
      data: { field_decisions: Record<string, Record<string, unknown>> }
    }
    expect(updateCall.data.field_decisions.effective_date).toMatchObject({
      decision: 'manual',
      manual_value: '2026-03-15',
    })
  })

  it('afviser manualValue længere end 1000 tegn', async () => {
    const result = await saveFieldDecision({
      extractionId: 'ext-1',
      fieldName: 'notes',
      decision: 'manual',
      aiValue: null,
      existingValue: null,
      confidence: 0.5,
      manualValue: 'x'.repeat(1001),
    })

    expect(result).toEqual({ error: 'Ugyldige parametre' })
    expect(prismaMock.aIFieldCorrection.create).not.toHaveBeenCalled()
  })
})

describe('rejectDocumentExtraction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.documentExtraction.findFirst.mockResolvedValue(mockExtraction)
    prismaMock.documentExtraction.update.mockResolvedValue(mockExtraction)
  })

  it('sætter extraction_status=rejected + reviewed_at + rejection-JSON', async () => {
    const { rejectDocumentExtraction } = await import('@/actions/document-review')
    const result = await rejectDocumentExtraction({
      extractionId: 'ext-1',
      reason: 'AI hallucinerede samtlige felter',
    })

    expect(result).toEqual({ data: undefined })
    const rejectCalls = prismaMock.documentExtraction.update.mock.calls as unknown as Array<
      [
        {
          where: { id: string }
          data: {
            extraction_status: string
            reviewed_by: string
            reviewed_at: Date
            field_decisions: Record<string, Record<string, unknown>>
          }
        },
      ]
    >
    const call = rejectCalls[0]![0]
    expect(call.where).toEqual({ id: 'ext-1' })
    expect(call.data.extraction_status).toBe('rejected')
    expect(call.data.reviewed_by).toBe('user-1')
    expect(call.data.reviewed_at).toBeInstanceOf(Date)
    expect(call.data.field_decisions.__rejection__).toMatchObject({
      rejected_by: 'user-1',
      reason: 'AI hallucinerede samtlige felter',
    })
  })

  it('reason valgfri — tom string normaliseres til null', async () => {
    const { rejectDocumentExtraction } = await import('@/actions/document-review')
    const result = await rejectDocumentExtraction({
      extractionId: 'ext-1',
      reason: '',
    })

    expect(result).toEqual({ data: undefined })
    const rejectCalls = prismaMock.documentExtraction.update.mock.calls as unknown as Array<
      [{ data: { field_decisions: Record<string, Record<string, unknown>> } }]
    >
    const call = rejectCalls[0]![0]
    expect(call.data.field_decisions.__rejection__).toMatchObject({
      reason: null,
    })
  })

  it('afviser reason længere end 500 tegn', async () => {
    const { rejectDocumentExtraction } = await import('@/actions/document-review')
    const result = await rejectDocumentExtraction({
      extractionId: 'ext-1',
      reason: 'x'.repeat(501),
    })

    expect(result).toEqual({ error: 'Ugyldige parametre' })
    expect(prismaMock.documentExtraction.update).not.toHaveBeenCalled()
  })

  it('returnerer error når extraction ikke findes', async () => {
    prismaMock.documentExtraction.findFirst.mockResolvedValueOnce(
      null as unknown as typeof mockExtraction
    )
    const { rejectDocumentExtraction } = await import('@/actions/document-review')
    const result = await rejectDocumentExtraction({
      extractionId: 'missing',
    })

    expect(result).toEqual({ error: 'Ekstraktion ikke fundet' })
  })
})

// ─── submitDocumentForReview ──────────────────────────────────────────────────

import { auth } from '@/lib/auth'
import { canAccessCompany } from '@/lib/permissions'
import { submitDocumentForReview, reviewDocument } from '@/actions/documents'

describe('submitDocumentForReview', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'user-1', organizationId: 'org-1' },
    } as never)
    prismaMock.document.findFirst.mockResolvedValue({ ...mockDocument, status: 'KLADDE' })
    prismaMock.document.update.mockResolvedValue({ ...mockDocument, status: 'TIL_REVIEW' })
    vi.mocked(canAccessCompany).mockResolvedValue(true)
  })

  it('returnerer error uden session', async () => {
    vi.mocked(auth).mockResolvedValue(null)
    const result = await submitDocumentForReview({ documentId: 'doc-1' })
    expect(result).toMatchObject({ error: expect.any(String) })
  })

  it('returnerer error ved ugyldigt input (manglende documentId)', async () => {
    const result = await submitDocumentForReview({})
    expect(result).toMatchObject({ error: 'Ugyldigt input' })
  })

  it('returnerer error når dokument ikke findes', async () => {
    prismaMock.document.findFirst.mockResolvedValueOnce(null as never)
    const result = await submitDocumentForReview({ documentId: 'doc-1' })
    expect(result).toMatchObject({ error: 'Dokument ikke fundet' })
  })

  it('returnerer error når status ikke er KLADDE', async () => {
    prismaMock.document.findFirst.mockResolvedValueOnce({ ...mockDocument, status: 'TIL_REVIEW' })
    const result = await submitDocumentForReview({ documentId: 'doc-1' })
    expect(result).toMatchObject({ error: 'Kun kladde-dokumenter kan sendes til godkendelse' })
  })

  it('returnerer error uden selskabsadgang', async () => {
    vi.mocked(canAccessCompany).mockResolvedValueOnce(false)
    const result = await submitDocumentForReview({ documentId: 'doc-1' })
    expect(result).toMatchObject({ error: 'Ingen adgang til dette dokument' })
  })

  it('happy path: sætter status til TIL_REVIEW', async () => {
    const result = await submitDocumentForReview({ documentId: 'doc-1' })
    expect(result).toEqual({ data: undefined })
    expect(prismaMock.document.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'doc-1' },
        data: expect.objectContaining({ status: 'TIL_REVIEW' }),
      })
    )
  })

  it('kalder ikke canAccessCompany for dokument uden company_id', async () => {
    prismaMock.document.findFirst.mockResolvedValueOnce({
      ...mockDocument,
      company_id: null as never,
      status: 'KLADDE',
    })
    const result = await submitDocumentForReview({ documentId: 'doc-1' })
    expect(result).toEqual({ data: undefined })
    expect(canAccessCompany).not.toHaveBeenCalled()
  })
})

// ─── reviewDocument ───────────────────────────────────────────────────────────

describe('reviewDocument', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'user-1', organizationId: 'org-1' },
    } as never)
    prismaMock.document.findFirst.mockResolvedValue({ ...mockDocument, status: 'TIL_REVIEW' })
    prismaMock.document.update.mockResolvedValue({ ...mockDocument, status: 'GODKENDT' })
    vi.mocked(canAccessCompany).mockResolvedValue(true)
  })

  it('returnerer error uden session', async () => {
    vi.mocked(auth).mockResolvedValue(null)
    const result = await reviewDocument({ documentId: 'doc-1', decision: 'GODKENDT' })
    expect(result).toMatchObject({ error: expect.any(String) })
  })

  it('returnerer error ved ugyldigt input (ugyldig decision)', async () => {
    const result = await reviewDocument({ documentId: 'doc-1', decision: 'UKENDT' })
    expect(result).toMatchObject({ error: 'Ugyldigt input' })
  })

  it('returnerer error når dokument ikke findes', async () => {
    prismaMock.document.findFirst.mockResolvedValueOnce(null as never)
    const result = await reviewDocument({ documentId: 'doc-1', decision: 'GODKENDT' })
    expect(result).toMatchObject({ error: 'Dokument ikke fundet' })
  })

  it('returnerer error når status ikke er TIL_REVIEW', async () => {
    prismaMock.document.findFirst.mockResolvedValueOnce({ ...mockDocument, status: 'KLADDE' })
    const result = await reviewDocument({ documentId: 'doc-1', decision: 'GODKENDT' })
    expect(result).toMatchObject({ error: 'Kun dokumenter til godkendelse kan reviewes' })
  })

  it('returnerer error uden selskabsadgang', async () => {
    vi.mocked(canAccessCompany).mockResolvedValueOnce(false)
    const result = await reviewDocument({ documentId: 'doc-1', decision: 'GODKENDT' })
    expect(result).toMatchObject({ error: 'Ingen adgang til dette dokument' })
  })

  it('happy path godkend: sætter status=GODKENDT + reviewed_at + reviewed_by', async () => {
    const result = await reviewDocument({ documentId: 'doc-1', decision: 'GODKENDT' })
    expect(result).toEqual({ data: undefined })
    expect(prismaMock.document.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'doc-1' },
        data: expect.objectContaining({
          status: 'GODKENDT',
          reviewed_at: expect.any(Date),
          reviewed_by: 'user-1',
        }),
      })
    )
  })

  it('happy path afvis: sætter status=AFVIST', async () => {
    prismaMock.document.findFirst.mockResolvedValueOnce({ ...mockDocument, status: 'TIL_REVIEW' })
    const result = await reviewDocument({
      documentId: 'doc-1',
      decision: 'AFVIST',
      comment: 'Mangler bilag',
    })
    expect(result).toEqual({ data: undefined })
    expect(prismaMock.document.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'AFVIST',
          review_comment: 'Mangler bilag',
        }),
      })
    )
  })

  it('sætter review_comment=null når comment er tom streng', async () => {
    const result = await reviewDocument({ documentId: 'doc-1', decision: 'GODKENDT', comment: '' })
    expect(result).toEqual({ data: undefined })
    expect(prismaMock.document.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ review_comment: null }),
      })
    )
  })
})
