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
    const result = await createCompany({ name: 'Test ApS' })
    expect(result.error).toBe('Ikke autoriseret')
    expect(mockPrisma.company.create).not.toHaveBeenCalled()
  })

  it('ugyldigt input — tomt navn returnerer fejl', async () => {
    mockAuth.mockResolvedValue(SESSION_A)
    const result = await createCompany({ name: '' })
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

    await createCompany({ name: 'Test ApS' })

    expect(mockPrisma.company.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId: ORG_A,
        }),
      })
    )
  })
})

describe('listCompanies', () => {
  it('returnerer kun selskaber for brugerens organisation', async () => {
    mockAuth.mockResolvedValue(SESSION_A)
    mockPrisma.company.findMany.mockResolvedValue([])

    await listCompanies()

    expect(mockPrisma.company.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: ORG_A,
          deletedAt: null,
        }),
      })
    )
  })

  it('returnerer fejl ved ingen session', async () => {
    mockAuth.mockResolvedValue(null)
    const result = await listCompanies()
    expect(result.error).toBe('Ikke autoriseret')
  })
})

describe('getCompany', () => {
  it('returnerer fejl når bruger ikke har adgang til selskabet', async () => {
    mockAuth.mockResolvedValue(SESSION_A)
    mockCanAccessCompany.mockResolvedValue(false)

    const result = await getCompany({ companyId: COMPANY_A })
    expect(result.error).toBe('Du har ikke adgang til dette selskab')
    expect(mockPrisma.company.findUnique).not.toHaveBeenCalled()
  })

  it('returnerer selskab når bruger har adgang', async () => {
    mockAuth.mockResolvedValue(SESSION_A)
    mockCanAccessCompany.mockResolvedValue(true)
    const mockCompany = {
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
      _count: { contracts: 0, caseCompanies: 0 },
    }
    mockPrisma.company.findUnique.mockResolvedValue(mockCompany as never)
    mockPrisma.auditLog.create.mockResolvedValue({ id: 'audit-1' } as never)

    const result = await getCompany({ companyId: COMPANY_A })
    expect(result.error).toBeUndefined()
    expect(result.data?.id).toBe(COMPANY_A)
  })

  it('query inkluderer organization_id fra session', async () => {
    mockAuth.mockResolvedValue(SESSION_A)
    mockCanAccessCompany.mockResolvedValue(true)
    mockPrisma.company.findUnique.mockResolvedValue(null)

    await getCompany({ companyId: COMPANY_A })

    expect(mockPrisma.company.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: COMPANY_A,
          organizationId: ORG_A,
          deletedAt: null,
        }),
      })
    )
  })
})

describe('deleteCompany — soft delete', () => {
  it('sætter deletedAt — sletter ikke hard', async () => {
    mockAuth.mockResolvedValue(SESSION_A)
    mockCanAccessCompany.mockResolvedValue(true)
    mockPrisma.company.update.mockResolvedValue({} as never)
    mockPrisma.auditLog.create.mockResolvedValue({ id: 'audit-1' } as never)

    await deleteCompany({ companyId: COMPANY_A })

    expect(mockPrisma.company.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          deletedAt: expect.any(Date),
        }),
      })
    )
    expect(mockPrisma.company.delete).not.toHaveBeenCalled()
  })

  it('fejler ved ingen session', async () => {
    mockAuth.mockResolvedValue(null)
    const result = await deleteCompany({ companyId: COMPANY_A })
    expect(result.error).toBe('Ikke autoriseret')
  })
})