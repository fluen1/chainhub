/**
 * Integration tests for contracts server action
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

vi.mock('@/lib/validations/contract', () => ({
  createContractSchema: {
    safeParse: vi.fn((input: unknown) => ({
      success: true,
      data: {
        companyId: (input as Record<string, string>).companyId ?? 'company-001',
        systemType: (input as Record<string, string>).systemType ?? 'EJERAFTALE',
        displayName: (input as Record<string, string>).displayName ?? 'Test Kontrakt',
        sensitivity: (input as Record<string, string>).sensitivity ?? 'STANDARD',
        deadlineType: 'INGEN',
        versionSource: 'CUSTOM',
        reminder90Days: true,
        reminder30Days: true,
        reminder7Days: true,
        reminderRecipients: [],
        ...input,
      },
    })),
  },
  updateContractSchema: { safeParse: vi.fn() },
  updateContractStatusSchema: {
    safeParse: vi.fn((input: unknown) => ({
      success: true,
      data: input,
    })),
  },
  getContractSchema: {
    safeParse: vi.fn((input: unknown) => ({
      success: true,
      data: input,
    })),
  },
  listContractsSchema: {
    safeParse: vi.fn((input: unknown) => ({
      success: true,
      data: {
        page: 1,
        pageSize: 20,
        ...(input as object),
      },
    })),
  },
  deleteContractSchema: {
    safeParse: vi.fn((input: unknown) => ({
      success: true,
      data: input,
    })),
  },
  addContractPartySchema: { safeParse: vi.fn() },
  removeContractPartySchema: { safeParse: vi.fn() },
  addContractRelationSchema: { safeParse: vi.fn() },
  removeContractRelationSchema: { safeParse: vi.fn() },
  requestUploadUrlSchema: { safeParse: vi.fn() },
  confirmVersionUploadSchema: { safeParse: vi.fn() },
  confirmAttachmentUploadSchema: { safeParse: vi.fn() },
  deleteAttachmentSchema: { safeParse: vi.fn() },
  deleteVersionSchema: { safeParse: vi.fn() },
  getMinSensitivity: vi.fn(() => 'STANDARD'),
  meetsMinimumSensitivity: vi.fn(() => true),
  isValidStatusTransition: vi.fn(() => true),
  isLag2Type: vi.fn(() => false),
}))

import { auth } from '@/lib/auth'
import { canAccessCompany, canAccessSensitivity } from '@/lib/permissions'
import {
  createContract,
  getContract,
  listContracts,
  updateContractStatus,
  deleteContract,
} from '@/actions/contracts'

const mockAuth = vi.mocked(auth)
const mockCanAccessCompany = vi.mocked(canAccessCompany)
const mockCanAccessSensitivity = vi.mocked(canAccessSensitivity)

const ORG_ID = 'test-org-contracts-001'
const USER_ID = 'test-user-contracts-001'
const COMPANY_ID = 'test-company-contracts-001'
const CONTRACT_ID = 'test-contract-001'

const SESSION = {
  user: { id: USER_ID, organizationId: ORG_ID, email: 'test@test.dk', name: 'Test' },
  expires: '2099-01-01',
}

const mockContractBase = {
  id: CONTRACT_ID,
  organizationId: ORG_ID,
  companyId: COMPANY_ID,
  systemType: 'EJERAFTALE',
  displayName: 'Test Ejeraftale',
  status: 'UDKAST',
  sensitivity: 'STANDARD',
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
  createdBy: USER_ID,
  lastViewedAt: null,
  lastViewedBy: null,
  deletedAt: null,
}

beforeEach(() => {
  mockReset(mockPrisma)
  vi.clearAllMocks()
})

describe('createContract', () => {
  it('happy path — opretter kontrakt med korrekt organization_id', async () => {
    mockAuth.mockResolvedValue(SESSION)
    mockCanAccessCompany.mockResolvedValue(true)
    mockCanAccessSensitivity.mockResolvedValue(true)
    mockPrisma.contract.create.mockResolvedValue(mockContractBase as never)
    mockPrisma.auditLog.create.mockResolvedValue({ id: 'audit-1' } as never)

    const result = await createContract({
      companyId: COMPANY_ID,
      systemType: 'EJERAFTALE',
      displayName: 'Test Ejeraftale',
      sensitivity: 'STANDARD',
    })

    expect(result.error).toBeUndefined()
    expect(mockPrisma.contract.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId: ORG_ID,
          status: 'UDKAST',
        }),
      })
    )
  })

  it('uautoriseret — ingen session', async () => {
    mockAuth.mockResolvedValue(null)
    const result = await createContract({
      companyId: COMPANY_ID,
      systemType: 'EJERAFTALE',
      displayName: 'Test',
      sensitivity: 'STANDARD',
    })
    expect(result.error).toBe('Ikke autoriseret')
    expect(mockPrisma.contract.create).not.toHaveBeenCalled()
  })

  it('ingen adgang til selskab', async () => {
    mockAuth.mockResolvedValue(SESSION)
    mockCanAccessCompany.mockResolvedValue(false)

    const result = await createContract({
      companyId: COMPANY_ID,
      systemType: 'EJERAFTALE',
      displayName: 'Test',
      sensitivity: 'STANDARD',
    })

    expect(result.error).toBe('Du har ikke adgang til dette selskab')
    expect(mockPrisma.contract.create).not.toHaveBeenCalled()
  })

  it('ny kontrakt oprettes ALTID med status UDKAST', async () => {
    mockAuth.mockResolvedValue(SESSION)
    mockCanAccessCompany.mockResolvedValue(true)
    mockCanAccessSensitivity.mockResolvedValue(true)
    mockPrisma.contract.create.mockResolvedValue(mockContractBase as never)
    mockPrisma.auditLog.create.mockResolvedValue({ id: 'audit-1' } as never)

    await createContract({
      companyId: COMPANY_ID,
      systemType: 'EJERAFTALE',
      displayName: 'Test',
      sensitivity: 'STANDARD',
    })

    expect(mockPrisma.contract.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'UDKAST' }),
      })
    )
  })
})

describe('updateContractStatus', () => {
  it('opdaterer status korrekt', async () => {
    mockAuth.mockResolvedValue(SESSION)
    mockCanAccessCompany.mockResolvedValue(true)
    mockCanAccessSensitivity.mockResolvedValue(true)
    mockPrisma.contract.findUnique.mockResolvedValue(mockContractBase as never)
    mockPrisma.contract.update.mockResolvedValue({
      ...mockContractBase,
      status: 'TIL_REVIEW',
    } as never)
    mockPrisma.auditLog.create.mockResolvedValue({ id: 'audit-1' } as never)

    const result = await updateContractStatus({
      contractId: CONTRACT_ID,
      newStatus: 'TIL_REVIEW',
    })

    expect(result.error).toBeUndefined()
  })

  it('afviser ugyldig status-transition', async () => {
    const { isValidStatusTransition } = await import('@/lib/validations/contract')
    vi.mocked(isValidStatusTransition).mockReturnValue(false)

    mockAuth.mockResolvedValue(SESSION)
    mockCanAccessCompany.mockResolvedValue(true)
    mockCanAccessSensitivity.mockResolvedValue(true)
    mockPrisma.contract.findUnique.mockResolvedValue(mockContractBase as never)

    const result = await updateContractStatus({
      contractId: CONTRACT_ID,
      newStatus: 'AKTIV',
    })

    expect(result.error).toBeDefined()
    expect(result.error).toContain('Ugyldig statusændring')
  })

  it('uautoriseret', async () => {
    mockAuth.mockResolvedValue(null)
    const result = await updateContractStatus({
      contractId: CONTRACT_ID,
      newStatus: 'TIL_REVIEW',
    })
    expect(result.error).toBe('Ikke autoriseret')
  })
})

describe('deleteContract — soft delete', () => {
  it('arkiverer kontrakt med deletedAt (soft delete)', async () => {
    mockAuth.mockResolvedValue(SESSION)
    mockCanAccessCompany.mockResolvedValue(true)
    mockCanAccessSensitivity.mockResolvedValue(true)
    mockPrisma.contract.findUnique.mockResolvedValue(mockContractBase as never)
    mockPrisma.contract.update.mockResolvedValue({} as never)
    mockPrisma.auditLog.create.mockResolvedValue({ id: 'audit-1' } as never)

    const result = await deleteContract({ contractId: CONTRACT_ID })

    expect(result.error).toBeUndefined()
    expect(mockPrisma.contract.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ deletedAt: expect.any(Date) }),
      })
    )
    expect(mockPrisma.contract.delete).not.toHaveBeenCalled()
  })

  it('fejler uden session', async () => {
    mockAuth.mockResolvedValue(null)
    const result = await deleteContract({ contractId: CONTRACT_ID })
    expect(result.error).toBe('Ikke autoriseret')
  })
})

describe('listContracts — sensitivity filter', () => {
  it('filtrerer automatisk på brugerens tilgængelige sensitivitetsniveauer', async () => {
    mockAuth.mockResolvedValue(SESSION)
    // Simulér COMPANY_MANAGER: kan se PUBLIC, STANDARD, INTERN, FORTROLIG — ikke STRENGT_FORTROLIG
    mockCanAccessSensitivity
      .mockResolvedValueOnce(true)  // PUBLIC
      .mockResolvedValueOnce(true)  // STANDARD
      .mockResolvedValueOnce(true)  // INTERN
      .mockResolvedValueOnce(true)  // FORTROLIG
      .mockResolvedValueOnce(false) // STRENGT_FORTROLIG

    mockPrisma.contract.findMany.mockResolvedValue([])
    mockPrisma.contract.count.mockResolvedValue(0)

    await listContracts({})

    const callArgs = mockPrisma.contract.findMany.mock.calls[0]?.[0]
    const sensitivityFilter = (callArgs as { where: { sensitivity: { in: string[] } } }).where.sensitivity

    expect(sensitivityFilter).toHaveProperty('in')
    expect((sensitivityFilter as { in: string[] }).in).not.toContain('STRENGT_FORTROLIG')
    expect((sensitivityFilter as { in: string[] }).in).toContain('FORTROLIG')
    expect((sensitivityFilter as { in: string[] }).in).toContain('STANDARD')
  })
})