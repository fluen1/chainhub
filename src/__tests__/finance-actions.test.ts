import { describe, it, expect, vi, beforeEach } from 'vitest'
import { upsertFinancialMetric, createDividendRecord } from '@/actions/finance'

vi.mock('@/lib/auth', () => ({
  auth: vi.fn().mockResolvedValue({
    user: { id: 'user-1', organizationId: 'org-1' },
  }),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    financialMetric: {
      upsert: vi.fn().mockResolvedValue({ id: 'metric-1' }),
      create: vi.fn().mockResolvedValue({ id: 'div-1' }),
    },
  },
}))

vi.mock('@/lib/permissions', () => ({
  canAccessCompany: vi.fn().mockResolvedValue(true),
  canAccessModule: vi.fn().mockResolvedValue(true),
}))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

describe('upsertFinancialMetric', () => {
  beforeEach(() => vi.clearAllMocks())

  it('happy path returnerer data', async () => {
    const result = await upsertFinancialMetric({
      companyId: 'a1b2c3d4-e5f6-4789-9abc-def012345678',
      metricType: 'OMSAETNING',
      periodType: 'HELAAR',
      periodYear: 2025,
      value: 5000000,
    } as never)
    expect('data' in result).toBe(true)
  })

  it('returnerer fejl uden session', async () => {
    const auth = await import('@/lib/auth')
    vi.mocked(auth.auth).mockResolvedValueOnce(null)
    const result = await upsertFinancialMetric({
      companyId: 'a1b2c3d4-e5f6-4789-9abc-def012345678',
      metricType: 'OMSAETNING',
      periodType: 'HELAAR',
      periodYear: 2025,
      value: 5000000,
    } as never)
    expect(result).toEqual({ error: 'Ikke autoriseret' })
  })

  it('returnerer fejl uden finance-modul-adgang', async () => {
    const perms = await import('@/lib/permissions')
    vi.mocked(perms.canAccessModule).mockResolvedValueOnce(false)
    const result = await upsertFinancialMetric({
      companyId: 'a1b2c3d4-e5f6-4789-9abc-def012345678',
      metricType: 'OMSAETNING',
      periodType: 'HELAAR',
      periodYear: 2025,
      value: 5000000,
    } as never)
    expect('error' in result).toBe(true)
  })

  it('returnerer fejl uden selskab-adgang', async () => {
    const perms = await import('@/lib/permissions')
    vi.mocked(perms.canAccessCompany).mockResolvedValueOnce(false)
    const result = await upsertFinancialMetric({
      companyId: 'a1b2c3d4-e5f6-4789-9abc-def012345678',
      metricType: 'OMSAETNING',
      periodType: 'HELAAR',
      periodYear: 2025,
      value: 5000000,
    } as never)
    expect('error' in result).toBe(true)
  })

  it('afviser ugyldig metricType', async () => {
    const result = await upsertFinancialMetric({
      companyId: 'a1b2c3d4-e5f6-4789-9abc-def012345678',
      metricType: 'UGYLDIG' as never,
      periodType: 'HELAAR',
      periodYear: 2025,
      value: 5000000,
    } as never)
    expect('error' in result).toBe(true)
  })
})

describe('createDividendRecord', () => {
  beforeEach(() => vi.clearAllMocks())

  it('happy path returnerer data', async () => {
    const result = await createDividendRecord({
      companyId: 'a1b2c3d4-e5f6-4789-9abc-def012345678',
      periodYear: 2025,
      amount: 100000,
      decidedAt: '2025-06-01',
    } as never)
    expect('data' in result).toBe(true)
  })

  it('afviser uden session', async () => {
    const auth = await import('@/lib/auth')
    vi.mocked(auth.auth).mockResolvedValueOnce(null)
    const result = await createDividendRecord({
      companyId: 'a1b2c3d4-e5f6-4789-9abc-def012345678',
      periodYear: 2025,
      amount: 100000,
      decidedAt: '2025-06-01',
    } as never)
    expect(result).toEqual({ error: 'Ikke autoriseret' })
  })

  it('afviser negativ amount', async () => {
    const result = await createDividendRecord({
      companyId: 'a1b2c3d4-e5f6-4789-9abc-def012345678',
      periodYear: 2025,
      amount: -1000,
      decidedAt: '2025-06-01',
    } as never)
    expect('error' in result).toBe(true)
  })
})
