import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Hoisted mocks ─────────────────────────────────────────────────────────────
const { prismaMock } = vi.hoisted(() => ({
  prismaMock: { company: { findMany: vi.fn() } },
}))
vi.mock('@/lib/db', () => ({ prisma: prismaMock }))
vi.mock('@/lib/permissions', () => ({
  getAccessibleCompanies: vi.fn().mockResolvedValue(['co-1', 'co-2']),
}))

import * as perms from '@/lib/permissions'
import { searchCompaniesTool } from '@/lib/ai/assistant/tools/search-companies'

const context = { organizationId: 'org-1', userId: 'user-1' }

describe('searchCompaniesTool — RBAC company-scope', () => {
  beforeEach(() => vi.clearAllMocks())

  it('begrænser til id: { in: accessibleCompanyIds }', async () => {
    prismaMock.company.findMany.mockResolvedValue([])
    await searchCompaniesTool.execute({}, context)
    const where = prismaMock.company.findMany.mock.calls[0]?.[0]?.where as Record<string, unknown>
    expect(where.id).toEqual({ in: ['co-1', 'co-2'] })
    expect(perms.getAccessibleCompanies).toHaveBeenCalledWith('user-1', 'org-1')
  })

  it('bruger uden company-adgang får tomt id-filter (ingen lækage)', async () => {
    vi.mocked(perms.getAccessibleCompanies).mockResolvedValueOnce([])
    prismaMock.company.findMany.mockResolvedValue([])
    await searchCompaniesTool.execute({ query: 'klinik' }, context)
    const where = prismaMock.company.findMany.mock.calls[0]?.[0]?.where as Record<string, unknown>
    expect(where.id).toEqual({ in: [] })
  })
})
