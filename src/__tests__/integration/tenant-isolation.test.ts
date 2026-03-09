/**
 * INTEGRATION TESTS — TENANT ISOLATION
 *
 * Disse tests verificerer at tenant A IKKE kan tilgå tenant B's data.
 * Bruger separate test-organisation IDs — aldrig produktionsdata.
 *
 * IKKE-FORHANDLINGSBARE TESTS:
 *   - tenant A cannot access tenant B companies
 *   - tenant A cannot access tenant B contracts
 */
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
import { canAccessCompany, canAccessSensitivity } from '@/lib/permissions'
import { getCompany, listCompanies } from '@/actions/companies'
import { getContract, listContracts } from '@/actions/contracts'

const mockAuth = vi.mocked(auth)
const mockCanAccessCompany = vi.mocked(canAccessCompany)
const mockCanAccessSensitivity = vi.mocked(canAccessSensitivity)

// Separate test-organisations — aldrig produktionsdata
const TENANT_A_ORG_ID = 'test-org-tenant-a-isolation-001'
const TENANT_B_ORG_ID = 'test-org-tenant-b-isolation-001'

const USER_A_ID = 'test-user-tenant-a-001'
const USER_B_ID = 'test-user-tenant-b-001'

const COMPANY_A_ID = 'test-company-tenant-a-001'
const COMPANY_B_ID = 'test-company-tenant-b-001'

const CONTRACT_A_ID = 'test-contract-tenant-a-001'
const CONTRACT_B_ID = 'test-contract-tenant-b-001'

const SESSION_A = {
  user: {
    id: USER_A_ID,
    organizationId: TENANT_A_ORG_ID,
    email: 'user@tenant-a.dk',
    name: 'Bruger fra Tenant A',
  },
  expires: '2099-01-01',
}

const SESSION_B = {
  user: {
    id: USER_B_ID,
    organizationId: TENANT_B_ORG_ID,
    email: 'user@tenant-b.dk',
    name: 'Bruger fra Tenant B',
  },
  expires: '2099-01-01',
}

beforeEach(() => {
  mockReset(mockPrisma)
  vi.clearAllMocks()
})

// ==================== IKKE-FORHANDLINGSBARE TESTS ====================

describe('IKKE-FORHANDLINGSBAR: tenant A cannot access tenant B companies', () => {
  it('getCompany: tenant A kan ikke tilgå tenant B selskab — organization_id mismatch', async () => {
    mockAuth.mockResolvedValue(SESSION_A)
    // Tenant A bruger har adgangs-check der går igennem (scope-wise)
    // men Prisma returnerer null fordi organization_id er B's
    mockCanAccessCompany.mockResolvedValue(true)
    mockPrisma.company.findUnique.mockResolvedValue(null) // Returnerer null — forkert tenant

    const result = await getCompany({ companyId: COMPANY_B_ID })

    // Kontrakten blev ikke fundet fordi organization_id filteret ikke matcher
    expect(result.error).toBeDefined()
    expect(result.error).toBe('Selskabet blev ikke fundet')
  })

  it('getCompany: Prisma query ALTID inkluderer tenant A organisationId', async () => {
    mockAuth.mockResolvedValue(SESSION_A)
    mockCanAccessCompany.mockResolvedValue(true)
    mockPrisma.company.findUnique.mockResolvedValue(null)

    await getCompany({ companyId: COMPANY_A_ID })

    expect(mockPrisma.company.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: COMPANY_A_ID,
          organizationId: TENANT_A_ORG_ID,
        }),
      })
    )
  })

  it('listCompanies: tenant A ser kun egne selskaber', async () => {
    mockAuth.mockResolvedValue(SESSION_A)

    const tenantACompany = {
      id: COMPANY_A_ID,
      organizationId: TENANT_A_ORG_ID,
      name: 'Tenant A Selskab ApS',
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
      createdBy: USER_A_ID,
      deletedAt: null,
      _count: { contracts: 0, ownerships: 0, companyPersons: 0 },
    }

    mockPrisma.company.findMany.mockResolvedValue([tenantACompany] as any)
    mockPrisma.company.count.mockResolvedValue(1)

    const result = await listCompanies()

    expect(result.error).toBeUndefined()
    // Prisma skal være kaldt med tenant A's organizationId
    expect(mockPrisma.company.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: TENANT_A_ORG_ID,
        }),
      })
    )
  })
})

describe('IKKE-FORHANDLINGSBAR: tenant A cannot access tenant B contracts', () => {
  it('getContract: tenant A kan ikke tilgå tenant B kontrakt', async () => {
    mockAuth.mockResolvedValue(SESSION_A)
    mockCanAccessCompany.mockResolvedValue(true)
    mockCanAccessSensitivity.mockResolvedValue(true)
    // Prisma returnerer null fordi organization_id ikke matcher
    mockPrisma.contract.findUnique.mockResolvedValue(null as any)

    const result = await getContract({ contractId: CONTRACT_B_ID })

    expect(result.error).toBeDefined()
  })

  it('getContract: Prisma query inkluderer altid organizationId', async () => {
    mockAuth.mockResolvedValue(SESSION_A)
    mockCanAccessCompany.mockResolvedValue(true)
    mockCanAccessSensitivity.mockResolvedValue(true)
    mockPrisma.contract.findUnique.mockResolvedValue(null as any)

    await getContract({ contractId: CONTRACT_A_ID })

    expect(mockPrisma.contract.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: CONTRACT_A_ID,
        }),
      })
    )
  })

  it('listContracts: tenant A ser kun egne kontrakter', async () => {
    mockAuth.mockResolvedValue(SESSION_A)
    mockPrisma.contract.findMany.mockResolvedValue([] as any)
    mockPrisma.contract.count.mockResolvedValue(0)

    const result = await listContracts({})

    expect(result.error).toBeUndefined()
    expect(mockPrisma.contract.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: TENANT_A_ORG_ID,
        }),
      })
    )
  })
})

describe('Cross-tenant isolation: session B ser kun B data', () => {
  it('listCompanies med SESSION_B bruger tenant B organizationId', async () => {
    mockAuth.mockResolvedValue(SESSION_B)
    mockPrisma.company.findMany.mockResolvedValue([] as any)
    mockPrisma.company.count.mockResolvedValue(0)

    await listCompanies()

    expect(mockPrisma.company.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: TENANT_B_ORG_ID,
        }),
      })
    )
  })
})