import { describe, it, expect, vi, beforeEach } from 'vitest'

// vi.mock er hoisted — brug vi.hoisted() til at definere mocks FØR imports
const { prismaMock, mockPerson, mockCompanyPerson, mockOwnership } = vi.hoisted(() => {
  const mockPerson = {
    id: 'p1',
    organization_id: 'org-1',
    first_name: 'Lars',
    last_name: 'Jensen',
    email: 'lars@test.dk',
    phone: null,
    notes: null,
    created_by: 'u1',
    deleted_at: null,
    created_at: new Date(),
    updated_at: new Date(),
  }

  const mockCompanyPerson = {
    id: 'cp1',
    organization_id: 'org-1',
    company_id: 'c1',
    person_id: 'p1',
    role: 'DIREKTOER',
    start_date: new Date(),
    end_date: null,
    created_by: 'u1',
    created_at: new Date(),
    updated_at: new Date(),
    deleted_at: null,
    contract_id: null,
    note: null,
  }

  const mockOwnership = {
    id: 'own1',
    organization_id: 'org-1',
    company_id: 'c1',
    owner_person_id: 'p1',
    ownership_pct: 50,
    effective_date: null,
    end_date: null,
    created_by: 'u1',
    created_at: new Date(),
    updated_at: new Date(),
  }

  const prismaMock = {
    person: {
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue(mockPerson),
      create: vi.fn().mockResolvedValue(mockPerson),
      update: vi.fn().mockResolvedValue(mockPerson),
      count: vi.fn().mockResolvedValue(0),
    },
    companyPerson: {
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue(mockCompanyPerson),
      update: vi.fn().mockResolvedValue(mockCompanyPerson),
      delete: vi.fn(),
      count: vi.fn().mockResolvedValue(0),
    },
    ownership: {
      create: vi.fn().mockResolvedValue(mockOwnership),
      count: vi.fn().mockResolvedValue(0),
    },
    company: {
      findMany: vi.fn().mockResolvedValue([]),
    },
  }

  return { prismaMock, mockPerson, mockCompanyPerson, mockOwnership }
})

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))
vi.mock('@/lib/db', () => ({ prisma: prismaMock }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/audit', () => ({ recordAuditEvent: vi.fn() }))
vi.mock('@/lib/logger', () => ({ captureError: vi.fn() }))
vi.mock('@/lib/rate-limit', () => ({
  checkActionRateLimit: vi.fn().mockResolvedValue({ limited: false }),
}))
vi.mock('@/lib/permissions', () => ({
  canAccessCompany: vi.fn().mockResolvedValue(true),
  canAccessSensitivity: vi.fn().mockResolvedValue(true),
  canAccessModule: vi.fn().mockResolvedValue(true),
  getAccessibleCompanies: vi.fn().mockResolvedValue(['c1']),
}))

import {
  createPerson,
  updatePerson,
  deletePerson,
  searchPersons,
  addPersonRole,
  addPersonOwnership,
  getPersonsPaginated,
  getPersonDetailPageData,
  getPersonFullName,
} from '@/actions/persons'
import { auth } from '@/lib/auth'
import { canAccessCompany, canAccessModule, canAccessSensitivity } from '@/lib/permissions'

const SESSION = {
  user: { id: 'u1', organizationId: 'org-1', email: 'test@test.dk', name: 'Test' },
  expires: '',
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(auth).mockResolvedValue(SESSION as never)
  prismaMock.person.findFirst.mockResolvedValue(mockPerson)
  prismaMock.person.create.mockResolvedValue(mockPerson)
  prismaMock.person.update.mockResolvedValue(mockPerson)
  prismaMock.person.count.mockResolvedValue(0)
  prismaMock.person.findMany.mockResolvedValue([])
  prismaMock.companyPerson.count.mockResolvedValue(0)
  prismaMock.ownership.count.mockResolvedValue(0)
  prismaMock.ownership.create.mockResolvedValue(mockOwnership)
  prismaMock.companyPerson.create.mockResolvedValue(mockCompanyPerson)
  vi.mocked(canAccessCompany).mockResolvedValue(true)
  vi.mocked(canAccessModule).mockResolvedValue(true)
  vi.mocked(canAccessSensitivity).mockResolvedValue(true)
})

// ─── getPersonsPaginated ──────────────────────────────────────────────────────

describe('getPersonsPaginated', () => {
  it('returnerer tom payload uden session', async () => {
    vi.mocked(auth).mockResolvedValue(null)
    const result = await getPersonsPaginated({})
    expect(result).toEqual({ rows: [], totalCount: 0, page: 1, pageSize: 15 })
  })

  it('returnerer rows ved gyldig session', async () => {
    const personWithCp = { ...mockPerson, company_persons: [] }
    prismaMock.person.findMany.mockResolvedValue([personWithCp])
    prismaMock.person.count.mockResolvedValue(1)

    const result = await getPersonsPaginated({ page: 1, pageSize: 15 })
    expect(result.totalCount).toBe(1)
    expect(result.rows).toHaveLength(1)
  })

  it('inkluderer organization_id i where-klausulen', async () => {
    prismaMock.person.findMany.mockResolvedValue([])
    prismaMock.person.count.mockResolvedValue(0)

    await getPersonsPaginated({})
    const whereArg = prismaMock.person.findMany.mock.calls[0]?.[0]?.where
    expect(whereArg?.organization_id).toBe('org-1')
  })
})

// ─── createPerson ─────────────────────────────────────────────────────────────

describe('createPerson', () => {
  it('returnerer error uden session', async () => {
    vi.mocked(auth).mockResolvedValue(null)
    const result = await createPerson({ firstName: 'Lars', lastName: 'Jensen' })
    expect(result).toMatchObject({ error: expect.any(String) })
  })

  it('returnerer error ved ugyldigt input (manglende navne)', async () => {
    const result = await createPerson({ firstName: '', lastName: '' })
    expect(result).toMatchObject({ error: expect.any(String) })
  })

  it('opretter person med korrekt organisation', async () => {
    const result = await createPerson({ firstName: 'Lars', lastName: 'Jensen' })
    expect(result).toMatchObject({ data: expect.objectContaining({ id: 'p1' }) })
    expect(prismaMock.person.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ organization_id: 'org-1' }),
      })
    )
  })

  it('returnerer error når rate-limit er nået', async () => {
    const { checkActionRateLimit } = await import('@/lib/rate-limit')
    vi.mocked(checkActionRateLimit).mockResolvedValueOnce({ limited: true })
    const result = await createPerson({ firstName: 'Lars', lastName: 'Jensen' })
    expect(result).toMatchObject({ error: expect.any(String) })
  })
})

