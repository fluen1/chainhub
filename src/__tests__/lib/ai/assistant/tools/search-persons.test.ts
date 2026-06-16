import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Hoisted mocks ─────────────────────────────────────────────────────────────
const { prismaMock } = vi.hoisted(() => ({
  prismaMock: { person: { findMany: vi.fn() } },
}))
vi.mock('@/lib/db', () => ({ prisma: prismaMock }))
vi.mock('@/lib/permissions', () => ({
  getAccessibleCompanies: vi.fn().mockResolvedValue(['co-1']),
}))

import { searchPersonsTool } from '@/lib/ai/assistant/tools/search-persons'

const context = { organizationId: 'org-1', userId: 'user-1' }

describe('searchPersonsTool — RBAC company-scope', () => {
  beforeEach(() => vi.clearAllMocks())

  it('begrænser til personer uden tilknytning ELLER tilknyttet accessible companies', async () => {
    prismaMock.person.findMany.mockResolvedValue([])
    await searchPersonsTool.execute({}, context)
    const where = prismaMock.person.findMany.mock.calls[0]?.[0]?.where as Record<string, unknown>
    expect(where.AND).toEqual([
      {
        OR: [
          { company_persons: { none: {} } },
          { company_persons: { some: { company_id: { in: ['co-1'] }, deleted_at: null } } },
        ],
      },
    ])
  })
})
