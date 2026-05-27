import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Hoisted mocks ────────────────────────────────────────────────────────────
const { prismaMock } = vi.hoisted(() => {
  const prismaMock = {
    company: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    userRoleAssignment: {
      findMany: vi.fn(),
    },
    financialMetric: {
      findMany: vi.fn(),
    },
    person: {
      count: vi.fn(),
    },
    $queryRaw: vi.fn(),
  }
  return { prismaMock }
})

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))
vi.mock('@/lib/db', () => ({ prisma: prismaMock }))
vi.mock('@/lib/permissions', () => ({
  canAccessCompany: vi.fn(),
  canAccessModule: vi.fn(),
  getAccessibleCompanies: vi.fn(),
}))
vi.mock('@/lib/rate-limit', () => ({
  checkActionRateLimit: vi.fn().mockResolvedValue({ limited: false }),
}))
vi.mock('@/lib/audit', () => ({
  recordAuditEvent: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }))
vi.mock('@/lib/logger', () => ({ captureError: vi.fn() }))
vi.mock('@/lib/geocode', () => ({
  geocodeAddress: vi.fn().mockResolvedValue(null),
}))
vi.mock('@/lib/ai/invalidate-cache', () => ({
  invalidateCompanyInsightsCache: vi.fn().mockResolvedValue(undefined),
}))

import {
  createCompany,
  updateCompany,
  deleteCompany,
  updateCompanyStamdata,
  getCompaniesPageData,
} from '@/actions/companies'
import { auth } from '@/lib/auth'
import { canAccessCompany, canAccessModule, getAccessibleCompanies } from '@/lib/permissions'
import { checkActionRateLimit } from '@/lib/rate-limit'

// Hjælpefunktioner
function makeSession(overrides?: Partial<{ id: string; organizationId: string }>) {
  return {
    user: {
      id: 'user-1',
      organizationId: 'org-1',
      email: 'test@test.dk',
      name: 'Test User',
      ...overrides,
    },
    expires: '2099-01-01',
  }
}

const baseCompany = {
  id: 'company-1',
  organization_id: 'org-1',
  name: 'Test Selskab',
  cvr: null,
  company_type: null,
  address: null,
  city: null,
  postal_code: null,
  status: 'aktiv',
  notes: null,
  deleted_at: null,
  created_at: new Date(),
  updated_at: new Date(),
  created_by: 'user-1',
  latitude: null,
  longitude: null,
  founded_date: null,
}

// ─── createCompany ────────────────────────────────────────────────────────────

describe('createCompany', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(checkActionRateLimit).mockResolvedValue({ limited: false, remaining: 59 } as any)
  })

  it('returnerer fejl uden session', async () => {
    vi.mocked(auth).mockResolvedValue(null)
    const result = await createCompany({ name: 'Test' })
    expect(result).toEqual({ error: 'Din session er udløbet — log ind igen.' })
  })

  it('returnerer fejl ved ugyldigt input (tomt navn)', async () => {
    vi.mocked(auth).mockResolvedValue(makeSession())
    vi.mocked(canAccessModule).mockResolvedValue(true)
    const result = await createCompany({ name: '' })
    expect(result).toHaveProperty('error')
    expect(typeof (result as { error: string }).error).toBe('string')
  })

  it('returnerer fejl ved ugyldigt CVR-format', async () => {
    vi.mocked(auth).mockResolvedValue(makeSession())
    vi.mocked(canAccessModule).mockResolvedValue(true)
    const result = await createCompany({ name: 'Test', cvr: '123' })
    expect(result).toHaveProperty('error')
  })

  it('returnerer fejl uden modul-adgang', async () => {
    vi.mocked(auth).mockResolvedValue(makeSession())
    vi.mocked(canAccessModule).mockResolvedValue(false)
    const result = await createCompany({ name: 'Test Selskab' })
    expect(result).toEqual({ error: 'Du har ikke adgang til at oprette selskaber' })
  })

  it('returnerer fejl ved rate limiting', async () => {
    vi.mocked(auth).mockResolvedValue(makeSession())
    vi.mocked(canAccessModule).mockResolvedValue(true)
    vi.mocked(checkActionRateLimit).mockResolvedValue({ limited: true, remaining: 0 } as any)
    const result = await createCompany({ name: 'Test Selskab' })
    expect(result).toEqual({ error: 'For mange handlinger. Vent venligst.' })
  })

  it('returnerer fejl ved duplikat CVR', async () => {
    vi.mocked(auth).mockResolvedValue(makeSession())
    vi.mocked(canAccessModule).mockResolvedValue(true)
    prismaMock.company.findFirst.mockResolvedValue({ id: 'existing-1', name: 'Eksisterende' })
    const result = await createCompany({ name: 'Ny Test', cvr: '12345678' })
    expect(result).toHaveProperty('error')
    expect((result as { error: string }).error).toContain('12345678')
  })

  it('opretter selskab med korrekt organization_id', async () => {
    vi.mocked(auth).mockResolvedValue(makeSession())
    vi.mocked(canAccessModule).mockResolvedValue(true)
    prismaMock.company.findFirst.mockResolvedValue(null)
    prismaMock.company.create.mockResolvedValue(baseCompany)

    const result = await createCompany({ name: 'Nyt Selskab' })
    expect(result).toEqual({ data: baseCompany })

    expect(prismaMock.company.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ organization_id: 'org-1' }),
      })
    )
  })

  it('korrekt organisation skrives til created_by', async () => {
    vi.mocked(auth).mockResolvedValue(makeSession())
    vi.mocked(canAccessModule).mockResolvedValue(true)
    prismaMock.company.findFirst.mockResolvedValue(null)
    prismaMock.company.create.mockResolvedValue(baseCompany)

    await createCompany({ name: 'Test' })
    expect(prismaMock.company.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ created_by: 'user-1' }),
      })
    )
  })
})

