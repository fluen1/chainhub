import { describe, it, expect } from 'vitest'
import { getDashboardData } from '@/actions/dashboard'

// Smoke test: uses seed-brugeren philip@chainhub.dk via org-id
// Kræver at local database er seeded med `npx prisma db seed`.
describe.runIf(!!process.env.DATABASE_URL)('getDashboardData', () => {
  const seedUserId = '00000000-0000-0000-0000-000000010001'
  const seedOrgId = '00000000-0000-0000-0000-000000009001'

  it('returnerer DashboardData shape', async () => {
    const data = await getDashboardData(seedUserId, seedOrgId)
    expect(data).toHaveProperty('badges')
    expect(data).toHaveProperty('inlineKpis')
    expect(data.timelineSections).toHaveLength(4)
    expect(data.coverage).toHaveLength(4)
    expect(data.role).toBeDefined()
  })

  it('håndterer bruger uden selskaber', async () => {
    const data = await getDashboardData('nonexistent-user-id', seedOrgId)
    expect(data.heatmap).toHaveLength(0)
    expect(data.timelineSections.every((s) => s.items.length === 0)).toBe(true)
  })
})
