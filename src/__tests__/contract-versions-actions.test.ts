import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({
  auth: vi.fn().mockResolvedValue({
    user: { id: 'user-1', organizationId: 'org-1' },
  }),
}))

const mockTx = {
  contractVersion: {
    updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    create: vi.fn().mockResolvedValue({ id: 'v-1', version_number: 1 }),
  },
}

vi.mock('@/lib/db', () => ({
  prisma: {
    contract: { findFirst: vi.fn() },
    contractVersion: { findFirst: vi.fn() },
    auditLog: { create: vi.fn().mockResolvedValue({}) },
    $transaction: vi.fn().mockImplementation(async (fn) => fn(mockTx)),
  },
}))

vi.mock('@/lib/permissions', () => ({
  canAccessCompany: vi.fn().mockResolvedValue(true),
  canAccessSensitivity: vi.fn().mockResolvedValue(true),
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

import { createContractVersion } from '@/actions/contract-versions'

const UUID_1 = 'a1b2c3d4-e5f6-4789-9abc-def012345678'

describe('createContractVersion', () => {
  beforeEach(() => vi.clearAllMocks())

  it('happy path opretter version og logger audit', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.contract.findFirst).mockImplementation((() =>
      Promise.resolve({
        id: UUID_1,
        company_id: UUID_1,
        sensitivity: 'INTERN',
      })) as never)
    vi.mocked(prisma.contractVersion.findFirst).mockImplementation((() =>
      Promise.resolve({ version_number: 2 })) as never)
    const result = await createContractVersion({
      contractId: UUID_1,
      fileUrl: '/uploads/test.pdf',
      fileName: 'test.pdf',
      fileSizeBytes: 1024,
      changeType: 'NY_VERSION',
    })
    expect('data' in result).toBe(true)
    expect(prisma.auditLog.create).toHaveBeenCalled()
  })

  it('returnerer fejl hvis kontrakt ikke findes', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.contract.findFirst).mockImplementation((() => Promise.resolve(null)) as never)
    const result = await createContractVersion({
      contractId: UUID_1,
      fileUrl: '/x',
      fileName: 'x',
      fileSizeBytes: 1,
      changeType: 'NY_VERSION',
    })
    expect('error' in result).toBe(true)
  })

  it('afviser uden company-adgang', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.contract.findFirst).mockImplementation((() =>
      Promise.resolve({
        id: UUID_1,
        company_id: UUID_1,
        sensitivity: 'INTERN',
      })) as never)
    const perms = await import('@/lib/permissions')
    vi.mocked(perms.canAccessCompany).mockResolvedValueOnce(false)
    const result = await createContractVersion({
      contractId: UUID_1,
      fileUrl: '/x',
      fileName: 'x',
      fileSizeBytes: 1,
      changeType: 'NY_VERSION',
    })
    expect('error' in result).toBe(true)
  })

  it('afviser uden sensitivity-adgang', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.contract.findFirst).mockImplementation((() =>
      Promise.resolve({
        id: UUID_1,
        company_id: UUID_1,
        sensitivity: 'STRENGT_FORTROLIG',
      })) as never)
    const perms = await import('@/lib/permissions')
    vi.mocked(perms.canAccessSensitivity).mockResolvedValueOnce(false)
    const result = await createContractVersion({
      contractId: UUID_1,
      fileUrl: '/x',
      fileName: 'x',
      fileSizeBytes: 1,
      changeType: 'NY_VERSION',
    })
    expect('error' in result).toBe(true)
  })

  it('afviser uden session', async () => {
    const auth = await import('@/lib/auth')
    vi.mocked(auth.auth).mockResolvedValueOnce(null)
    const result = await createContractVersion({
      contractId: UUID_1,
      fileUrl: '/x',
      fileName: 'x',
      fileSizeBytes: 1,
      changeType: 'NY_VERSION',
    })
    expect(result).toEqual({ error: 'Ikke autoriseret' })
  })

  it('transaction unmarker gammel is_current og opretter ny', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.contract.findFirst).mockImplementation((() =>
      Promise.resolve({
        id: UUID_1,
        company_id: UUID_1,
        sensitivity: 'INTERN',
      })) as never)
    vi.mocked(prisma.contractVersion.findFirst).mockImplementation((() =>
      Promise.resolve({ version_number: 1 })) as never)
    await createContractVersion({
      contractId: UUID_1,
      fileUrl: '/x',
      fileName: 'x',
      fileSizeBytes: 1,
      changeType: 'NY_VERSION',
    })
    expect(prisma.$transaction).toHaveBeenCalled()
    expect(mockTx.contractVersion.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { is_current: false } })
    )
    expect(mockTx.contractVersion.create).toHaveBeenCalled()
  })
})