// ─── updateCompany ────────────────────────────────────────────────────────────

describe('updateCompany', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(checkActionRateLimit).mockResolvedValue({ limited: false, remaining: 59 } as any)
  })

  it('returnerer fejl uden session', async () => {
    vi.mocked(auth).mockResolvedValue(null)
    const result = await updateCompany({ companyId: 'company-1', name: 'Ny Navn' })
    expect(result).toEqual({ error: 'Din session er udløbet — log ind igen.' })
  })

  it('returnerer fejl ved manglende companyId', async () => {
    vi.mocked(auth).mockResolvedValue(makeSession())
    const result = await updateCompany({ companyId: '', name: 'Test' })
    expect(result).toHaveProperty('error')
  })

  it('returnerer fejl uden selskabs-adgang', async () => {
    vi.mocked(auth).mockResolvedValue(makeSession())
    vi.mocked(canAccessCompany).mockResolvedValue(false)
    const result = await updateCompany({ companyId: 'company-1', name: 'Ny Navn' })
    expect(result).toEqual({ error: 'Ingen adgang til dette selskab' })
  })

  it('opdaterer selskab med korrekt organization_id i where-klausul', async () => {
    vi.mocked(auth).mockResolvedValue(makeSession())
    vi.mocked(canAccessCompany).mockResolvedValue(true)
    prismaMock.company.update.mockResolvedValue({ ...baseCompany, name: 'Opdateret' })

    const result = await updateCompany({ companyId: 'company-1', name: 'Opdateret' })
    expect(result).toHaveProperty('data')
    expect(prismaMock.company.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ organization_id: 'org-1' }),
      })
    )
  })

  it('canAccessCompany kaldes med korrekte argumenter', async () => {
    vi.mocked(auth).mockResolvedValue(makeSession())
    vi.mocked(canAccessCompany).mockResolvedValue(true)
    prismaMock.company.update.mockResolvedValue(baseCompany)

    await updateCompany({ companyId: 'company-1', name: 'Test' })
    expect(canAccessCompany).toHaveBeenCalledWith('user-1', 'company-1', 'org-1')
  })
})

// ─── deleteCompany ────────────────────────────────────────────────────────────

describe('deleteCompany', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(checkActionRateLimit).mockResolvedValue({ limited: false, remaining: 59 } as any)
  })

  it('returnerer fejl uden session', async () => {
    vi.mocked(auth).mockResolvedValue(null)
    const result = await deleteCompany('company-1')
    expect(result).toEqual({ error: 'Din session er udløbet — log ind igen.' })
  })

  it('returnerer fejl uden modul-adgang', async () => {
    vi.mocked(auth).mockResolvedValue(makeSession())
    vi.mocked(canAccessModule).mockResolvedValue(false)
    const result = await deleteCompany('company-1')
    expect(result).toEqual({ error: 'Du har ikke adgang til at slette selskaber' })
  })

  it('returnerer fejl når selskab ikke findes (tenant isolation)', async () => {
    vi.mocked(auth).mockResolvedValue(makeSession())
    vi.mocked(canAccessModule).mockResolvedValue(true)
    prismaMock.company.findFirst.mockResolvedValue(null)
    const result = await deleteCompany('ukendt-selskab')
    expect(result).toEqual({ error: 'Selskab ikke fundet' })
  })

  it('soft-deleter selskab (sætter deleted_at)', async () => {
    vi.mocked(auth).mockResolvedValue(makeSession())
    vi.mocked(canAccessModule).mockResolvedValue(true)
    prismaMock.company.findFirst.mockResolvedValue({ id: 'company-1' })
    prismaMock.company.update.mockResolvedValue({ ...baseCompany, deleted_at: new Date() })

    const result = await deleteCompany('company-1')
    expect(result).toEqual({ data: undefined })
    expect(prismaMock.company.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ deleted_at: expect.any(Date) }),
      })
    )
  })

  it('tenant isolation: findFirst inkluderer organization_id', async () => {
    vi.mocked(auth).mockResolvedValue(makeSession())
    vi.mocked(canAccessModule).mockResolvedValue(true)
    prismaMock.company.findFirst.mockResolvedValue(null)

    await deleteCompany('company-X')
    expect(prismaMock.company.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ organization_id: 'org-1' }),
      })
    )
  })
})

