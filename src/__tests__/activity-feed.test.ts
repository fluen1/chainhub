import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  prisma: {
    auditLog: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    user: {
      findMany: vi.fn().mockResolvedValue([]),
    },
  },
}))

vi.mock('@/lib/permissions', () => ({
  getAccessibleCompanies: vi.fn().mockResolvedValue(['company-1', 'company-2']),
}))

import { getRecentActivity } from '@/actions/activity-feed'
import { getAccessibleCompanies } from '@/lib/permissions'

describe('getRecentActivity', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returnerer tom liste når ingen logs', async () => {
    const result = await getRecentActivity('org-1', 'user-1')
    expect(result).toEqual([])
  })

  it('bruger preloadedCompanyIds og kalder IKKE getAccessibleCompanies igen', async () => {
    const preloaded = ['company-a', 'company-b']

    await getRecentActivity('org-1', 'user-1', preloaded)

    // Med preloadedCompanyIds skal getAccessibleCompanies ikke kaldes
    expect(getAccessibleCompanies).not.toHaveBeenCalled()
  })

  it('kalder getAccessibleCompanies når ingen preloadedCompanyIds', async () => {
    await getRecentActivity('org-1', 'user-1')

    expect(getAccessibleCompanies).toHaveBeenCalledWith('user-1', 'org-1')
    expect(getAccessibleCompanies).toHaveBeenCalledTimes(1)
  })

  it('formaterer events korrekt med dansk verbum', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.auditLog.findMany).mockResolvedValue([
      {
        id: 'log-1',
        user_id: 'user-1',
        action: 'CREATE',
        resource_type: 'contract',
        resource_id: 'contract-1',
        created_at: new Date(),
      },
    ] as never)
    vi.mocked(prisma.user.findMany).mockResolvedValue([
      { id: 'user-1', name: 'Philip', email: 'philip@example.com' },
    ] as never)

    const result = await getRecentActivity('org-1', 'user-1', ['company-1'])

    expect(result).toHaveLength(1)
    expect(result[0].who).toBe('Philip')
    expect(result[0].action).toBe('oprettede')
    expect(result[0].target).toBe('Kontrakt')
  })
})

describe('getRecentActivity preload-eliminering', () => {
  beforeEach(() => vi.clearAllMocks())

  it('sparede DB-kald: to kald med preloaded = 0 ekstra getAccessibleCompanies', async () => {
    const preloaded = ['comp-1', 'comp-2', 'comp-3']

    await Promise.all([
      getRecentActivity('org-1', 'user-1', preloaded),
      getRecentActivity('org-1', 'user-1', preloaded),
    ])

    // Ingen af de to kald måtte have kaldt getAccessibleCompanies
    expect(getAccessibleCompanies).not.toHaveBeenCalled()
  })
})
