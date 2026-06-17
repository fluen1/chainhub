/**
 * BA-10: Tenant isolation — verificerer at actions sender organization_id til Prisma
 *
 * Tester REAL adfærd: importerer actions, mocker auth() med en session,
 * mocker Prisma, og verificerer at queries inkluderer organization_id.
 * Erstatter den gamle JavaScript array.filter()-tilgang som ikke testede Prisma-kald.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks SKAL erklæres før imports af de mockede moduler ──────────────────

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}))

// vi.hoisted sikrer at mockPrisma initialiseres FØR vi.mock-hoisting
const { mockPrisma } = vi.hoisted(() => {
  const mockPrisma = {
    contract: {
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
      findFirst: vi.fn().mockResolvedValue(null),
    },
    task: {
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
      findFirst: vi.fn().mockResolvedValue(null),
    },
    case: {
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
      findFirst: vi.fn().mockResolvedValue(null),
    },
    caseCompany: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    person: {
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
    },
    company: {
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
      findFirst: vi.fn().mockResolvedValue(null),
    },
    document: {
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
    },
    userRoleAssignment: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    user: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    ownership: {
      findFirst: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
    },
    financialMetric: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    dividendRecord: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    auditLog: { create: vi.fn() },
    // Raw SQL-kald i getCompaniesPageData
    $queryRaw: vi.fn().mockResolvedValue([]),
  }
  return { mockPrisma }
})

vi.mock('@/lib/db', () => ({
  prisma: mockPrisma,
}))

vi.mock('@/lib/permissions', () => ({
  canAccessCompany: vi.fn().mockResolvedValue(true),
  canAccessModule: vi.fn().mockResolvedValue(true),
  canAccessSensitivity: vi.fn().mockResolvedValue(true),
  getAccessibleCompanies: vi.fn().mockResolvedValue(['company-1', 'company-2']),
  getAllowedSensitivityLevels: vi
    .fn()
    .mockResolvedValue(['PUBLIC', 'STANDARD', 'INTERN', 'FORTROLIG', 'STRENGT_FORTROLIG']),
}))

vi.mock('@/lib/rate-limit', () => ({
  checkActionRateLimit: vi.fn().mockResolvedValue({ limited: false }),
}))

vi.mock('@/lib/logger', () => ({
  captureError: vi.fn(),
}))

vi.mock('@/lib/audit', () => ({
  recordAuditEvent: vi.fn(),
}))

vi.mock('@/lib/ai/invalidate-cache', () => ({
  invalidateCompanyInsightsCache: vi.fn(),
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

// ── Importer actions EFTER mocks ───────────────────────────────────────────

import { getCasesPageData } from '@/actions/cases'
import { getCompaniesPageData } from '@/actions/companies'
import { getContractsPaginated } from '@/actions/contracts'
import { getPersonsPaginated } from '@/actions/persons'
import { getTasksPaginated } from '@/actions/tasks'
import { auth } from '@/lib/auth'

// ── Fælles session-fixture ─────────────────────────────────────────────────

const ORG_ID = 'org-test-uuid-1234'

const mockSession = {
  user: {
    id: 'user-test-uuid',
    organizationId: ORG_ID,
    email: 'test@chainhub.dk',
    name: 'Test Bruger',
  },
  expires: '2099-01-01T00:00:00.000Z',
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('Tenant isolation — Prisma queries inkluderer organization_id', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(auth).mockResolvedValue(
      mockSession as ReturnType<typeof auth> extends Promise<infer T> ? T : never
    )
  })

  it('getContractsPaginated sender organization_id til prisma.contract.findMany', async () => {
    await getContractsPaginated({ page: 1, pageSize: 20 })

    expect(mockPrisma.contract.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organization_id: ORG_ID,
        }),
      })
    )
  })

  it('getTasksPaginated sender organization_id til prisma.task.findMany', async () => {
    await getTasksPaginated({ page: 1, pageSize: 20 })

    expect(mockPrisma.task.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organization_id: ORG_ID,
        }),
      })
    )
  })

  it('getCasesPageData sender organization_id til prisma.case.findMany (case_companies JOIN)', async () => {
    await getCasesPageData()

    // Efter perf-fix: org-scoped JOIN i case.findMany WHERE i stedet for separat caseCompany.findMany
    expect(mockPrisma.caseCompany.findMany).not.toHaveBeenCalled()
    expect(mockPrisma.case.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organization_id: ORG_ID,
        }),
      })
    )
  })

  it('getPersonsPaginated sender organization_id til prisma.person.findMany', async () => {
    await getPersonsPaginated({ page: 1, pageSize: 15 })

    expect(mockPrisma.person.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organization_id: ORG_ID,
        }),
      })
    )
  })

  it('getCompaniesPageData sender organization_id til prisma.company.findMany', async () => {
    await getCompaniesPageData()

    expect(mockPrisma.company.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organization_id: ORG_ID,
        }),
      })
    )
  })
})

describe('Tenant isolation — én tenants data læses ikke af anden tenant', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('org-A og org-B har distinkte organization IDs', () => {
    const orgA = { organizationId: 'org-a-uuid-1234' }
    const orgB = { organizationId: 'org-b-uuid-5678' }
    expect(orgA.organizationId).not.toBe(orgB.organizationId)
  })

  it('session med org-A kalder Prisma med org-A — ikke org-B', async () => {
    const orgAId = 'org-a-xxxx'
    const orgBId = 'org-b-yyyy'

    vi.mocked(auth).mockResolvedValue({
      ...mockSession,
      user: { ...mockSession.user, organizationId: orgAId },
    } as ReturnType<typeof auth> extends Promise<infer T> ? T : never)

    await getContractsPaginated({ page: 1, pageSize: 20 })

    const calls = mockPrisma.contract.findMany.mock.calls
    expect(calls.length).toBeGreaterThan(0)

    const firstCallWhere = calls[0]![0]?.where
    expect(firstCallWhere?.organization_id).toBe(orgAId)
    expect(firstCallWhere?.organization_id).not.toBe(orgBId)
  })

  it('deleted_at: null filtrerer altid soft-slettede poster ud af tasks-query', async () => {
    vi.mocked(auth).mockResolvedValue(
      mockSession as ReturnType<typeof auth> extends Promise<infer T> ? T : never
    )

    await getTasksPaginated({ page: 1, pageSize: 20 })

    expect(mockPrisma.task.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          deleted_at: null,
        }),
      })
    )
  })

  it('deleted_at: null filtrerer altid soft-slettede poster ud af contracts-query', async () => {
    vi.mocked(auth).mockResolvedValue(
      mockSession as ReturnType<typeof auth> extends Promise<infer T> ? T : never
    )

    await getContractsPaginated({ page: 1, pageSize: 20 })

    expect(mockPrisma.contract.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          deleted_at: null,
        }),
      })
    )
  })
})
