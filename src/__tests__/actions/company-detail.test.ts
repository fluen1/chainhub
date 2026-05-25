import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))
vi.mock('@/lib/logger', () => ({
  captureError: vi.fn(),
  createLogger: vi.fn(() => ({ warn: vi.fn(), info: vi.fn(), error: vi.fn() })),
}))
vi.mock('@/lib/ai/jobs/company-insights', () => ({
  generateCompanyInsights: vi.fn().mockResolvedValue({ ok: false }),
}))
vi.mock('@/lib/ai/feature-flags', () => ({
  isAIEnabled: vi.fn().mockResolvedValue(false),
}))
vi.mock('@/lib/ai/cost-cap', () => ({
  checkCostCap: vi.fn().mockResolvedValue({ allowed: false }),
}))
vi.mock('@/lib/company-detail/helpers', () => ({
  sectionsForRole: vi.fn().mockReturnValue(new Set(['contracts', 'persons', 'cases'])),
  pickHighestPriorityRole: vi.fn().mockReturnValue('GROUP_OWNER'),
  deriveHealthDimensions: vi.fn().mockReturnValue({
    contracts: 'green',
    cases: 'green',
    finance: null,
    visits: 'amber',
  }),
  deriveStatusBadge: vi.fn().mockReturnValue({ label: 'Aktiv', tone: 'green' }),
  sortContractsByUrgency: vi.fn().mockImplementation((arr: unknown[]) => arr),
  sortCasesByUrgency: vi.fn().mockImplementation((arr: unknown[]) => arr),
  selectKeyPersons: vi.fn().mockImplementation((arr: unknown[]) => arr.slice(0, 3)),
}))

const prismaMock = vi.hoisted(() => ({
  company: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
  },
  ownership: { findMany: vi.fn() },
  contract: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
  },
  financialMetric: { findMany: vi.fn() },
  case: { findMany: vi.fn(), count: vi.fn() },
  companyPerson: { findMany: vi.fn(), count: vi.fn() },
  visit: { findMany: vi.fn() },
  document: { findMany: vi.fn() },
  companyInsightsCache: { findUnique: vi.fn(), upsert: vi.fn() },
  task: { count: vi.fn() },
  userRoleAssignment: { findMany: vi.fn() },
  person: { findMany: vi.fn() },
}))

vi.mock('@/lib/db', () => ({ prisma: prismaMock }))
vi.mock('@/lib/permissions', () => ({
  getAccessibleCompanies: vi.fn().mockResolvedValue(['00000000-0000-0000-0000-000000000001']),
  canAccessSensitivity: vi.fn().mockResolvedValue(true),
  canAccessCompany: vi.fn().mockResolvedValue(true),
}))

import { auth } from '@/lib/auth'
import { getAccessibleCompanies, canAccessSensitivity } from '@/lib/permissions'
import {
  getCompanyDetailData,
  getCompanyDetailPageExtras,
  getCompanyName,
} from '@/actions/company-detail'

const mockSession = {
  user: { id: 'u1', organizationId: 'org-1', email: 'test@test.dk', name: 'Test' },
  expires: '',
}

const validCompanyId = '00000000-0000-0000-0000-000000000001'

const fakeCompany = {
  id: validCompanyId,
  organization_id: 'org-1',
  name: 'Test ApS',
  cvr: '12345678',
  address: 'Testvej 1',
  city: 'Testby',
  postal_code: '1234',
  status: 'AKTIV',
  founded_date: null,
  deleted_at: null,
  company_type: 'ApS',
}

function setupDefaultMocks() {
  prismaMock.company.findFirst.mockResolvedValue(fakeCompany)
  prismaMock.company.findMany.mockResolvedValue([])
  prismaMock.userRoleAssignment.findMany.mockResolvedValue([{ role: 'GROUP_OWNER' }])
  prismaMock.ownership.findMany.mockResolvedValue([])
  prismaMock.contract.findFirst.mockResolvedValue(null)
  prismaMock.contract.findMany.mockResolvedValue([])
  prismaMock.contract.count.mockResolvedValue(0)
  prismaMock.financialMetric.findMany.mockResolvedValue([])
  prismaMock.case.findMany.mockResolvedValue([])
  prismaMock.case.count.mockResolvedValue(0)
  prismaMock.companyPerson.findMany.mockResolvedValue([])
  prismaMock.companyPerson.count.mockResolvedValue(0)
  prismaMock.visit.findMany.mockResolvedValue([])
  prismaMock.document.findMany.mockResolvedValue([])
  prismaMock.companyInsightsCache.findUnique.mockResolvedValue(null)
  prismaMock.task.count.mockResolvedValue(0)
  prismaMock.person.findMany.mockResolvedValue([])
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(auth).mockResolvedValue(mockSession as never)
  vi.mocked(getAccessibleCompanies).mockResolvedValue([validCompanyId])
  vi.mocked(canAccessSensitivity).mockResolvedValue(true)
  setupDefaultMocks()
})

// ---------------------------------------------------------------------------
// getCompanyDetailData
// ---------------------------------------------------------------------------

