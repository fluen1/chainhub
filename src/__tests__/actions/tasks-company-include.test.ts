import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))
vi.mock('@/lib/db', () => ({
  prisma: {
    task: { findMany: vi.fn(), count: vi.fn() },
    company: { findMany: vi.fn() },
  },
}))
vi.mock('@/lib/permissions', () => ({
  canAccessModule: vi.fn().mockResolvedValue(true),
  getAccessibleCompanies: vi.fn().mockResolvedValue(['company-1']),
}))

import { getTasksPaginated } from '@/actions/tasks'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'

describe('getTasksPaginated — Task→Company relation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'user-1', organizationId: 'org-1', email: 'test@test.dk', name: 'Test' },
      expires: '2099-01-01',
    } as never)
    vi.mocked(prisma.task.findMany).mockResolvedValue([])
    vi.mocked(prisma.task.count).mockResolvedValue(0)
  })

  it('bruger include: { company: ... } og kalder IKKE company.findMany separat', async () => {
    await getTasksPaginated({})

    expect(prisma.company.findMany).not.toHaveBeenCalled()
    expect(prisma.task.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          company: expect.objectContaining({
            select: { id: true, name: true },
          }),
        }),
      })
    )
  })
})
