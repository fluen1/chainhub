import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({
  auth: vi.fn().mockResolvedValue({
    user: { id: 'user-1', organizationId: 'org-1' },
  }),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    contract: {
      create: vi.fn().mockResolvedValue({ id: 'c-1', sensitivity: 'INTERN' }),
      findFirst: vi.fn(),
      update: vi.fn().mockResolvedValue({ id: 'c-1' }),
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
    },
    auditLog: { create: vi.fn().mockResolvedValue({}) },
  },
}))

vi.mock('@/lib/permissions', () => ({
  canAccessCompany: vi.fn().mockResolvedValue(true),
  canAccessSensitivity: vi.fn().mockResolvedValue(true),
  canAccessModule: vi.fn().mockResolvedValue(true),
}))

vi.mock('@/lib/logger', () => ({
  captureError: vi.fn(),
  createLogger: vi.fn(() => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

import {
  createContract,
  updateContractStatus,
  deleteContract,
  getContractList,
} from '@/actions/contracts'

const UUID_1 = 'a1b2c3d4-e5f6-4789-9abc-def012345678'

describe('createContract', () => {
  beforeEach(() => vi.clearAllMocks())

  it('happy path opretter kontrakt', async () => {
    const result = await createContract({
      companyId: UUID_1,
      systemType: 'LEJEKONTRAKT_ERHVERV',
      displayName: 'Lejekontrakt Østerbro',
      sensitivity: 'INTERN',
    } as never)
    expect('data' in result).toBe(true)
  })

  it('afviser uden company-adgang', async () => {
    const perms = await import('@/lib/permissions')
    vi.mocked(perms.canAccessCompany).mockResolvedValueOnce(false)
    const result = await createContract({
      companyId: UUID_1,
      systemType: 'LEJEKONTRAKT_ERHVERV',
      displayName: 'X',
      sensitivity: 'INTERN',
    } as never)
    expect('error' in result).toBe(true)
  })

  it('afviser uden sensitivity-adgang', async () => {
    const perms = await import('@/lib/permissions')
    vi.mocked(perms.canAccessSensitivity).mockResolvedValueOnce(false)
    const result = await createContract({
      companyId: UUID_1,
      systemType: 'LEJEKONTRAKT_ERHVERV',
      displayName: 'X',
      sensitivity: 'INTERN',
    } as never)
    expect('error' in result).toBe(true)
  })

  it('afviser hvis SENSITIVITY_MINIMUM ikke opfyldt (EJERAFTALE kræver STRENGT_FORTROLIG)', async () => {
    const result = await createContract({
      companyId: UUID_1,
      systemType: 'EJERAFTALE',
      displayName: 'Ejeraftale',
      sensitivity: 'INTERN',
    } as never)
    expect('error' in result).toBe(true)
    if ('error' in result) {
      expect(result.error).toMatch(/sensitivitetsniveau/)
    }
  })

  it('skriver auditLog for FORTROLIG kontrakt', async () => {
    const { prisma } = await import('@/lib/db')
    await createContract({
      companyId: UUID_1,
      systemType: 'NDA',
      displayName: 'NDA test',
      sensitivity: 'FORTROLIG',
    } as never)
    expect(prisma.auditLog.create).toHaveBeenCalled()
  })
})

describe('updateContractStatus', () => {
  beforeEach(() => vi.clearAllMocks())

  it('valid transition (UDKAST → TIL_REVIEW) opdaterer + logger audit', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.contract.findFirst).mockImplementation((() =>
      Promise.resolve({
        id: UUID_1,
        status: 'UDKAST',
        sensitivity: 'INTERN',
        notes: '',
        company_id: UUID_1,
      })) as never)
    const result = await updateContractStatus({ contractId: UUID_1, status: 'TIL_REVIEW' } as never)
    expect('data' in result).toBe(true)
    expect(prisma.auditLog.create).toHaveBeenCalled()
  })

  it('afviser invalid transition (UDKAST → OPSAGT)', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.contract.findFirst).mockImplementation((() =>
      Promise.resolve({
        id: UUID_1,
        status: 'UDKAST',
        sensitivity: 'INTERN',
        notes: '',
        company_id: UUID_1,
      })) as never)
    const result = await updateContractStatus({ contractId: UUID_1, status: 'OPSAGT' } as never)
    expect('error' in result).toBe(true)
  })

  it('afviser uden sensitivity-adgang', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.contract.findFirst).mockImplementation((() =>
      Promise.resolve({
        id: UUID_1,
        status: 'UDKAST',
        sensitivity: 'STRENGT_FORTROLIG',
        notes: '',
        company_id: UUID_1,
      })) as never)
    const perms = await import('@/lib/permissions')
    vi.mocked(perms.canAccessSensitivity).mockResolvedValueOnce(false)
    const result = await updateContractStatus({ contractId: UUID_1, status: 'TIL_REVIEW' } as never)
    expect('error' in result).toBe(true)
  })

  it('OPSAGT-status sætter termination_date', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.contract.findFirst).mockImplementation((() =>
      Promise.resolve({
        id: UUID_1,
        status: 'AKTIV',
        sensitivity: 'INTERN',
        notes: '',
        company_id: UUID_1,
      })) as never)
    await updateContractStatus({ contractId: UUID_1, status: 'OPSAGT' } as never)
    const updateCall = vi.mocked(prisma.contract.update).mock.calls[0]
    expect(updateCall![0].data.termination_date).toBeInstanceOf(Date)
  })
})

