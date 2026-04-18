import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({
  auth: vi.fn().mockResolvedValue({
    user: { id: 'user-1', organizationId: 'org-1' },
  }),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    documentExtraction: {
      findFirst: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
    },
  },
}))

vi.mock('@/lib/permissions', () => ({
  canAccessCompany: vi.fn().mockResolvedValue(true),
}))

vi.mock('@/lib/ai/feedback', () => ({
  logFieldCorrection: vi.fn().mockResolvedValue('corr-1'),
}))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

import { approveDocumentReview, saveFieldDecision } from '@/actions/document-review'

const UUID = 'a1b2c3d4-e5f6-4789-9abc-def012345678'

describe('approveDocumentReview', () => {
  beforeEach(() => vi.clearAllMocks())

  it('happy path godkender review', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.documentExtraction.findFirst).mockImplementation((() =>
      Promise.resolve({ id: UUID, document: { company_id: UUID, deleted_at: null } })) as never)
    const result = await approveDocumentReview(UUID)
    expect('data' in result).toBe(true)
  })

  it('afviser uden company-adgang', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.documentExtraction.findFirst).mockImplementation((() =>
      Promise.resolve({ id: UUID, document: { company_id: UUID, deleted_at: null } })) as never)
    const perms = await import('@/lib/permissions')
    vi.mocked(perms.canAccessCompany).mockResolvedValueOnce(false)
    const result = await approveDocumentReview(UUID)
    expect('error' in result).toBe(true)
  })

  it('returnerer fejl hvis ekstraktion ikke findes', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.documentExtraction.findFirst).mockImplementation((() =>
      Promise.resolve(null)) as never)
    const result = await approveDocumentReview(UUID)
    expect('error' in result).toBe(true)
  })

  it('returnerer fejl hvis dokument er slettet', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.documentExtraction.findFirst).mockImplementation((() =>
      Promise.resolve({
        id: UUID,
        document: { company_id: UUID, deleted_at: new Date() },
      })) as never)
    const result = await approveDocumentReview(UUID)
    expect('error' in result).toBe(true)
  })
})

describe('saveFieldDecision', () => {
  beforeEach(() => vi.clearAllMocks())

  const baseParams = {
    extractionId: UUID,
    fieldName: 'amount',
    aiValue: 100,
    existingValue: 50,
    confidence: 0.9,
  }

  it('use_ai logger correction og opdaterer field_decisions', async () => {
    const { prisma } = await import('@/lib/db')
    const feedback = await import('@/lib/ai/feedback')
    vi.mocked(prisma.documentExtraction.findFirst).mockImplementation((() =>
      Promise.resolve({
        id: UUID,
        document: { company_id: UUID, deleted_at: null },
        field_decisions: {},
        schema_version: 1,
        prompt_version: 1,
      })) as never)
    const result = await saveFieldDecision({ ...baseParams, decision: 'use_ai' })
    expect('data' in result).toBe(true)
    expect(feedback.logFieldCorrection).toHaveBeenCalledWith(
      expect.objectContaining({ user_value: 100 })
    )
  })

  it('keep_existing bruger existingValue som user_value', async () => {
    const { prisma } = await import('@/lib/db')
    const feedback = await import('@/lib/ai/feedback')
    vi.mocked(prisma.documentExtraction.findFirst).mockImplementation((() =>
      Promise.resolve({
        id: UUID,
        document: { company_id: UUID, deleted_at: null },
        field_decisions: {},
        schema_version: 1,
        prompt_version: 1,
      })) as never)
    await saveFieldDecision({ ...baseParams, decision: 'keep_existing' })
    expect(feedback.logFieldCorrection).toHaveBeenCalledWith(
      expect.objectContaining({ user_value: 50 })
    )
  })

  it('manual decision logger correction', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.documentExtraction.findFirst).mockImplementation((() =>
      Promise.resolve({
        id: UUID,
        document: { company_id: UUID, deleted_at: null },
        field_decisions: {},
        schema_version: 1,
        prompt_version: 1,
      })) as never)
    const result = await saveFieldDecision({ ...baseParams, decision: 'manual' })
    expect('data' in result).toBe(true)
  })

  it('afviser uden company-adgang', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.documentExtraction.findFirst).mockImplementation((() =>
      Promise.resolve({
        id: UUID,
        document: { company_id: UUID, deleted_at: null },
        field_decisions: {},
        schema_version: 1,
        prompt_version: 1,
      })) as never)
    const perms = await import('@/lib/permissions')
    vi.mocked(perms.canAccessCompany).mockResolvedValueOnce(false)
    const result = await saveFieldDecision({ ...baseParams, decision: 'use_ai' })
    expect('error' in result).toBe(true)
  })
})