// ─── updateCompanyStamdata ────────────────────────────────────────────────────

describe('updateCompanyStamdata', () => {
  const validInput = {
    name: 'Test Selskab',
    cvr: null,
    address: null,
    city: null,
    postal_code: null,
    founded_date: null,
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(checkActionRateLimit).mockResolvedValue({ limited: false, remaining: 59 } as any)
  })

  it('returnerer fejl uden session', async () => {
    vi.mocked(auth).mockResolvedValue(null)
    const result = await updateCompanyStamdata('company-1', validInput)
    expect(result).toEqual({ error: 'Din session er udløbet — log ind igen.' })
  })

  it('returnerer fejl ved ugyldigt input (tomt navn)', async () => {
    vi.mocked(auth).mockResolvedValue(makeSession())
    vi.mocked(canAccessCompany).mockResolvedValue(true)
    const result = await updateCompanyStamdata('company-1', { ...validInput, name: '' })
    expect(result).toHaveProperty('error')
  })

  it('returnerer fejl uden selskabs-adgang', async () => {
    vi.mocked(auth).mockResolvedValue(makeSession())
    vi.mocked(canAccessCompany).mockResolvedValue(false)
    const result = await updateCompanyStamdata('company-1', validInput)
    expect(result).toEqual({ error: 'Ingen adgang til dette selskab' })
  })

  it('opdaterer stamdata med korrekt organization_id i where', async () => {
    vi.mocked(auth).mockResolvedValue(makeSession())
    vi.mocked(canAccessCompany).mockResolvedValue(true)
    prismaMock.company.update.mockResolvedValue(baseCompany)

    const result = await updateCompanyStamdata('company-1', validInput)
    expect(result).toEqual({ data: undefined })
    expect(prismaMock.company.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ organization_id: 'org-1', id: 'company-1' }),
      })
    )
  })
})

// ─── getCompaniesPageData ─────────────────────────────────────────────────────

describe('getCompaniesPageData', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returnerer null uden session', async () => {
    vi.mocked(auth).mockResolvedValue(null)
    const result = await getCompaniesPageData()
    expect(result).toBeNull()
  })

  it('returnerer tomme arrays når bruger ingen selskabsadgang har', async () => {
    vi.mocked(auth).mockResolvedValue(makeSession())
    vi.mocked(getAccessibleCompanies).mockResolvedValue([])
    prismaMock.userRoleAssignment.findMany.mockResolvedValue([])

    const result = await getCompaniesPageData()
    expect(result).not.toBeNull()
    expect(result!.companies).toHaveLength(0)
    expect(result!.canCreate).toBe(false)
  })

  it('canCreate er true for GROUP_OWNER rolle', async () => {
    vi.mocked(auth).mockResolvedValue(makeSession())
    vi.mocked(getAccessibleCompanies).mockResolvedValue([])
    prismaMock.userRoleAssignment.findMany.mockResolvedValue([{ role: 'GROUP_OWNER' }])

    const result = await getCompaniesPageData()
    expect(result!.canCreate).toBe(true)
  })

  it('canCreate er false for GROUP_READONLY rolle', async () => {
    vi.mocked(auth).mockResolvedValue(makeSession())
    vi.mocked(getAccessibleCompanies).mockResolvedValue([])
    prismaMock.userRoleAssignment.findMany.mockResolvedValue([{ role: 'GROUP_READONLY' }])

    const result = await getCompaniesPageData()
    expect(result!.canCreate).toBe(false)
  })

  it('henter selskaber med korrekt organization_id', async () => {
    vi.mocked(auth).mockResolvedValue(makeSession())
    vi.mocked(getAccessibleCompanies).mockResolvedValue(['company-1'])
    prismaMock.userRoleAssignment.findMany.mockResolvedValue([])
    prismaMock.company.findMany.mockResolvedValue([])
    prismaMock.$queryRaw.mockResolvedValue([])
    prismaMock.financialMetric.findMany.mockResolvedValue([])
    prismaMock.person.count.mockResolvedValue(0)

    await getCompaniesPageData()
    expect(prismaMock.company.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ organization_id: 'org-1' }),
      })
    )
  })
})