describe('deleteContract', () => {
  beforeEach(() => vi.clearAllMocks())

  it('UDKAST kan slettes', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.contract.findFirst).mockImplementation((() =>
      Promise.resolve({
        id: UUID_1,
        status: 'UDKAST',
        company_id: UUID_1,
      })) as never)
    const result = await deleteContract(UUID_1)
    expect('data' in result).toBe(true)
  })

  it('AKTIV kontrakt kan ikke slettes', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.contract.findFirst).mockImplementation((() =>
      Promise.resolve({
        id: UUID_1,
        status: 'AKTIV',
        company_id: UUID_1,
      })) as never)
    const result = await deleteContract(UUID_1)
    expect('error' in result).toBe(true)
    if ('error' in result) {
      expect(result.error).toMatch(/kladde-kontrakter/)
    }
  })

  it('afviser uden settings-adgang', async () => {
    const perms = await import('@/lib/permissions')
    vi.mocked(perms.canAccessModule).mockResolvedValueOnce(false)
    const result = await deleteContract(UUID_1)
    expect('error' in result).toBe(true)
  })
})

describe('getContractList', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returnerer kontrakter med sensitivity-filter', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.contract.findMany).mockImplementation((() =>
      Promise.resolve([
        { id: 'c-1', sensitivity: 'INTERN' },
        { id: 'c-2', sensitivity: 'STRENGT_FORTROLIG' },
      ])) as never)
    vi.mocked(prisma.contract.count).mockImplementation((() => Promise.resolve(2)) as never)
    const perms = await import('@/lib/permissions')
    vi.mocked(perms.canAccessSensitivity).mockResolvedValueOnce(true).mockResolvedValueOnce(false)
    const result = await getContractList({ organizationId: 'org-1', userId: 'user-1' })
    if ('data' in result) {
      expect(result.data.contracts.length).toBe(1)
      expect(result.data.total).toBe(2)
    }
  })

  it('page-size cappes ved 100', async () => {
    const { prisma } = await import('@/lib/db')
    await getContractList({ organizationId: 'org-1', userId: 'user-1', pageSize: 500 })
    const findManyCall = vi.mocked(prisma.contract.findMany).mock.calls[0]
    expect(findManyCall![0]?.take).toBe(100)
  })
})
