import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  unstable_cache: (fn: Function) => fn,
}))

import { getDashboardData } from '@/actions/dashboard'
import { auth } from '@/lib/auth'

// Smoke test: uses seed-brugeren philip@chainhub.dk via org-id
// Kræver at local database er seeded med `npx prisma db seed`.
describe.runIf(!!process.env.DATABASE_URL)('getDashboardData', () => {
  const seedUserId = '00000000-0000-0000-0000-000000000010'
  const seedOrgId = '00000000-0000-0000-0000-000000000001'

  beforeEach(() => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: seedUserId, organizationId: seedOrgId },
    } as never)
  })

  it('returnerer DashboardData shape', async () => {
    const data = await getDashboardData()
    expect(data).toHaveProperty('badges')
    expect(data).toHaveProperty('inlineKpis')
    expect(data.timelineSections).toHaveLength(4)
    expect(data.coverage).toHaveLength(4)
    expect(data.role).toBeDefined()
  })

  it('håndterer bruger uden selskaber', async () => {
    vi.mocked(auth).mockResolvedValueOnce({
      user: { id: 'nonexistent-user-id', organizationId: seedOrgId },
    } as never)
    const data = await getDashboardData()
    expect(data.heatmap).toHaveLength(0)
    expect(data.timelineSections.every((s) => s.items.length === 0)).toBe(true)
  })
})