// ─── updatePerson ─────────────────────────────────────────────────────────────

describe('updatePerson', () => {
  it('returnerer error uden session', async () => {
    vi.mocked(auth).mockResolvedValue(null)
    const result = await updatePerson({ personId: 'p1', firstName: 'Ny' })
    expect(result).toMatchObject({ error: expect.any(String) })
  })

  it('returnerer error hvis personen ikke tilhører organisationen', async () => {
    prismaMock.person.findFirst.mockResolvedValueOnce(null)
    const result = await updatePerson({ personId: 'p-anden', firstName: 'Ny' })
    expect(result).toMatchObject({ error: expect.any(String) })
  })

  it('opdaterer person med tenant-isolation', async () => {
    const result = await updatePerson({ personId: 'p1', firstName: 'Ny' })
    expect(result).toMatchObject({ data: expect.objectContaining({ id: 'p1' }) })
    const findCall = prismaMock.person.findFirst.mock.calls[0]?.[0]?.where
    expect(findCall?.organization_id).toBe('org-1')
  })
})

// ─── deletePerson ─────────────────────────────────────────────────────────────

describe('deletePerson', () => {
  it('returnerer error uden session', async () => {
    vi.mocked(auth).mockResolvedValue(null)
    const result = await deletePerson('p1')
    expect(result).toMatchObject({ error: expect.any(String) })
  })

  it('returnerer error uden modul-adgang', async () => {
    vi.mocked(canAccessModule).mockResolvedValueOnce(false)
    const result = await deletePerson('p1')
    expect(result).toMatchObject({ error: expect.any(String) })
  })

  it('returnerer error når personen har aktive roller', async () => {
    prismaMock.companyPerson.count.mockResolvedValueOnce(1)
    const result = await deletePerson('p1')
    expect(result).toMatchObject({ error: expect.any(String) })
  })

  it('returnerer error når personen ikke tilhører organisationen', async () => {
    // After active-roles check passes, person lookup returns null
    prismaMock.companyPerson.count.mockResolvedValueOnce(0)
    prismaMock.ownership.count.mockResolvedValueOnce(0)
    prismaMock.person.findFirst.mockResolvedValueOnce(null)
    const result = await deletePerson('p-anden')
    expect(result).toMatchObject({ error: expect.any(String) })
  })

  it('soft-sletter person', async () => {
    const result = await deletePerson('p1')
    expect(result).toMatchObject({ data: undefined })
    expect(prismaMock.person.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ deleted_at: expect.any(Date) }),
      })
    )
  })
})

