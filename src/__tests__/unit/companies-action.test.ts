import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mockDeep, mockReset } from 'vitest-mock-extended'
import type { PrismaClient } from '@prisma/client'

const mockPrisma = mockDeep<PrismaClient>()

vi.mock('@/lib/db', () => ({
  prisma: mockPrisma,
}))

vi.mock('@/lib/permissions', () => ({
  canAccessCompany: vi.fn(),
  canAccessSensitivity: vi.fn(),
  canAccessModule: vi.fn(),
  getAccessibleCompanies: vi.fn(),
}))

import { auth } from '@/lib/auth'
import { canAccessCompany } from '@/lib/permissions'
import {
  createCompany,
  listCompanies,
  getCompany,
  updateCompany,
  deleteCompany,
} from '@/actions/companies'

const mockAuth = vi.mocked(auth)
const mockCanAccessCompany = vi.mocked(canAccessCompany)

const ORG_A = 'org-a-integration-test'
const ORG_B = 'org-b-integration-test'
const USER_A = 'user-a-001'
const COMPANY_A = 'company-a-001'

const SESSION_A = {
  user: {
    id: USER_A,
    organizationId: ORG_A,
    email: 'user-a@test.dk',
    name: 'Bruger A',
  },
  expires: '2099-01-01',
}

beforeEach(() => {
  mockReset(mockPrisma)
  vi.clearAllMocks()
})

describe('createCompany', () => {
  it('happy path — opretter selskab korrekt', async () => {
    mockAuth.mockResolvedValue(SESSION_A)
    const mockCompany = {
      id: COMPANY_A,
      organizationId: ORG_A,
      name: 'Test ApS',
      cvr: '12345678',
      companyType: 'ApS',
      address: null,
      city: null,
      postalCode: null,
      foundedDate: null,
      status: 'aktiv',
      notes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: USER_A,
      deletedAt: null,
    }
    mockPrisma.company.create.mockResolvedValue(mockCompany)
    mockPrisma.auditLog.create.mockResolvedValue({ id: 'audit-1' } as never)

    const result = await createCompany({
      name: 'Test ApS',
      cvr: '12345678',
      companyType: 'ApS',
      status: 'aktiv',
    })

    expect(result.error).toBeUndefined()
    expect(result.data).toBeDefined()
    expect(mockPrisma.company.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId: ORG_A,
          name: 'Test ApS',
        }),
      })
    )
  })

  it('uautoriseret adgang — ingen session', async () => {
    mockAuth.mockResolvedValue(null)
    const result = await createCompany({ name: 'Test ApS', status: 'aktiv' })
    expect(result.error).toBe('Ikke autoriseret')
    expect(mockPrisma.company.create).not.toHaveBeenCalled()
  })

  it('ugyldigt input — tomt navn returnerer fejl', async () => {
    mockAuth.mockResolvedValue(SESSION_A)
    const result = await createCompany({ name: '', status: 'aktiv' })
    expect(result.error).toBeDefined()
    expect(mockPrisma.company.create).not.toHaveBeenCalled()
  })

  it('organization_id sættes altid fra session — aldrig fra input', async () => {
    mockAuth.mockResolvedValue(SESSION_A)
    mockPrisma.company.create.mockResolvedValue({
      id: COMPANY_A,
      organizationId: ORG_A,
      name: 'Test ApS',
      cvr: null,
      companyType: null,
      address: null,
      city: null,
      postalCode: null,
      foundedDate: null,
      status: 'aktiv',
      notes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: USER_A,
      deletedAt: null,
    })
    mockPrisma.auditLog.create.mockResolvedValue({ id: 'audit-1' } as never)

    await createCompany({
      name: 'Test ApS',
      status: 'aktiv',
    })

    expect(mockPrisma.company.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId: ORG_A,
        }),
      })
    )
    // Sikr at organizationId IKKE er ORG_B
    const callArgs = mockPrisma.company.create.mock.calls[0][0]
    expect((callArgs as any).data.organizationId).toBe(ORG_A)
    expect((callArgs as any).data.organizationId).not.toBe(ORG_B)
  })
})

describe('listCompanies', () => {
  it('afviser uautoriseret bruger', async () => {
    mockAuth.mockResolvedValue(null)
    const result = await listCompanies()
    expect(result.error).toBe('Ikke autoriseret')
    expect(result.data).toBeUndefined()
  })

  it('returnerer selskaber for autoriseret bruger', async () => {
    mockAuth.mockResolvedValue(SESSION_A)
    mockPrisma.company.findMany.mockResolvedValue([])
    mockPrisma.company.count.mockResolvedValue(0)

    const result = await listCompanies()
    expect(result.error).toBeUndefined()
  })

  it('filtrerer altid på organizationId fra session', async () => {
    mockAuth.mockResolvedValue(SESSION_A)
    mockPrisma.company.findMany.mockResolvedValue([])
    mockPrisma.company.count.mockResolvedValue(0)

    await listCompanies()

    expect(mockPrisma.company.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: ORG_A,
        }),
      })
    )
  })
})

describe('getCompany', () => {
  it('afviser uautoriseret bruger', async () => {
    mockAuth.mockResolvedValue(null)
    const result = await getCompany({ companyId: COMPANY_A })
    expect(result.error).toBe('Ikke autoriseret')
  })

  it('afviser bruger uden adgang til selskab', async () => {
    mockAuth.mockResolvedValue(SESSION_A)
    mockCanAccessCompany.mockResolvedValue(false)

    const result = await getCompany({ companyId: COMPANY_A })
    expect(result.error).toBeDefined()
  })

  it('returnerer selskab for autoriseret bruger med adgang', async () => {
    mockAuth.mockResolvedValue(SESSION_A)
    mockCanAccessCompany.mockResolvedValue(true)

    const mockCompanyWithRelations = {
      id: COMPANY_A,
      organizationId: ORG_A,
      name: 'Test ApS',
      cvr: null,
      companyType: null,
      address: null,
      city: null,
      postalCode: null,
      foundedDate: null,
      status: 'aktiv',
      notes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: USER_A,
      deletedAt: null,
      ownerships: [],
      companyPersons: [],
      contracts: [],
    }

    mockPrisma.company.findUnique.mockResolvedValue(mockCompanyWithRelations as any)

    const result = await getCompany({ companyId: COMPANY_A })
    expect(result.error).toBeUndefined()
    expect(result.data).toBeDefined()
  })
})

describe('deleteCompany', () => {
  it('afviser uautoriseret bruger', async () => {
    mockAuth.mockResolvedValue(null)
    const result = await deleteCompany({ companyId: COMPANY_A })
    expect(result.error).toBe('Ikke autoriseret')
    expect(mockPrisma.company.update).not.toHaveBeenCalled()
  })

  it('afviser bruger uden adgang', async () => {
    mockAuth.mockResolvedValue(SESSION_A)
    mockCanAccessCompany.mockResolvedValue(false)

    const result = await deleteCompany({ companyId: COMPANY_A })
    expect(result.error).toBeDefined()
  })
})