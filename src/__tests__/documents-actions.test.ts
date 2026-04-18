import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({
  auth: vi.fn().mockResolvedValue({
    user: { id: 'user-1', organizationId: 'org-1' },
  }),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    document: {
      findFirst: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
    },
  },
}))

vi.mock('@/lib/permissions', () => ({
  canAccessCompany: vi.fn().mockResolvedValue(true),
}))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

import { deleteDocument } from '@/actions/documents'

const UUID = 'a1b2c3d4-e5f6-4789-9abc-def012345678'

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
})