// ─── searchPersons ────────────────────────────────────────────────────────────

describe('searchPersons', () => {
  it('returnerer error uden session', async () => {
    vi.mocked(auth).mockResolvedValue(null)
    const result = await searchPersons('Lars')
    expect(result).toMatchObject({ error: expect.any(String) })
  })

  it('returnerer tom array ved for kort query', async () => {
    const result = await searchPersons('L')
    expect(result).toMatchObject({ data: [] })
  })

  it('søger med organization_id', async () => {
    prismaMock.person.findMany.mockResolvedValueOnce([mockPerson])
    const result = await searchPersons('Lars')
    expect(result).toMatchObject({ data: [expect.objectContaining({ id: 'p1' })] })
    const whereArg = prismaMock.person.findMany.mock.calls[0]?.[0]?.where
    expect(whereArg?.organization_id).toBe('org-1')
  })
})

// ─── addPersonRole ────────────────────────────────────────────────────────────

describe('addPersonRole', () => {
  it('returnerer error uden session', async () => {
    vi.mocked(auth).mockResolvedValue(null)
    const result = await addPersonRole({ personId: 'p1', companyId: 'c1', role: 'DIREKTOER' })
    expect(result).toMatchObject({ error: expect.any(String) })
  })

  it('returnerer error uden selskabsadgang', async () => {
    vi.mocked(canAccessCompany).mockResolvedValueOnce(false)
    const result = await addPersonRole({ personId: 'p1', companyId: 'c1', role: 'DIREKTOER' })
    expect(result).toMatchObject({ error: expect.any(String) })
  })

  it('returnerer error hvis personen ikke tilhører organisationen', async () => {
    prismaMock.person.findFirst.mockResolvedValueOnce(null)
    const result = await addPersonRole({ personId: 'p-anden', companyId: 'c1', role: 'DIREKTOER' })
    expect(result).toMatchObject({ error: expect.any(String) })
  })

  it('opretter tilknytning med organization_id', async () => {
    const result = await addPersonRole({ personId: 'p1', companyId: 'c1', role: 'DIREKTOER' })
    expect(result).toMatchObject({ data: expect.objectContaining({ id: 'cp1' }) })
    expect(prismaMock.companyPerson.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ organization_id: 'org-1' }),
      })
    )
  })

  it('returnerer error ved ugyldigt input (tom personId)', async () => {
    const result = await addPersonRole({ personId: '', companyId: 'c1', role: 'DIREKTOER' })
    expect(result).toMatchObject({ error: expect.any(String) })
  })
})

// ─── addPersonOwnership ───────────────────────────────────────────────────────

