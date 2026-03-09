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
        companyId: (input as Record<string, unknown>).companyId ?? 'company-001',
        systemType: (input as Record<string, unknown>).systemType ?? 'EJERAFTALE',
        displayName: (input as Record<string, unknown>).displayName ?? 'Test Kontrakt',
        sensitivity: (input as Record<string, unknown>).sensitivity ?? 'STANDARD',
        deadlineType: 'INGEN',
        versionSource: 'CUSTOM',
        reminder90Days: true,
        reminder30Days: true,
        reminder7Days: true,
        reminderRecipients: [],
        ...(typeof input === 'object' && input !== null ? input : {}),
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
        ...(typeof input === 'object' && input !== null ? input : {}),
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
  user: {
    id: USER_ID,
    organizationId: ORG_ID,
    email: 'user@test.dk',
    name: 'Test Bruger',
  },
  expires: '2099-01-01',
}

const VALID_CONTRACT_INPUT = {
  companyId: COMPANY_ID,
  systemType: 'EJERAFTALE' as const,
  displayName: 'Test Kontrakt',
  sensitivity: 'STANDARD' as const,
  deadlineType: 'INGEN' as const,
  versionSource: 'CUSTOM' as const,
  reminder90Days: true,
  reminder30Days: true,
  reminder7Days: true,
  reminderRecipients: [],
}

const MOCK_CONTRACT = {
  id: CONTRACT_ID,
  organizationId: ORG_ID,
  companyId: COMPANY_ID,
  systemType: 'EJERAFTALE',
  displayName: 'Test Kontrakt',
  sensitivity: 'STANDARD',
  status: 'UDKAST',
  deadlineType: 'INGEN',
  versionSource: 'CUSTOM',
  reminder90Days: true,
  reminder30Days: true,
  reminder7Days: true,
  reminderRecipients: [],
  createdAt: new Date(),
  updatedAt: new Date(),
  createdBy: USER_ID,
  deletedAt: null,
  deadline: null,
  description: null,
  externalRef: null,
  counterpartyName: null,
  counterpartyOrg: null,
  counterpartyContact: null,
  signingDeadline: null,
  effectiveDate: null,
  expiryDate: null,
  autoRenewal: false,
  noticePeriodDays: null,
  parentContractId: null,
  lag2Type: null,
}

beforeEach(() => {
  mockReset(mockPrisma)
  vi.clearAllMocks()
})

describe('createContract', () => {
  it('uautoriseret — returnerer fejl uden session', async () => {
    mockAuth.mockResolvedValue(null)
    const result = await createContract(VALID_CONTRACT_INPUT)
    expect(result.error).toBe('Ikke autoriseret')
    expect(mockPrisma.contract.create).not.toHaveBeenCalled()
  })

  it('ingen adgang til selskab — returnerer fejl', async () => {
    mockAuth.mockResolvedValue(SESSION)
    mockCanAccessCompany.mockResolvedValue(false)
    const result = await createContract(VALID_CONTRACT_INPUT)
    expect(result.error).toBeDefined()
    expect(mockPrisma.contract.create).not.toHaveBeenCalled()
  })

  it('happy path — opretter kontrakt', async () => {
    mockAuth.mockResolvedValue(SESSION)
    mockCanAccessCompany.mockResolvedValue(true)
    mockCanAccessSensitivity.mockResolvedValue(true)
    mockPrisma.contract.create.mockResolvedValue(MOCK_CONTRACT as never)
    mockPrisma.auditLog.create.mockResolvedValue({ id: 'audit-1' } as never)

    const result = await createContract(VALID_CONTRACT_INPUT)

    expect(result.error).toBeUndefined()
    expect(result.data).toBeDefined()
    expect(mockPrisma.contract.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId: ORG_ID,
          companyId: COMPANY_ID,
        }),
      })
    )
  })
})

describe('getContract', () => {
  it('uautoriseret — returnerer fejl', async () => {
    mockAuth.mockResolvedValue(null)
    const result = await getContract({ contractId: CONTRACT_ID })
    expect(result.error).toBe('Ikke autoriseret')
  })

  it('kontrakt ikke fundet — returnerer fejl', async () => {
    mockAuth.mockResolvedValue(SESSION)
    mockPrisma.contract.findUnique.mockResolvedValue(null)
    const result = await getContract({ contractId: CONTRACT_ID })
    expect(result.error).toBeDefined()
  })

  it('happy path — returnerer kontrakt', async () => {
    mockAuth.mockResolvedValue(SESSION)
    mockCanAccessCompany.mockResolvedValue(true)
    mockCanAccessSensitivity.mockResolvedValue(true)
    mockPrisma.contract.findUnique.mockResolvedValue(MOCK_CONTRACT as never)

    const result = await getContract({ contractId: CONTRACT_ID })
    expect(result.error).toBeUndefined()
    expect(result.data).toBeDefined()
  })
})

describe('listContracts', () => {
  it('uautoriseret — returnerer fejl', async () => {
    mockAuth.mockResolvedValue(null)
    const result = await listContracts({})
    expect(result.error).toBe('Ikke autoriseret')
  })

  it('happy path — returnerer liste', async () => {
    mockAuth.mockResolvedValue(SESSION)
    mockPrisma.contract.findMany.mockResolvedValue([MOCK_CONTRACT] as never)
    mockPrisma.contract.count.mockResolvedValue(1)

    const result = await listContracts({ companyId: COMPANY_ID })
    expect(result.error).toBeUndefined()
  })
})

describe('updateContractStatus', () => {
  it('uautoriseret — returnerer fejl', async () => {
    mockAuth.mockResolvedValue(null)
    const result = await updateContractStatus({ id: CONTRACT_ID, status: 'AKTIV' })
    expect(result.error).toBe('Ikke autoriseret')
  })

  it('happy path — opdaterer status', async () => {
    mockAuth.mockResolvedValue(SESSION)
    mockCanAccessCompany.mockResolvedValue(true)
    mockPrisma.contract.findUnique.mockResolvedValue(MOCK_CONTRACT as never)
    mockPrisma.contract.update.mockResolvedValue({
      ...MOCK_CONTRACT,
      status: 'AKTIV',
    } as never)
    mockPrisma.auditLog.create.mockResolvedValue({ id: 'audit-1' } as never)

    const result = await updateContractStatus({ id: CONTRACT_ID, status: 'AKTIV' })
    expect(result.error).toBeUndefined()
  })
})

describe('deleteContract', () => {
  it('uautoriseret — returnerer fejl', async () => {
    mockAuth.mockResolvedValue(null)
    const result = await deleteContract({ contractId: CONTRACT_ID })
    expect(result.error).toBe('Ikke autoriseret')
  })

  it('happy path — sletter kontrakt', async () => {
    mockAuth.mockResolvedValue(SESSION)
    mockCanAccessCompany.mockResolvedValue(true)
    mockPrisma.contract.findUnique.mockResolvedValue(MOCK_CONTRACT as never)
    mockPrisma.contract.update.mockResolvedValue({
      ...MOCK_CONTRACT,
      deletedAt: new Date(),
    } as never)
    mockPrisma.auditLog.create.mockResolvedValue({ id: 'audit-1' } as never)

    const result = await deleteContract({ contractId: CONTRACT_ID })
    expect(result.error).toBeUndefined()
  })
})