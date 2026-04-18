import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({
  auth: vi.fn().mockResolvedValue({
    user: { id: 'user-1', organizationId: 'org-1' },
  }),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    visit: {
      create: vi.fn().mockResolvedValue({ id: 'v-1' }),
      findFirst: vi.fn(),
      update: vi.fn().mockResolvedValue({ id: 'v-1' }),
    },
  },
}))

vi.mock('@/lib/permissions', () => ({
  canAccessCompany: vi.fn().mockResolvedValue(true),
}))

vi.mock('@/lib/logger', () => ({
  captureError: vi.fn(),
  createLogger: vi.fn(() => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
}))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

import { createVisit, updateVisit, deleteVisit } from '@/actions/visits'

const UUID = 'a1b2c3d4-e5f6-4789-9abc-def012345678'

describe('createVisit', () => {
  beforeEach(() => vi.clearAllMocks())

  const baseInput = {
    companyId: UUID,
    visitDate: '2026-04-20',
    visitType: 'KVARTALSBESOEG' as const,
  }

  it('happy path opretter besøg', async () => {
    const result = await createVisit(baseInput as never)
    expect('data' in result).toBe(true)
  })

  it('afviser uden company-adgang', async () => {
    const perms = await import('@/lib/permissions')
    vi.mocked(perms.canAccessCompany).mockResolvedValueOnce(false)
    const result = await createVisit(baseInput as never)
    expect('error' in result).toBe(true)
  })

  it('afviser invalid visitType', async () => {
    const result = await createVisit({ ...baseInput, visitType: 'UGYLDIG' } as never)
    expect('error' in result).toBe(true)
  })
})

describe('updateVisit', () => {
  beforeEach(() => vi.clearAllMocks())

  it('opdaterer status til GENNEMFOERT', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.visit.findFirst).mockImplementation((() =>
      Promise.resolve({ id: UUID, company_id: UUID })) as never)
    const result = await updateVisit({ visitId: UUID, status: 'GENNEMFOERT' } as never)
    expect('data' in result).toBe(true)
  })

  it('opdaterer notes', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.visit.findFirst).mockImplementation((() =>
      Promise.resolve({ id: UUID, company_id: UUID })) as never)
    const result = await updateVisit({ visitId: UUID, notes: 'Note' } as never)
    expect('data' in result).toBe(true)
    expect(prisma.visit.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { notes: 'Note' } })
    )
  })

  it('returnerer fejl hvis besøg ikke fundet', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.visit.findFirst).mockImplementation((() => Promise.resolve(null)) as never)
    const result = await updateVisit({ visitId: UUID, notes: 'X' } as never)
    expect('error' in result).toBe(true)
  })

  it('afviser uden company-adgang', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.visit.findFirst).mockImplementation((() =>
      Promise.resolve({ id: UUID, company_id: UUID })) as never)
    const perms = await import('@/lib/permissions')
    vi.mocked(perms.canAccessCompany).mockResolvedValueOnce(false)
    const result = await updateVisit({ visitId: UUID, notes: 'X' } as never)
    expect('error' in result).toBe(true)
  })
})

describe('deleteVisit', () => {
  beforeEach(() => vi.clearAllMocks())

  it('happy path soft-sletter', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.visit.findFirst).mockImplementation((() =>
      Promise.resolve({ id: UUID, company_id: UUID })) as never)
    const result = await deleteVisit(UUID)
    expect('data' in result).toBe(true)
    expect(prisma.visit.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { deleted_at: expect.any(Date) } })
    )
  })

  it('afviser uden company-adgang', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.visit.findFirst).mockImplementation((() =>
      Promise.resolve({ id: UUID, company_id: UUID })) as never)
    const perms = await import('@/lib/permissions')
    vi.mocked(perms.canAccessCompany).mockResolvedValueOnce(false)
    const result = await deleteVisit(UUID)
    expect('error' in result).toBe(true)
  })
})
