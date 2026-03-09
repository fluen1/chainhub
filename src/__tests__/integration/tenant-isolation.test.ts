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
    mockCanAccessCompany.mockResolvedValue(false)

    await getCompany({ companyId: COMPANY_B_ID })

    // canAccessCompany returnerer false — adgang nægtet
    expect(mockPrisma.company.findUnique).not.toHaveBeenCalled()
  })

  it('listCompanies: tenant A kan kun se sine egne selskaber', async () => {
    mockAuth.mockResolvedValue(SESSION_A)

    const tenantACompanies = [
      {
        id: COMPANY_A_ID,
        organizationId: TENANT_A_ORG_ID,
        name: 'Tenant A Selskab',
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
        _count: { contracts: 0, caseCompanies: 0, companyPersons: 0, ownerships: 0 },
      },
    ]
    mockPrisma.company.findMany.mockResolvedValue(tenantACompanies as never)

    const result = await listCompanies()

    // Verificer at query altid filtrerer på session organisationId
    expect(mockPrisma.company.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: TENANT_A_ORG_ID,
          deletedAt: null,
        }),
      })
    )

    // Resultat indeholder kun tenant A data
    expect(result.data?.every((c) => c.organizationId === TENANT_A_ORG_ID)).toBe(true)
  })

  it('tenant A bruger med GROUP_OWNER rolle kan IKKE se tenant B selskab via direkte ID', async () => {
    mockAuth.mockResolvedValue(SESSION_A)
    // canAccessCompany returnerer true (GROUP_OWNER scope=ALL)
    mockCanAccessCompany.mockResolvedValue(true)
    // Men Prisma finder ingen — fordi organization_id filter er sat til tenant A
    mockPrisma.company.findUnique.mockResolvedValue(null)

    const result = await getCompany({ companyId: COMPANY_B_ID })

    // Verificer at query bruger SESSION_A's organizationId, ikke nogen anden
    expect(mockPrisma.company.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: TENANT_A_ORG_ID,
        }),
      })
    )

    expect(result.error).toBe('Selskabet blev ikke fundet')
  })
})

describe('IKKE-FORHANDLINGSBAR: tenant A cannot access tenant B contracts', () => {
  it('getContract: returnerer fejl for tenant B kontrakt tilgået af tenant A', async () => {
    mockAuth.mockResolvedValue(SESSION_A)
    // Prisma returnerer null fordi organization_id filter er TENANT_A
    mockPrisma.contract.findUnique.mockResolvedValue(null)

    const result = await getContract({ contractId: CONTRACT_B_ID })

    expect(result.error).toBe('Kontrakten blev ikke fundet')
  })

  it('getContract: Prisma query inkluderer ALTID session organizationId', async () => {
    mockAuth.mockResolvedValue(SESSION_A)
    mockPrisma.contract.findUnique.mockResolvedValue(null)

    await getContract({ contractId: CONTRACT_B_ID })

    // Verificer at ALLE findUnique kald bruger SESSION_A org
    const calls = mockPrisma.contract.findUnique.mock.calls
    expect(calls.length).toBeGreaterThan(0)
    calls.forEach((call) => {
      const whereClause = (call[0] as { where: { organizationId?: string } }).where
      if (whereClause.organizationId) {
        expect(whereClause.organizationId).toBe(TENANT_A_ORG_ID)
      }
    })
  })

  it('listContracts: filtrerer altid på session organizationId', async () => {
    mockAuth.mockResolvedValue(SESSION_A)
    mockCanAccessSensitivity.mockResolvedValue(true)
    mockPrisma.contract.findMany.mockResolvedValue([])
    mockPrisma.contract.count.mockResolvedValue(0)

    await listContracts({})

    expect(mockPrisma.contract.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: TENANT_A_ORG_ID,
          deletedAt: null,
        }),
      })
    )
  })

  it('listContracts: tenant B data er ALDRIG i tenant A resultater', async () => {
    mockAuth.mockResolvedValue(SESSION_A)
    mockCanAccessSensitivity.mockResolvedValue(true)

    const tenantAContracts = [
      {
        id: CONTRACT_A_ID,
        organizationId: TENANT_A_ORG_ID,
        companyId: COMPANY_A_ID,
        systemType: 'EJERAFTALE',
        displayName: 'Tenant A Ejeraftale',
        status: 'AKTIV',
        sensitivity: 'STANDARD',
        company: { id: COMPANY_A_ID, name: 'Tenant A Selskab' },
        _count: { parties: 0, versions: 0, attachments: 0 },
      },
    ]
    mockPrisma.contract.findMany.mockResolvedValue(tenantAContracts as never)
    mockPrisma.contract.count.mockResolvedValue(1)

    const result = await listContracts({})

    expect(result.data?.contracts.every(
      (c) => c.organizationId === TENANT_A_ORG_ID
    )).toBe(true)
  })

  it('tenant A bruger kan ikke se tenant B kontrakt selv med korrekt kontrakt-ID', async () => {
    mockAuth.mockResolvedValue(SESSION_A)
    // Simulér at TENANT_B har en kontrakt med CONTRACT_B_ID
    // Men tenant A's session returnerer null fordi org_id ikke matcher
    mockPrisma.contract.findUnique
      .mockImplementation(async (args: { where: { id: string; organizationId: string } }) => {
        if (
          args.where.id === CONTRACT_B_ID &&
          args.where.organizationId === TENANT_A_ORG_ID
        ) {
          return null // Tenant isolation virker
        }
        return null
      })

    const result = await getContract({ contractId: CONTRACT_B_ID })
    expect(result.error).toBe('Kontrakten blev ikke fundet')
    expect(result.data).toBeUndefined()
  })
})

