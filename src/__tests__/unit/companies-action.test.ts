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
  getCompanies,
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

    await createCompany({ name: 'Test ApS', status: 'aktiv' })

    expect(mockPrisma.company.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId: ORG_A,
        }),
      })
    )
    expect(mockPrisma.company.create).not.toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId: ORG_B,
        }),
      })
    )
  })
})

describe('deleteCompany', () => {
  it('sletter selskab korrekt', async () => {
    mockAuth.mockResolvedValue(SESSION_A)
    mockCanAccessCompany.mockResolvedValue(true)
    mockPrisma.company.update.mockResolvedValue({
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
      deletedAt: new Date(),
    })
    mockPrisma.auditLog.create.mockResolvedValue({ id: 'audit-1' } as never)

    const result = await deleteCompany(COMPANY_A)
    expect(result.error).toBeUndefined()
  })

  it('afviser sletning uden adgang', async () => {
    mockAuth.mockResolvedValue(SESSION_A)
    mockCanAccessCompany.mockResolvedValue(false)

    const result = await deleteCompany(COMPANY_A)
    expect(result.error).toBeDefined()
    expect(mockPrisma.company.update).not.toHaveBeenCalled()
  })
})

describe('getCompany', () => {
  it('returnerer selskab ved korrekt adgang', async () => {
    mockAuth.mockResolvedValue(SESSION_A)
    mockCanAccessCompany.mockResolvedValue(true)
    mockPrisma.company.findUnique.mockResolvedValue({
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
    } as never)

    const result = await getCompany(COMPANY_A)
    expect(result.error).toBeUndefined()
    expect(result.data).toBeDefined()
  })

  it('afviser adgang uden tilladelse', async () => {
    mockAuth.mockResolvedValue(SESSION_A)
    mockCanAccessCompany.mockResolvedValue(false)

    const result = await getCompany(COMPANY_A)
    expect(result.error).toBeDefined()
  })
})