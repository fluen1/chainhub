import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getCompanyDetailData } from '@/actions/company-detail'
import { generateCompanyInsights } from '@/lib/ai/jobs/company-insights'
import { isAIEnabled } from '@/lib/ai/feature-flags'
import { checkCostCap } from '@/lib/ai/cost-cap'

vi.mock('@/lib/ai/jobs/company-insights', () => ({
  generateCompanyInsights: vi.fn().mockResolvedValue({ ok: false, error: 'mocked' }),
}))
vi.mock('@/lib/ai/feature-flags', () => ({
  isAIEnabled: vi.fn().mockResolvedValue(true),
}))
vi.mock('@/lib/ai/cost-cap', () => ({
  checkCostCap: vi.fn().mockResolvedValue({ allowed: true }),
}))

describe.runIf(!!process.env.DATABASE_URL)('getCompanyDetailData', () => {
  const seedUserId = '00000000-0000-0000-0000-000000000010'
  const seedOrgId = '00000000-0000-0000-0000-000000000001'

  beforeEach(() => {
    vi.mocked(generateCompanyInsights).mockClear()
    vi.mocked(isAIEnabled).mockResolvedValue(true)
    vi.mocked(checkCostCap).mockResolvedValue({ allowed: true })
  })

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

  it('skipper AI naar isAIEnabled=false', async () => {
    vi.mocked(isAIEnabled).mockResolvedValue(false)
    const { prisma } = await import('@/lib/db')
    const firstCompany = await prisma.company.findFirst({
      where: { organization_id: seedOrgId, deleted_at: null },
    })
    if (!firstCompany) return
    // Ryd cache for at tvinge regen-path
    await prisma.companyInsightsCache.deleteMany({ where: { company_id: firstCompany.id } })

    const result = await getCompanyDetailData(firstCompany.id, seedUserId, seedOrgId)
    expect(result).not.toBeNull()
    expect(generateCompanyInsights).not.toHaveBeenCalled()
    if (result) {
      expect(result.alerts).toEqual([])
      expect(result.aiInsight).toBeNull()
    }
  })

  it('skipper AI naar cost-cap exceeded', async () => {
    vi.mocked(isAIEnabled).mockResolvedValue(true)
    vi.mocked(checkCostCap).mockResolvedValue({ allowed: false, reason: 'cap exceeded' })
    const { prisma } = await import('@/lib/db')
    const firstCompany = await prisma.company.findFirst({
      where: { organization_id: seedOrgId, deleted_at: null },
    })
    if (!firstCompany) return
    await prisma.companyInsightsCache.deleteMany({ where: { company_id: firstCompany.id } })

    const result = await getCompanyDetailData(firstCompany.id, seedUserId, seedOrgId)
    expect(result).not.toBeNull()
    expect(generateCompanyInsights).not.toHaveBeenCalled()
    if (result) {
      expect(result.alerts).toEqual([])
      expect(result.aiInsight).toBeNull()
    }
  })
})