describe('addPersonOwnership', () => {
  it('returnerer error uden session', async () => {
    vi.mocked(auth).mockResolvedValue(null)
    const result = await addPersonOwnership({ personId: 'p1', companyId: 'c1', sharePercent: 50 })
    expect(result).toMatchObject({ error: expect.any(String) })
  })

  it('returnerer error uden selskabsadgang', async () => {
    vi.mocked(canAccessCompany).mockResolvedValueOnce(false)
    const result = await addPersonOwnership({ personId: 'p1', companyId: 'c1', sharePercent: 50 })
    expect(result).toMatchObject({ error: expect.any(String) })
  })

  it('returnerer error uden sensitivity-adgang', async () => {
    vi.mocked(canAccessSensitivity).mockResolvedValueOnce(false)
    const result = await addPersonOwnership({ personId: 'p1', companyId: 'c1', sharePercent: 50 })
    expect(result).toMatchObject({ error: expect.any(String) })
  })

  it('returnerer error hvis personen ikke tilhører organisationen', async () => {
    prismaMock.person.findFirst.mockResolvedValueOnce(null)
    const result = await addPersonOwnership({
      personId: 'p-anden',
      companyId: 'c1',
      sharePercent: 50,
    })
    expect(result).toMatchObject({ error: expect.any(String) })
  })

  it('opretter ejerskab med korrekt organisation', async () => {
    const result = await addPersonOwnership({ personId: 'p1', companyId: 'c1', sharePercent: 50 })
    expect(result).toMatchObject({ data: expect.objectContaining({ id: 'own1' }) })
    expect(prismaMock.ownership.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ organization_id: 'org-1', ownership_pct: 50 }),
      })
    )
  })

  it('returnerer error ved ugyldigt sharePercent (0)', async () => {
    const result = await addPersonOwnership({ personId: 'p1', companyId: 'c1', sharePercent: 0 })
    expect(result).toMatchObject({ error: expect.any(String) })
  })
})

// ─── getPersonDetailPageData ──────────────────────────────────────────────────

describe('getPersonDetailPageData', () => {
  it('returnerer null uden session', async () => {
    vi.mocked(auth).mockResolvedValue(null)
    const result = await getPersonDetailPageData('p1')
    expect(result).toBeNull()
  })

  it('returnerer null uden modul-adgang', async () => {
    vi.mocked(canAccessModule).mockResolvedValueOnce(false)
    const result = await getPersonDetailPageData('p1')
    expect(result).toBeNull()
  })

  it('returnerer null hvis personen ikke findes', async () => {
    // canAccessModule returnerer true to gange (persons + settings), så person-lookup = null
    prismaMock.person.findFirst.mockResolvedValueOnce(null)
    const result = await getPersonDetailPageData('p1')
    expect(result).toBeNull()
  })

  it('returnerer pagedata med person og accessibleCompanies', async () => {
    const personWithRelations = {
      ...mockPerson,
      company_persons: [],
      contract_parties: [],
      ownerships: [],
      case_persons: [],
    }
    prismaMock.person.findFirst.mockResolvedValueOnce(personWithRelations)
    prismaMock.company.findMany.mockResolvedValueOnce([{ id: 'c1', name: 'Klinik A' }])

    const result = await getPersonDetailPageData('p1')
    expect(result).not.toBeNull()
    expect(result?.person.id).toBe('p1')
    expect(result?.accessibleCompanies).toHaveLength(1)
  })
})

// ─── getPersonFullName ────────────────────────────────────────────────────────

describe('getPersonFullName', () => {
  it('returnerer "Person" uden session', async () => {
    vi.mocked(auth).mockResolvedValue(null)
    const result = await getPersonFullName('p1')
    expect(result).toBe('Person')
  })

  it('returnerer "Person" hvis id ikke findes', async () => {
    prismaMock.person.findFirst.mockResolvedValueOnce(null)
    const result = await getPersonFullName('p-mangler')
    expect(result).toBe('Person')
  })

  it('returnerer fuldt navn ved gyldig session + person', async () => {
    prismaMock.person.findFirst.mockResolvedValueOnce({ first_name: 'Lars', last_name: 'Jensen' })
    const result = await getPersonFullName('p1')
    expect(result).toBe('Lars Jensen')
  })
})
