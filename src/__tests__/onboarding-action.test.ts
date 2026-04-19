import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    organization: { findUnique: vi.fn() },
    company: { count: vi.fn() },
    contract: { count: vi.fn() },
    user: { count: vi.fn() },
  },
}))

vi.mock('@/lib/logger', () => ({
  captureError: vi.fn(),
  createLogger: vi.fn(() => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
}))

import { getOnboardingStatus } from '@/actions/onboarding'

const ORG_ID = 'org-1'

async function setMocks({
  session = { user: { id: 'user-1', organizationId: ORG_ID } } as unknown,
  orgCreatedDaysAgo = 2,
  companyCount = 0,
  contractCount = 0,
  userCount = 1,
}: Partial<{
  session: unknown
  orgCreatedDaysAgo: number
  companyCount: number
  contractCount: number
  userCount: number
}>) {
  const { auth } = await import('@/lib/auth')
  const { prisma } = await import('@/lib/db')
  vi.mocked(auth).mockResolvedValue(session as never)
  const created_at = new Date(Date.now() - orgCreatedDaysAgo * 24 * 60 * 60 * 1000)
  vi.mocked(prisma.organization.findUnique).mockResolvedValue({ created_at } as never)
  vi.mocked(prisma.company.count).mockResolvedValue(companyCount as never)
  vi.mocked(prisma.contract.count).mockResolvedValue(contractCount as never)
  vi.mocked(prisma.user.count).mockResolvedValue(userCount as never)
}

describe('getOnboardingStatus', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returnerer shouldShow=false når ingen session', async () => {
    const { auth } = await import('@/lib/auth')
    vi.mocked(auth).mockResolvedValue(null as never)
    const result = await getOnboardingStatus()
    expect(result.shouldShow).toBe(false)
    expect(result.completedCount).toBe(0)
    expect(result.totalCount).toBe(3)
  })

  it('happy path: ny org uden data → shouldShow=true, 0/3', async () => {
    await setMocks({ orgCreatedDaysAgo: 0, companyCount: 0, contractCount: 0, userCount: 1 })
    const result = await getOnboardingStatus()
    expect(result.shouldShow).toBe(true)
    expect(result.hasCompany).toBe(false)
    expect(result.hasContract).toBe(false)
    expect(result.hasAdditionalUser).toBe(false)
    expect(result.completedCount).toBe(0)
  })

  it('alle 3 steps done → shouldShow=false', async () => {
    await setMocks({ orgCreatedDaysAgo: 2, companyCount: 3, contractCount: 5, userCount: 4 })
    const result = await getOnboardingStatus()
    expect(result.hasCompany).toBe(true)
    expect(result.hasContract).toBe(true)
    expect(result.hasAdditionalUser).toBe(true)
    expect(result.completedCount).toBe(3)
    expect(result.shouldShow).toBe(false)
  })

  it('org > 14 dage gammel → shouldShow=false uanset progression', async () => {
    await setMocks({ orgCreatedDaysAgo: 20, companyCount: 0, contractCount: 0, userCount: 1 })
    const result = await getOnboardingStatus()
    expect(result.orgAgeInDays).toBeGreaterThanOrEqual(14)
    expect(result.shouldShow).toBe(false)
  })

  it('userCount > 1 tæller som hasAdditionalUser', async () => {
    await setMocks({ orgCreatedDaysAgo: 1, companyCount: 0, contractCount: 0, userCount: 2 })
    const result = await getOnboardingStatus()
    expect(result.hasAdditionalUser).toBe(true)
    expect(result.completedCount).toBe(1)
  })

  it('userCount = 1 (kun skaberen) tæller IKKE', async () => {
    await setMocks({ orgCreatedDaysAgo: 1, companyCount: 0, contractCount: 0, userCount: 1 })
    const result = await getOnboardingStatus()
    expect(result.hasAdditionalUser).toBe(false)
  })

  it('delvis progression: 1 selskab, ingen kontrakt → 1/3 og shouldShow=true', async () => {
    await setMocks({ orgCreatedDaysAgo: 5, companyCount: 1, contractCount: 0, userCount: 1 })
    const result = await getOnboardingStatus()
    expect(result.completedCount).toBe(1)
    expect(result.shouldShow).toBe(true)
  })

  it('fejl i prisma → returnerer sikker fallback med shouldShow=false', async () => {
    const { auth } = await import('@/lib/auth')
    const { prisma } = await import('@/lib/db')
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'u', organizationId: ORG_ID },
    } as never)
    vi.mocked(prisma.company.count).mockRejectedValue(new Error('db down') as never)
    const result = await getOnboardingStatus()
    expect(result.shouldShow).toBe(false)
    expect(result.completedCount).toBe(0)
  })
})
