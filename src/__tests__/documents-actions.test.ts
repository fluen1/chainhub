import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({
  auth: vi.fn().mockResolvedValue({
    user: { id: 'user-1', organizationId: 'org-1' },
  }),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    document: {
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
      findFirst: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
    },
    documentExtraction: {
      findFirst: vi.fn().mockResolvedValue(null),
    },
  },
}))

vi.mock('@/lib/permissions', () => ({
  canAccessCompany: vi.fn().mockResolvedValue(true),
  canAccessModule: vi.fn().mockResolvedValue(true),
  canAccessSensitivity: vi.fn().mockResolvedValue(true),
  getAccessibleCompanies: vi.fn().mockResolvedValue(['co-1']),
  getAllowedSensitivityLevels: vi.fn().mockResolvedValue(['PUBLIC', 'STANDARD', 'INTERN']),
}))

vi.mock('@/lib/rate-limit', () => ({
  checkActionRateLimit: vi.fn().mockResolvedValue({ limited: false }),
}))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

import { getDocumentEnrichment } from '@/actions/document-enrichment'
import {
  deleteDocument,
  getDocumentsPageData,
  submitDocumentForReview,
  reviewDocument,
  getDocumentReviewPageData,
} from '@/actions/documents'

const UUID = 'a1b2c3d4-e5f6-4789-9abc-def012345678'

describe('getDocumentsPageData', () => {
  beforeEach(() => vi.clearAllMocks())

  it('getDocumentsPageData begrænser WHERE til allowedSensitivity', async () => {
    const perms = await import('@/lib/permissions')
    const { prisma: mockPrisma } = await import('@/lib/db')
    vi.mocked(perms.getAllowedSensitivityLevels).mockResolvedValue(['PUBLIC', 'STANDARD', 'INTERN'])
    vi.mocked(perms.getAccessibleCompanies).mockResolvedValue(['co-1'])
    vi.mocked(mockPrisma.document.findMany).mockResolvedValue([])
    vi.mocked(mockPrisma.document.count).mockResolvedValue(0)

    await getDocumentsPageData(1, 25)

    const where = vi.mocked(mockPrisma.document.findMany).mock.calls[0]?.[0]?.where as Record<
      string,
      unknown
    >
    expect(where.sensitivity).toEqual({ in: ['PUBLIC', 'STANDARD', 'INTERN'] })
  })
})

describe('deleteDocument', () => {
  beforeEach(() => vi.clearAllMocks())

  it('happy path med company_id soft-sletter', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.document.findFirst).mockImplementation((() =>
      Promise.resolve({ id: UUID, company_id: UUID })) as never)
    const result = await deleteDocument(UUID)
    expect('data' in result).toBe(true)
    expect(prisma.document.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { deleted_at: expect.any(Date) } })
    )
  })

  it('afviser uden company-adgang', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.document.findFirst).mockImplementation((() =>
      Promise.resolve({ id: UUID, company_id: UUID })) as never)
    const perms = await import('@/lib/permissions')
    vi.mocked(perms.canAccessCompany).mockResolvedValueOnce(false)
    const result = await deleteDocument(UUID)
    expect('error' in result).toBe(true)
  })

  it('returnerer fejl hvis dokument ikke findes', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.document.findFirst).mockImplementation((() => Promise.resolve(null)) as never)
    const result = await deleteDocument(UUID)
    expect('error' in result).toBe(true)
  })

  it('soft-sletter dokument uden company_id uden permission-check', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.document.findFirst).mockImplementation((() =>
      Promise.resolve({ id: UUID, company_id: null })) as never)
    const perms = await import('@/lib/permissions')
    const result = await deleteDocument(UUID)
    expect('data' in result).toBe(true)
    expect(perms.canAccessCompany).not.toHaveBeenCalled()
  })

  it('deleteDocument afviser når brugeren ikke kan se dokumentets sensitivity', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.document.findFirst).mockImplementation((() =>
      Promise.resolve({
        id: UUID,
        company_id: null,
        sensitivity: 'STRENGT_FORTROLIG',
      })) as never)
    const perms = await import('@/lib/permissions')
    vi.mocked(perms.canAccessSensitivity).mockResolvedValueOnce(false)

    const res = await deleteDocument(UUID)

    expect(res).toEqual({ error: 'Ingen adgang til dette dokument' })
    expect(prisma.document.update).not.toHaveBeenCalled()
  })
})

// ─── Negative sensitivity-tests ───────────────────────────────────────────────
// Disse tests verificerer at sensitivity-checket er load-bearing:
// de SKAL fejle hvis canAccessSensitivity-checket fjernes fra den pågældende action.

describe('submitDocumentForReview — sensitivity-afvisning', () => {
  beforeEach(() => vi.clearAllMocks())

  it('afviser submitDocumentForReview når canAccessSensitivity returnerer false', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.document.findFirst).mockImplementation((() =>
      Promise.resolve({
        id: UUID,
        company_id: null,
        status: 'KLADDE',
        sensitivity: 'STRENGT_FORTROLIG',
      })) as never)
    const perms = await import('@/lib/permissions')
    vi.mocked(perms.canAccessSensitivity).mockResolvedValueOnce(false)

    const result = await submitDocumentForReview({ documentId: UUID })

    expect(result).toMatchObject({ error: expect.any(String) })
    expect(prisma.document.update).not.toHaveBeenCalled()
  })
})

describe('reviewDocument — sensitivity-afvisning', () => {
  beforeEach(() => vi.clearAllMocks())

  it('afviser reviewDocument når canAccessSensitivity returnerer false', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.document.findFirst).mockImplementation((() =>
      Promise.resolve({
        id: UUID,
        company_id: null,
        status: 'TIL_REVIEW',
        sensitivity: 'STRENGT_FORTROLIG',
      })) as never)
    const perms = await import('@/lib/permissions')
    vi.mocked(perms.canAccessSensitivity).mockResolvedValueOnce(false)

    const result = await reviewDocument({ documentId: UUID, decision: 'GODKENDT' })

    expect(result).toMatchObject({ error: expect.any(String) })
    expect(prisma.document.update).not.toHaveBeenCalled()
  })
})

describe('getDocumentReviewPageData — sensitivity-afvisning', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returnerer null fra getDocumentReviewPageData når canAccessSensitivity returnerer false', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.document.findFirst).mockImplementation((() =>
      Promise.resolve({
        id: UUID,
        company_id: null,
        sensitivity: 'STRENGT_FORTROLIG',
        file_name: 'test.pdf',
        title: 'Test',
        organization_id: 'org-1',
        deleted_at: null,
        company: null,
        extraction: null,
        contract: null,
        case: null,
      })) as never)
    const perms = await import('@/lib/permissions')
    vi.mocked(perms.canAccessSensitivity).mockResolvedValueOnce(false)

    const result = await getDocumentReviewPageData(UUID)

    expect(result).toBeNull()
  })
})

describe('getDocumentEnrichment — sensitivity-afvisning', () => {
  beforeEach(() => vi.clearAllMocks())

  it('afviser getDocumentEnrichment når canAccessSensitivity returnerer false', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.document.findFirst).mockImplementation((() =>
      Promise.resolve({
        id: UUID,
        company_id: null,
        sensitivity: 'STRENGT_FORTROLIG',
      })) as never)
    const perms = await import('@/lib/permissions')
    vi.mocked(perms.canAccessSensitivity).mockResolvedValueOnce(false)

    const result = await getDocumentEnrichment(UUID)

    expect(result).toMatchObject({ error: expect.any(String) })
  })
})
