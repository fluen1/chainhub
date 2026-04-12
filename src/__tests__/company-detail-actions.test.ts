import { describe, it, expect, vi } from 'vitest'
import { getCompanyDetailData } from '@/actions/company-detail'

vi.mock('@/lib/ai/jobs/company-insights', () => ({
  generateCompanyInsights: vi.fn().mockResolvedValue({ ok: false, error: 'mocked' }),
}))

describe.runIf(!!process.env.DATABASE_URL)('getCompanyDetailData', () => {
  const seedUserId = '00000000-0000-0000-0000-000000010001'
  const seedOrgId = '00000000-0000-0000-0000-000000009001'

  it('returnerer null for selskab udenfor adgang', async () => {
    const result = await getCompanyDetailData('nonexistent-id', seedUserId, seedOrgId)
    expect(result).toBeNull()
  })

  it('returnerer CompanyDetailData shape for seed selskab', async () => {
    const { prisma } = await import('@/lib/db')
    const firstCompany = await prisma.company.findFirst({
      where: { organization_id: seedOrgId, deleted_at: null },
    })
    if (!firstCompany) return

    const result = await getCompanyDetailData(firstCompany.id, seedUserId, seedOrgId)
    expect(result).not.toBeNull()
    if (result) {
      expect(result.company.id).toBe(firstCompany.id)
      expect(result.visibleSections).toBeInstanceOf(Set)
      expect(result.healthDimensions).toHaveProperty('kontrakter')
      expect(result.statusBadge).toHaveProperty('label')
      // AI mocked til fejl: alerts og insight skal vaere tomme/null
      expect(result.alerts).toEqual([])
      expect(result.aiInsight).toBeNull()
    }
  })
})
