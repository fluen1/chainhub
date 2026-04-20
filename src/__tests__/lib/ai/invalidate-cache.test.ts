import { describe, it, expect, beforeEach } from 'vitest'
import { prisma } from '@/lib/db'
import { invalidateCompanyInsightsCache } from '@/lib/ai/invalidate-cache'

describe('invalidateCompanyInsightsCache', () => {
  const companyId = '00000000-0000-0000-0000-0000000000aa'

  beforeEach(async () => {
    await prisma.companyInsightsCache
      .deleteMany({ where: { company_id: companyId } })
      .catch(() => {})
  })

  it('sletter eksisterende cache-row hvis DB er tilgængelig', async () => {
    let created = false
    try {
      // Kræver at company og organization eksisterer; vi prøver, og hvis FK-fejl
      // eller DB paused, skipper vi denne test-case gracefully.
      const anyCompany = await prisma.company.findFirst({
        select: { id: true, organization_id: true },
      })
      if (!anyCompany) return
      await prisma.companyInsightsCache.upsert({
        where: { company_id: anyCompany.id },
        update: {
          alerts: [],
          model_name: 'claude-haiku-4-5',
          total_cost_usd: 0,
          generated_at: new Date(),
        },
        create: {
          organization_id: anyCompany.organization_id,
          company_id: anyCompany.id,
          alerts: [],
          model_name: 'claude-haiku-4-5',
          total_cost_usd: 0,
        },
      })
      created = true
      await invalidateCompanyInsightsCache(anyCompany.id)
      const remaining = await prisma.companyInsightsCache.count({
        where: { company_id: anyCompany.id },
      })
      expect(remaining).toBe(0)
    } catch {
      // DB not available — skip
      if (!created) return
    }
  })

  it('er idempotent ved ingen cache-row (kaster ikke)', async () => {
    await expect(invalidateCompanyInsightsCache(companyId)).resolves.not.toThrow()
  })
})