describe('getCompanyDetailData', () => {
  it('returnerer null uden session', async () => {
    vi.mocked(auth).mockResolvedValue(null as never)
    const result = await getCompanyDetailData(validCompanyId)
    expect(result).toBeNull()
  })

  it('returnerer null ved ugyldigt UUID-format', async () => {
    const result = await getCompanyDetailData('not-a-uuid')
    expect(result).toBeNull()
  })

  it('returnerer null når company-id ikke er tilgængeligt', async () => {
    vi.mocked(getAccessibleCompanies).mockResolvedValue([])
    const result = await getCompanyDetailData(validCompanyId)
    expect(result).toBeNull()
  })

  it('returnerer null når company ikke eksisterer i DB', async () => {
    prismaMock.company.findFirst.mockResolvedValue(null)
    const result = await getCompanyDetailData(validCompanyId)
    expect(result).toBeNull()
  })

  it('happy path — returnerer CompanyDetailData', async () => {
    const result = await getCompanyDetailData(validCompanyId)
    expect(result).not.toBeNull()
    expect(result?.company.id).toBe(validCompanyId)
    expect(result?.company.name).toBe('Test ApS')
  })

  it('returnerer tasks.overdueCount fra DB', async () => {
    prismaMock.task.count.mockResolvedValue(3)
    const result = await getCompanyDetailData(validCompanyId)
    expect(result?.tasks.overdueCount).toBe(3)
  })

  it('inkluderer korrekte felter i company-objektet', async () => {
    const result = await getCompanyDetailData(validCompanyId)
    expect(result?.company).toMatchObject({
      id: validCompanyId,
      name: 'Test ApS',
      cvr: '12345678',
      status: 'AKTIV',
    })
  })
})

// ---------------------------------------------------------------------------
// getCompanyDetailPageExtras
// ---------------------------------------------------------------------------

describe('getCompanyDetailPageExtras', () => {
  it('returnerer null uden session', async () => {
    vi.mocked(auth).mockResolvedValue(null as never)
    const result = await getCompanyDetailPageExtras(validCompanyId, new Set(['ownership']))
    expect(result).toBeNull()
  })

  it('happy path uden nogen ønskede sektioner', async () => {
    const result = await getCompanyDetailPageExtras(validCompanyId, new Set())
    expect(result).not.toBeNull()
    expect(result?.rawOwnerships).toEqual([])
    expect(result?.rawCompanyPersons).toEqual([])
    expect(result?.allMetrics).toEqual([])
    expect(result?.allPersons).toEqual([])
    expect(result?.expiringLease).toBeNull()
  })

  it('henter ownerships når ownership-sektion ønskes og bruger har sensitivity-adgang', async () => {
    const fakeOwnership = {
      id: 'o1',
      ownership_pct: 50,
      effective_date: null,
      owner_person: { id: validCompanyId, first_name: 'Ole', last_name: 'Hansen' },
    }
    prismaMock.ownership.findMany.mockResolvedValue([fakeOwnership])

    const result = await getCompanyDetailPageExtras(validCompanyId, new Set(['ownership']))
    expect(result?.rawOwnerships).toHaveLength(1)
  })

  it('returnerer tom rawOwnerships når sensitivity-adgang mangler', async () => {
    vi.mocked(canAccessSensitivity).mockResolvedValue(false)
    prismaMock.ownership.findMany.mockResolvedValue([{ id: 'o1' }])

    const result = await getCompanyDetailPageExtras(validCompanyId, new Set(['ownership']))
    expect(result?.rawOwnerships).toEqual([])
    expect(result?.canSeeOwnership).toBe(false)
  })

  it('henter companyPersons ved persons-sektion', async () => {
    const fakePerson = {
      id: 'cp1',
      role: 'direktoer',
      employment_type: null,
      start_date: null,
      person: { first_name: 'Anni', last_name: 'Larsen' },
    }
    prismaMock.companyPerson.findMany.mockResolvedValue([fakePerson])

    const result = await getCompanyDetailPageExtras(validCompanyId, new Set(['persons']))
    expect(result?.rawCompanyPersons).toHaveLength(1)
  })

  it('henter finansielle nøgletal ved finance-sektion', async () => {
    const fakeMetric = {
      metric_type: 'OMSAETNING',
      period_type: 'HELAAR',
      period_year: 2025,
      value: 1000000,
    }
    prismaMock.financialMetric.findMany.mockResolvedValue([fakeMetric])

    const result = await getCompanyDetailPageExtras(validCompanyId, new Set(['finance']))
    expect(result?.allMetrics).toHaveLength(1)
  })

  it('henter expiringLease ved contracts-sektion', async () => {
    const fakeLease = {
      id: 'lease-1',
      display_name: 'Lejekontrakt',
      expiry_date: new Date('2026-01-01'),
    }
    prismaMock.contract.findFirst.mockResolvedValue(fakeLease)

    const result = await getCompanyDetailPageExtras(validCompanyId, new Set(['contracts']))
    expect(result?.expiringLease).not.toBeNull()
    expect(result?.expiringLease?.id).toBe('lease-1')
  })

  it('returnerer canSeeOwnership korrekt', async () => {
    vi.mocked(canAccessSensitivity).mockResolvedValue(true)
    const result = await getCompanyDetailPageExtras(validCompanyId, new Set())
    expect(result?.canSeeOwnership).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// getCompanyName
// ---------------------------------------------------------------------------

describe('getCompanyName', () => {
  it('returnerer null uden session', async () => {
    vi.mocked(auth).mockResolvedValue(null as never)
    const result = await getCompanyName(validCompanyId)
    expect(result).toBeNull()
  })

  it('returnerer null når company ikke eksisterer', async () => {
    prismaMock.company.findFirst.mockResolvedValue(null)
    const result = await getCompanyName(validCompanyId)
    expect(result).toBeNull()
  })

  it('happy path — returnerer company-navn', async () => {
    prismaMock.company.findFirst.mockResolvedValue({ name: 'Min Klinik ApS' })
    const result = await getCompanyName(validCompanyId)
    expect(result).toBe('Min Klinik ApS')
  })
})
