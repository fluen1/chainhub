import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({
  auth: vi.fn().mockResolvedValue({
    user: { id: 'user-1', organizationId: 'org-1' },
  }),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    case: {
      count: vi.fn().mockResolvedValue(0),
      create: vi.fn().mockResolvedValue({ id: 'case-1', status: 'NY' }),
      findFirst: vi.fn(),
      update: vi.fn().mockResolvedValue({ id: 'case-1' }),
    },
    caseCompany: { create: vi.fn().mockResolvedValue({}) },
  },
}))

vi.mock('@/lib/permissions', () => ({
  canAccessCompany: vi.fn().mockResolvedValue(true),
  canAccessModule: vi.fn().mockResolvedValue(true),
}))

vi.mock('@/lib/audit', () => ({
  recordAuditEvent: vi.fn().mockResolvedValue(undefined),
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

import { createCase, updateCaseStatus, deleteCase } from '@/actions/cases'

const UUID_1 = 'a1b2c3d4-e5f6-4789-9abc-def012345678'

describe('createCase', () => {
  beforeEach(() => vi.clearAllMocks())

  it('happy path opretter sag', async () => {
    const result = await createCase({
      title: 'Test sag',
      caseType: 'TVIST',
      companyIds: [UUID_1],
      sensitivity: 'INTERN',
    } as never)
    expect('data' in result).toBe(true)
  })

  it('afviser uden module-adgang', async () => {
    const perms = await import('@/lib/permissions')
    vi.mocked(perms.canAccessModule).mockResolvedValueOnce(false)
    const result = await createCase({
      title: 'Test',
      caseType: 'TVIST',
      companyIds: [UUID_1],
      sensitivity: 'INTERN',
    } as never)
    expect('error' in result).toBe(true)
  })

  it('afviser uden company-adgang', async () => {
    const perms = await import('@/lib/permissions')
    vi.mocked(perms.canAccessCompany).mockResolvedValueOnce(false)
    const result = await createCase({
      title: 'Test',
      caseType: 'TVIST',
      companyIds: [UUID_1],
      sensitivity: 'INTERN',
    } as never)
    expect('error' in result).toBe(true)
  })

  it('afviser uden session', async () => {
    const auth = await import('@/lib/auth')
    vi.mocked(auth.auth).mockResolvedValueOnce(null)
    const result = await createCase({
      title: 'Test',
      caseType: 'TVIST',
      companyIds: [UUID_1],
      sensitivity: 'INTERN',
    } as never)
    expect(result).toEqual({ error: 'Ikke autoriseret' })
  })

  it('afviser tom titel', async () => {
    const result = await createCase({
      title: '',
      caseType: 'TVIST',
      companyIds: [UUID_1],
      sensitivity: 'INTERN',
    } as never)
    expect('error' in result).toBe(true)
  })
})

describe('updateCaseStatus', () => {
  beforeEach(() => vi.clearAllMocks())

  it('happy path: NY → AKTIV opdaterer status og logger audit', async () => {
    const { prisma } = await import('@/lib/db')
    const audit = await import('@/lib/audit')
    vi.mocked(prisma.case.findFirst).mockImplementation((() =>
      Promise.resolve({ status: 'NY', sensitivity: 'INTERN' })) as never)
    const result = await updateCaseStatus({ caseId: UUID_1, status: 'AKTIV' } as never)
    expect('data' in result).toBe(true)
    expect(audit.recordAuditEvent).toHaveBeenCalled()
  })

  it('afviser ugyldig transition (NY → LUKKET)', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.case.findFirst).mockImplementation((() =>
      Promise.resolve({ status: 'NY', sensitivity: 'INTERN' })) as never)
    const result = await updateCaseStatus({ caseId: UUID_1, status: 'LUKKET' } as never)
    expect('error' in result).toBe(true)
  })

  it('returnerer fejl hvis sag ikke findes', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.case.findFirst).mockImplementation((() => Promise.resolve(null)) as never)
    const result = await updateCaseStatus({ caseId: UUID_1, status: 'AKTIV' } as never)
    expect('error' in result).toBe(true)
  })
})

describe('deleteCase', () => {
  beforeEach(() => vi.clearAllMocks())

  it('happy path soft-sletter med settings-adgang', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.case.findFirst).mockImplementation((() =>
      Promise.resolve({ id: UUID_1 })) as never)
    const result = await deleteCase(UUID_1)
    expect('data' in result).toBe(true)
  })

  it('afviser uden settings-modul-adgang', async () => {
    const perms = await import('@/lib/permissions')
    vi.mocked(perms.canAccessModule).mockResolvedValueOnce(false)
    const result = await deleteCase(UUID_1)
    expect('error' in result).toBe(true)
  })

  it('returnerer fejl hvis sag ikke findes', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.case.findFirst).mockImplementation((() => Promise.resolve(null)) as never)
    const result = await deleteCase(UUID_1)
    expect('error' in result).toBe(true)
  })
})
