import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}))

import { auth } from '@/lib/auth'
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
    vi.mocked(auth).mockResolvedValue({
      user: { id: seedUserId, organizationId: seedOrgId },
    } as never)
  })

  it('returnerer null for selskab udenfor adgang', async () => {
    const result = await getCompanyDetailData('nonexistent-id')
    expect(result).toBeNull()
  })

  it('returnerer CompanyDetailData shape for seed selskab', async () => {
    const { prisma } = await import('@/lib/db')
    const firstCompany = await prisma.company.findFirst({
      where: { organization_id: seedOrgId, deleted_at: null },
    })
    if (!firstCompany) return

    const result = await getCompanyDetailData(firstCompany.id)
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

    const result = await getCompanyDetailData(firstCompany.id)
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

    const result = await getCompanyDetailData(firstCompany.id)
    expect(result).not.toBeNull()
    expect(generateCompanyInsights).not.toHaveBeenCalled()
    if (result) {
      expect(result.alerts).toEqual([])
      expect(result.aiInsight).toBeNull()
    }
  })

  // RBAC-regression: verificér at action respekterer sectionsForRole.
  describe('RBAC: sectionsForRole respekteres', () => {
    const financeTestUserId = '68cb1977-eb26-43d7-9a6a-9ce952d2dcfe'

    it('GROUP_FINANCE: contracts/cases/ownership tom (spec linje 139-156)', async () => {
      vi.mocked(auth).mockResolvedValueOnce({
        user: { id: financeTestUserId, organizationId: seedOrgId },
      } as never)
      const { prisma } = await import('@/lib/db')
      const user = await prisma.user.findFirst({ where: { id: financeTestUserId } })
      if (!user) return // skip når bruger ikke findes (CI uden manuel setup)

      const firstCompany = await prisma.company.findFirst({
        where: { organization_id: seedOrgId, deleted_at: null },
      })
      if (!firstCompany) return

      const result = await getCompanyDetailData(firstCompany.id)
      expect(result).not.toBeNull()
      if (result) {
        // GROUP_FINANCE må ikke se ownership/contracts/cases per spec
        expect(result.visibleSections.has('ownership')).toBe(false)
        expect(result.visibleSections.has('contracts')).toBe(false)
        expect(result.visibleSections.has('cases')).toBe(false)
        // Disse skal være tomme — uden top-array og 0 totalCount
        expect(result.ownership).toBeNull()
        expect(result.contracts.top).toEqual([])
        expect(result.contracts.totalCount).toBe(0)
        expect(result.cases.top).toEqual([])
        expect(result.cases.totalCount).toBe(0)
      }
    })

    it('GROUP_FINANCE: finance/persons/documents synlige', async () => {
      vi.mocked(auth).mockResolvedValueOnce({
        user: { id: financeTestUserId, organizationId: seedOrgId },
      } as never)
      const { prisma } = await import('@/lib/db')
      const user = await prisma.user.findFirst({ where: { id: financeTestUserId } })
      if (!user) return

      const firstCompany = await prisma.company.findFirst({
        where: { organization_id: seedOrgId, deleted_at: null },
      })
      if (!firstCompany) return

      const result = await getCompanyDetailData(firstCompany.id)
      expect(result).not.toBeNull()
      if (result) {
        expect(result.visibleSections.has('finance')).toBe(true)
        expect(result.visibleSections.has('persons')).toBe(true)
        expect(result.visibleSections.has('documents')).toBe(true)
        expect(result.visibleSections.has('insight')).toBe(true)
      }
    })
  })
})