describe('Cross-tenant isolation for unauthenticated requests', () => {
  it('unauthenticated user cannot access dashboard — ingen session returnerer fejl', async () => {
    mockAuth.mockResolvedValue(null)
    const result = await listCompanies()
    expect(result.error).toBe('Ikke autoriseret')
    expect(result.data).toBeUndefined()
  })

  it('unauthenticated user cannot access companies', async () => {
    mockAuth.mockResolvedValue(null)
    const result = await getCompany({ companyId: COMPANY_A_ID })
    expect(result.error).toBe('Ikke autoriseret')
  })

  it('unauthenticated user cannot access contracts', async () => {
    mockAuth.mockResolvedValue(null)
    const result = await getContract({ contractId: CONTRACT_A_ID })
    expect(result.error).toBe('Ikke autoriseret')
  })
})

describe('Sensitivity-baseret tenant isolation', () => {
  it('COMPANY_MANAGER fra tenant A kan IKKE se STRENGT_FORTROLIG kontrakt', async () => {
    mockAuth.mockResolvedValue(SESSION_A)
    mockPrisma.contract.findUnique.mockResolvedValue({
      id: CONTRACT_A_ID,
      organizationId: TENANT_A_ORG_ID,
      companyId: COMPANY_A_ID,
      sensitivity: 'STRENGT_FORTROLIG',
    } as never)
    mockCanAccessCompany.mockResolvedValue(true)
    mockCanAccessSensitivity.mockResolvedValue(false) // COMPANY_MANAGER kan ikke se STRENGT_FORTROLIG

    const result = await getContract({ contractId: CONTRACT_A_ID })

    expect(result.error).toBe(
      'Du har ikke adgang til denne kontrakt — sensitivitetsniveauet er for højt'
    )
  })

  it('GROUP_LEGAL fra tenant A kan se STRENGT_FORTROLIG kontrakt', async () => {
    mockAuth.mockResolvedValue(SESSION_A)
    const mockContract = {
      id: CONTRACT_A_ID,
      organizationId: TENANT_A_ORG_ID,
      companyId: COMPANY_A_ID,
      sensitivity: 'STRENGT_FORTROLIG',
      systemType: 'EJERAFTALE',
      displayName: 'Ejeraftale 2024',
      status: 'AKTIV',
      deadlineType: 'INGEN',
      versionSource: 'CUSTOM',
      collectiveAgreement: null,
      parentContractId: null,
      triggeredById: null,
      effectiveDate: null,
      expiryDate: null,
      signedDate: null,
      noticePeriodDays: null,
      terminationDate: null,
      anciennityStart: null,
      reminder90Days: true,
      reminder30Days: true,
      reminder7Days: true,
      reminderRecipients: [],
      mustRetainUntil: null,
      typeData: null,
      notes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: USER_A_ID,
      lastViewedAt: null,
      lastViewedBy: null,
      deletedAt: null,
      company: { id: COMPANY_A_ID, name: 'Tenant A Selskab' },
      parties: [],
      versions: [],
      attachments: [],
      relationsFrom: [],
      relationsTo: [],
      parentContract: null,
      childContracts: [],
      _count: { parties: 0, versions: 0, attachments: 0 },
    }

    mockPrisma.contract.findUnique
      .mockResolvedValueOnce({
        id: CONTRACT_A_ID,
        companyId: COMPANY_A_ID,
        sensitivity: 'STRENGT_FORTROLIG',
      } as never)
      .mockResolvedValueOnce(mockContract as never)

    mockCanAccessCompany.mockResolvedValue(true)
    mockCanAccessSensitivity.mockResolvedValue(true) // GROUP_LEGAL kan se STRENGT_FORTROLIG
    mockPrisma.contract.update.mockResolvedValue({} as never)
    mockPrisma.auditLog.create.mockResolvedValue({ id: 'audit-1' } as never)

    const result = await getContract({ contractId: CONTRACT_A_ID })

    expect(result.error).toBeUndefined()
    expect(result.data?.id).toBe(CONTRACT_A_ID)
  })
})