import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))
vi.mock('@/lib/logger', () => ({
  captureError: vi.fn(),
  createLogger: vi.fn(() => ({ warn: vi.fn(), info: vi.fn(), error: vi.fn() })),
}))
vi.mock('@/lib/ai/invalidate-cache', () => ({
  invalidateCompanyInsightsCache: vi.fn().mockResolvedValue(undefined),
}))

const prismaMock = vi.hoisted(() => ({
  financialMetric: {
    upsert: vi.fn(),
    create: vi.fn(),
  },
}))

vi.mock('@/lib/db', () => ({ prisma: prismaMock }))
vi.mock('@/lib/permissions', () => ({
  canAccessCompany: vi.fn().mockResolvedValue(true),
  canAccessModule: vi.fn().mockResolvedValue(true),
}))
vi.mock('@/lib/rate-limit', () => ({
  checkActionRateLimit: vi.fn().mockResolvedValue({ limited: false }),
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

import { auth } from '@/lib/auth'
import { canAccessCompany, canAccessModule } from '@/lib/permissions'
import { checkActionRateLimit } from '@/lib/rate-limit'
import { upsertFinancialMetric, createDividendRecord } from '@/actions/finance'

const mockSession = {
  user: { id: 'u1', organizationId: 'org-1', email: 'test@test.dk', name: 'Test' },
  expires: '',
}

// z.string().uuid() kræver korrekt UUID-format (version 4)
const validCompanyId = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d'

const fakeMetric = {
  id: 'metric-1',
  organization_id: 'org-1',
  company_id: validCompanyId,
  metric_type: 'OMSAETNING',
  period_type: 'HELAAR',
  period_year: 2025,
  value: 1000000,
  currency: 'DKK',
  source: 'UREVIDERET',
  notes: null,
  created_by: 'u1',
  created_at: new Date(),
  updated_at: new Date(),
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(auth).mockResolvedValue(mockSession as never)
  vi.mocked(canAccessCompany).mockResolvedValue(true)
  vi.mocked(canAccessModule).mockResolvedValue(true)
  vi.mocked(checkActionRateLimit).mockResolvedValue({ limited: false } as never)
})

// ---------------------------------------------------------------------------
// upsertFinancialMetric
// ---------------------------------------------------------------------------

describe('upsertFinancialMetric', () => {
  const validInput = {
    companyId: validCompanyId,
    metricType: 'OMSAETNING' as const,
    periodType: 'HELAAR' as const,
    periodYear: 2025,
    value: 1000000,
  } as any

  it('returnerer fejl uden session', async () => {
    vi.mocked(auth).mockResolvedValue(null as never)
    const result = await upsertFinancialMetric(validInput)
    expect('error' in result).toBe(true)
    if ('error' in result) expect(result.error).toBe('Ikke autoriseret')
  })

  it('returnerer fejl ved ugyldigt input', async () => {
    const result = await upsertFinancialMetric({ companyId: '' } as never)
    expect('error' in result).toBe(true)
  })

  it('returnerer fejl uden finance-modul adgang', async () => {
    vi.mocked(canAccessModule).mockResolvedValue(false)
    const result = await upsertFinancialMetric(validInput)
    expect('error' in result).toBe(true)
    if ('error' in result) expect(result.error).toMatch(/økonomi/)
  })

  it('returnerer fejl uden company-adgang', async () => {
    vi.mocked(canAccessCompany).mockResolvedValue(false)
    const result = await upsertFinancialMetric(validInput)
    expect('error' in result).toBe(true)
    if ('error' in result) expect(result.error).toMatch(/selskab/)
  })

  it('returnerer fejl ved rate limit', async () => {
    vi.mocked(checkActionRateLimit).mockResolvedValue({ limited: true } as never)
    const result = await upsertFinancialMetric(validInput)
    expect('error' in result).toBe(true)
    if ('error' in result) expect(result.error).toMatch(/mange handlinger/)
  })

  it('happy path — upsert af nøgletal', async () => {
    prismaMock.financialMetric.upsert.mockResolvedValue(fakeMetric)
    const result = await upsertFinancialMetric(validInput)
    expect('data' in result).toBe(true)
    expect(prismaMock.financialMetric.upsert).toHaveBeenCalledOnce()
  })

  it('returnerer fejl når Prisma kaster fejl', async () => {
    prismaMock.financialMetric.upsert.mockRejectedValue(new Error('DB-fejl'))
    const result = await upsertFinancialMetric(validInput)
    expect('error' in result).toBe(true)
    if ('error' in result) expect(result.error).toMatch(/gemmes/)
  })
})

// ---------------------------------------------------------------------------
// createDividendRecord
// ---------------------------------------------------------------------------

describe('createDividendRecord', () => {
  const validInput = {
    companyId: validCompanyId,
    periodYear: 2025,
    amount: 500000,
    decidedAt: '2025-03-15',
    note: 'Ordinær generalforsamling',
  }

  it('returnerer fejl uden session', async () => {
    vi.mocked(auth).mockResolvedValue(null as never)
    const result = await createDividendRecord(validInput)
    expect('error' in result).toBe(true)
    if ('error' in result) expect(result.error).toBe('Ikke autoriseret')
  })

  it('returnerer fejl ved ugyldigt input — negativt beløb', async () => {
    const result = await createDividendRecord({ ...validInput, amount: -100 })
    expect('error' in result).toBe(true)
  })

  it('returnerer fejl ved ugyldigt input — companyId ikke UUID', async () => {
    const result = await createDividendRecord({ ...validInput, companyId: 'not-a-uuid' })
    expect('error' in result).toBe(true)
  })

  it('returnerer fejl uden finance-modul adgang', async () => {
    vi.mocked(canAccessModule).mockResolvedValue(false)
    const result = await createDividendRecord(validInput)
    expect('error' in result).toBe(true)
    if ('error' in result) expect(result.error).toMatch(/økonomi/)
  })

  it('returnerer fejl uden company-adgang', async () => {
    vi.mocked(canAccessCompany).mockResolvedValue(false)
    const result = await createDividendRecord(validInput)
    expect('error' in result).toBe(true)
  })

  it('returnerer fejl ved rate limit', async () => {
    vi.mocked(checkActionRateLimit).mockResolvedValue({ limited: true } as never)
    const result = await createDividendRecord(validInput)
    expect('error' in result).toBe(true)
  })

  it('happy path — opretter udbytteregistrering', async () => {
    prismaMock.financialMetric.create.mockResolvedValue({
      ...fakeMetric,
      metric_type: 'ANDET_METRIC',
      value: 500000,
    })
    const result = await createDividendRecord(validInput)
    expect('data' in result).toBe(true)
    expect(prismaMock.financialMetric.create).toHaveBeenCalledOnce()
    expect(prismaMock.financialMetric.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          value: 500000,
          source: 'REVIDERET',
        }),
      })
    )
  })

  it('returnerer fejl når Prisma kaster fejl', async () => {
    prismaMock.financialMetric.create.mockRejectedValue(new Error('DB-fejl'))
    const result = await createDividendRecord(validInput)
    expect('error' in result).toBe(true)
    if ('error' in result) expect(result.error).toMatch(/gemmes/)
  })
})
