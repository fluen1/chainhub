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
import { getCompany, getCompanies } from '@/actions/companies'
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

    // Verificer at Prisma-kaldet inkluderer organizationId som filter
    expect(mockPrisma.company.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: TENANT_A_ORG_ID,
        }),
      })
    )
  })

  it('getCompanies: returnerer kun tenant A selskaber — aldrig tenant B', async () => {
    mockAuth.mockResolvedValue(SESSION_A)

    const tenantACompanies = [
      {
        id: COMPANY_A_ID,
        name: 'Tenant A Selskab ApS',
        organizationId: TENANT_A_ORG_ID,
        cvr: '12345678',
        companyType: 'ApS',
        sensitivity: 'STANDARD',
        createdAt: new Date(),
        updatedAt: new Date(),
        address: null,
        city: null,
        zipCode: null,
        country: null,
        phone: null,
        email: null,
        website: null,
        description: null,
        isActive: true,
        parentCompanyId: null,
      },
    ]

    mockPrisma.company.findMany.mockResolvedValue(tenantACompanies as any)

    const result = await getCompanies()

    // Verificer at ingen tenant B selskaber returneres
    if (result.companies) {
      const hasTenantBCompany = result.companies.some(
        (c: any) => c.organizationId === TENANT_B_ORG_ID
      )
      expect(hasTenantBCompany).toBe(false)
    }

    // Verificer at Prisma-kaldet inkluderer organizationId filter
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
    mockPrisma.contract.findUnique.mockResolvedValue(null) // Returnerer null — forkert tenant

    const result = await getContract(CONTRACT_B_ID)

    expect(result.error).toBeDefined()
  })

  it('getContract: Prisma query ALTID inkluderer tenant A organisationId', async () => {
    mockAuth.mockResolvedValue(SESSION_A)
    mockCanAccessCompany.mockResolvedValue(true)
    mockPrisma.contract.findUnique.mockResolvedValue(null)

    await getContract(CONTRACT_A_ID)

    // Verificer at Prisma-kaldet inkluderer organizationId som filter
    expect(mockPrisma.contract.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: TENANT_A_ORG_ID,
        }),
      })
    )
  })

  it('listContracts: returnerer kun tenant A kontrakter — aldrig tenant B', async () => {
    mockAuth.mockResolvedValue(SESSION_A)

    const tenantAContracts = [
      {
        id: CONTRACT_A_ID,
        title: 'Tenant A Kontrakt',
        organizationId: TENANT_A_ORG_ID,
        companyId: COMPANY_A_ID,
        status: 'AKTIV',
        sensitivity: 'STANDARD',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]

    mockPrisma.contract.findMany.mockResolvedValue(tenantAContracts as any)

    const result = await listContracts()

    // Verificer at ingen tenant B kontrakter returneres
    if (result.contracts) {
      const hasTenantBContract = result.contracts.some(
        (c: any) => c.organizationId === TENANT_B_ORG_ID
      )
      expect(hasTenantBContract).toBe(false)
    }

    // Verificer at Prisma-kaldet inkluderer organizationId filter
    expect(mockPrisma.contract.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: TENANT_A_ORG_ID,
        }),
      })
    )
  })
})

// ==================== CROSS-TENANT ACCESS CONTROL ====================

describe('Cross-tenant: canAccessCompany afviser forkert tenant', () => {
  it('returnerer fejl når canAccessCompany returnerer false', async () => {
    mockAuth.mockResolvedValue(SESSION_A)
    mockCanAccessCompany.mockResolvedValue(false) // Ingen adgang

    const result = await getCompany({ companyId: COMPANY_B_ID })

    expect(result.error).toBeDefined()
  })
})

describe('Cross-tenant: session isolering', () => {
  it('tenant B session giver ikke adgang til tenant A data', async () => {
    // Tenant B er logget ind
    mockAuth.mockResolvedValue(SESSION_B)
    mockCanAccessCompany.mockResolvedValue(false) // B har ikke adgang til A's selskab
    mockPrisma.company.findUnique.mockResolvedValue(null)

    const result = await getCompany({ companyId: COMPANY_A_ID })

    // Tenant B kan ikke se tenant A's selskab
    expect(result.error).toBeDefined()
  })

  it('ingen session giver ingen adgang', async () => {
    mockAuth.mockResolvedValue(null)

    const result = await getCompany({ companyId: COMPANY_A_ID })

    expect(result.error).toBeDefined()
  })
})